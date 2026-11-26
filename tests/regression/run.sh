#!/usr/bin/env bash
# Регресійні тести home-hub у Docker-мережі БЕЗ інтернету (--internal): продакшен, пошта, Telegram,
# Expo push недосяжні. Образи cloud/server і local збираються з git-ревізії (git archive), тому
# можна перевірити будь-яку версію, не чіпаючи робочу копію.
#
#   tests/regression/run.sh full <ревізія>                 повний набір на чистій базі
#   tests/regression/run.sh upgrade <стара> <нова>         стара наповнює базу → нова на тій самій базі
#   tests/regression/run.sh compare <стара> <нова>         full на обох + upgrade, таблиця відмінностей
#
# Результати: tests/regression/results/<дата>-<режим>/ (у git не потрапляють).
# Змінні — лише латиницею.
set -euo pipefail

here_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(git -C "$here_dir" rev-parse --show-toplevel)"
run_id="hhreg-$$"
net_name="$run_id-net"
sync_secret="reg-sync-secret"
jwt_secret="reg-jwt-secret"
node_image="node:20-alpine"
mongo_image="mongo:7"

cleanup() {
  docker rm -f "$run_id-mongo" "$run_id-cloud" "$run_id-local" >/dev/null 2>&1 || true
  docker network rm "$net_name" >/dev/null 2>&1 || true
}
trap cleanup EXIT

ensure_runner_deps() {
  if [[ ! -d "$here_dir/node_modules/socket.io-client" || ! -d "$here_dir/node_modules/mongodb" ]]; then
    echo "▶ залежності тестів (npm ci --ignore-scripts)…"
    (cd "$here_dir" && npm ci --ignore-scripts --no-audit --no-fund >/dev/null)
  fi
}

build_images() {
  # build_images <ревізія> → друкує коротке sha
  local ref="$1" sha tmp
  sha="$(git -C "$repo_root" rev-parse --short "$ref")"
  if docker image inspect "hhreg-cloud:$sha" >/dev/null 2>&1 && docker image inspect "hhreg-local:$sha" >/dev/null 2>&1; then
    echo "$sha"; return
  fi
  tmp="$(mktemp -d)"
  git -C "$repo_root" archive "$sha" cloud/server local | tar -x -C "$tmp"
  echo "▶ збираю образи $sha…" >&2
  docker build -q --build-arg "GIT_COMMIT=$sha" -t "hhreg-cloud:$sha" "$tmp/cloud/server" >/dev/null
  docker build -q --build-arg "GIT_COMMIT=$sha" -t "hhreg-local:$sha" "$tmp/local" >/dev/null
  rm -rf "$tmp"
  echo "$sha"
}

start_net_and_mongo() {
  cleanup
  docker network create --internal "$net_name" >/dev/null
  docker run -d --name "$run_id-mongo" --network "$net_name" --network-alias mongo "$mongo_image" >/dev/null
}

start_cloud() {
  docker rm -f "$run_id-cloud" >/dev/null 2>&1 || true
  docker run -d --name "$run_id-cloud" --network "$net_name" --network-alias cloud \
    -e MONGO_URI=mongodb://mongo:27017/hh -e JWT_SECRET="$jwt_secret" -e SYNC_SECRET="$sync_secret" \
    -e HTTP_PORT=3001 -e TCP_PORT=8090 -e FRONTEND_URL=http://web.reg.test \
    "hhreg-cloud:$1" >/dev/null
}

start_local() {
  docker rm -f "$run_id-local" >/dev/null 2>&1 || true
  docker run -d --name "$run_id-local" --network "$net_name" --network-alias local \
    -e MONGO_URI=mongodb://mongo:27017/hhlocal -e JWT_SECRET="$jwt_secret" -e SYNC_SECRET="$sync_secret" \
    -e CLOUD_URL=http://cloud:3001 -e PORT=3002 -e HUB_URL=http://hub.reg.test \
    "hhreg-local:$1" >/dev/null
}

run_phase() {
  # run_phase <фаза> <каталог результатів>
  local phase="$1" out="$2" rc=0
  timeout 300 docker run --rm --network "$net_name" -v "$here_dir":/t:ro -v "$out":/out \
    -e SYNC_SECRET="$sync_secret" -w /t "$node_image" node /t/suite.mjs "$phase" >"$out/$phase.txt" 2>&1 || rc=$?
  tail -n 1 "$out/$phase.txt"
  grep -E '^(✗|⚠)' "$out/$phase.txt" | sed 's/^/    /' || true
  return $rc
}

email_check() {
  local out="$1"
  docker exec -i "$run_id-cloud" node - <"$here_dir/email-check.cjs" >"$out/email.json" 2>&1 || true
  python3 -I - "$out/email.json" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception as e:
    print("email: не вдалося —", open(sys.argv[1]).read()[:300]); sys.exit(0)
ok = sum(r["ok"] for r in d["results"]); n = len(d["results"])
print(f"email (nodemailer {d['nodemailer']}): {ok}/{n} пройдено")
for r in d["results"]:
    if not r["ok"]: print("    ✗", r["name"], "—", r["detail"])
PY
}

save_logs() {
  local out="$1" tag="$2"
  docker logs "$run_id-cloud" >"$out/cloud-$tag.log" 2>&1 || true
  docker logs "$run_id-local" >"$out/local-$tag.log" 2>&1 || true
}

mode_full() {
  local sha="$1" out="$2" rc=0
  mkdir -p "$out"
  echo "── full $sha"
  start_net_and_mongo
  start_cloud "$sha"
  run_phase full "$out" || rc=1
  email_check "$out"
  start_local "$sha"
  run_phase local "$out" || rc=1
  save_logs "$out" "$sha"
  return $rc
}

mode_upgrade() {
  local old="$1" new="$2" out="$3" rc=0
  mkdir -p "$out"
  echo "── upgrade $old → $new"
  start_net_and_mongo
  start_cloud "$old"
  run_phase seed "$out" || rc=1
  save_logs "$out" "$old"
  start_cloud "$new"
  run_phase verify "$out" || rc=1
  start_local "$new"
  run_phase local "$out" || rc=1
  save_logs "$out" "$new"
  return $rc
}

compare_table() {
  python3 -I - "$@" <<'PY'
import json, sys, os
a_dir, b_dir, a_sha, b_sha = sys.argv[1:5]
def load(d):
    res = {}
    for ph in ("full", "local"):
        p = os.path.join(d, ph + ".json")
        if os.path.exists(p):
            for r in json.load(open(p)): res[f"{ph}: {r['name']}"] = r["ok"]
    p = os.path.join(d, "email.json")
    try:
        for r in json.load(open(p))["results"]: res["email: " + r["name"]] = r["ok"]
    except Exception:
        pass
    return res
a, b = load(a_dir), load(b_dir)
names = sorted(set(a) | set(b))
diff = [n for n in names if a.get(n) != b.get(n)]
mark = lambda v: "✓" if v else ("✗" if v is False else "—")
print(f"\nПеревірок: {a_sha} — {sum(a.values())}/{len(a)}, {b_sha} — {sum(b.values())}/{len(b)}")
if diff:
    print("Відмінності:")
    for n in diff: print(f"  {mark(a.get(n))} → {mark(b.get(n))}  {n}")
else:
    print("Відмінностей немає: усі перевірки дали однаковий результат.")
PY
}

cmd="${1:-}"
case "$cmd" in
  full)
    ensure_runner_deps
    sha="$(build_images "${2:?ревізія}")"
    out="$here_dir/results/$(date +%Y-%m-%d-%H%M%S)-full-$sha"
    mode_full "$sha" "$out"; echo "результати: $out" ;;
  upgrade)
    ensure_runner_deps
    old="$(build_images "${2:?стара ревізія}")"; new="$(build_images "${3:?нова ревізія}")"
    out="$here_dir/results/$(date +%Y-%m-%d-%H%M%S)-upgrade-$old-$new"
    mode_upgrade "$old" "$new" "$out"; echo "результати: $out" ;;
  compare)
    ensure_runner_deps
    old="$(build_images "${2:?стара ревізія}")"; new="$(build_images "${3:?нова ревізія}")"
    base="$here_dir/results/$(date +%Y-%m-%d-%H%M%S)-compare-$old-$new"
    rc=0
    mode_full "$old" "$base/full-$old" || rc=1
    mode_full "$new" "$base/full-$new" || rc=1
    mode_upgrade "$old" "$new" "$base/upgrade" || rc=1
    compare_table "$base/full-$old" "$base/full-$new" "$old" "$new"
    echo "результати: $base"
    exit $rc ;;
  *)
    sed -n 2,12p "$0"; exit 2 ;;
esac

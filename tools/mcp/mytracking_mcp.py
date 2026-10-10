#!/usr/bin/env python3
"""MCP-сервер хмарного дзеркала home-hub (mytracking.com.ua, DigitalOcean) через SSH —
без залежностей: JSON-RPC 2.0 рядками через stdio (протокол MCP, tools).

Інструменти:
  status   — контейнери, диск, пам'ять, строк сертифіката, чи відповідає сайт;
  logs     — хвіст журналу контейнера home-hub;
  cert     — check: строк і спосіб поновлення; renew: поновити й перечитати nginx;
  restart  — перезапустити контейнер home-hub (web, server, mongo);
  run      — будь-яка команда на сервері від root (з обмеженням часу).

Доступ — ключ ~/.ssh/id_ed25519 цього ПК у /root/.ssh/authorized_keys сервера; відбиток
ключа сервера звірено 10.10.2026 (SHA256:uwF1Q7KmN3X8x9HIusvbkH9XtoYim6xadMaEItCG7M0).
Сервер: MYTRACKING_HOST (типово root@mytracking.com.ua), проєкт — /root/project/home-hub.

Реєстрація (user-рівень, працює з будь-якої теки):
    claude mcp add --scope user mytracking -- python3 /home/alex/home-hub/tools/mcp/mytracking_mcp.py
Інструменти з'являються лише в НОВІЙ сесії Claude Code.
"""
import json
import os
import re
import shlex
import subprocess
import sys

HOST = os.environ.get("MYTRACKING_HOST", "root@mytracking.com.ua")
DOMAIN = "mytracking.com.ua"
CONTAINERS = {"web": "home-hub-web-1", "server": "home-hub-server-1", "mongo": "home-hub-mongo-1"}
CERTS_VOL, WWW_VOL = "home-hub_certbot_certs", "home-hub_certbot_www"

# Поновлення, яке спрацювало 10.10.2026. Пастки, на які тоді наступили:
# - без --no-random-sleep-on-renew certbot без термінала мовчки чекає до ~8 хв;
# - спосіб standalone займає порт 80, а там nginx — тому webroot (nginx віддає
#   /.well-known/acme-challenge/ зі спільного тому certbot_www);
# - новий сертифікат nginx бачить лише після перечитування конфігу.
RENEW = (f"timeout 240 docker run --rm -v {CERTS_VOL}:/etc/letsencrypt -v {WWW_VOL}:/var/www/certbot "
         f"certbot/certbot renew --non-interactive --no-random-sleep-on-renew --cert-name {DOMAIN} "
         f"--webroot -w /var/www/certbot 2>&1 | tail -8 && "
         f"docker exec {CONTAINERS['web']} nginx -t 2>&1 | tail -1 && "
         f"docker exec {CONTAINERS['web']} nginx -s reload && echo 'nginx перечитано'")
CERT_INFO = (f"echo | timeout 10 openssl s_client -connect 127.0.0.1:443 -servername {DOMAIN} 2>/dev/null "
             f"| openssl x509 -noout -dates; "
             f"grep -E 'authenticator|webroot_path' /var/lib/docker/volumes/{CERTS_VOL}/_data/renewal/{DOMAIN}.conf")
STATUS = ("docker ps -a --filter name=home-hub --format '{{.Names}} | {{.Status}}'; echo; "
          "df -h / | tail -1; free -m | sed -n 2p; uptime; echo; " + CERT_INFO + "; "
          f"curl -s -m 10 -o /dev/null -w 'https://{DOMAIN}: %{{http_code}}, перевірка сертифіката %{{ssl_verify_result}} (0 = добре)\\n' https://{DOMAIN}/")

TOOLS = [
    {"name": "status", "description": "Стан сервера дзеркала: контейнери home-hub, диск, пам'ять, строк сертифіката й спосіб його поновлення, чи відкривається https://mytracking.com.ua.",
     "inputSchema": {"type": "object", "properties": {}}},
    {"name": "logs", "description": "Хвіст журналу контейнера home-hub.",
     "inputSchema": {"type": "object", "properties": {
         "container": {"type": "string", "enum": list(CONTAINERS)},
         "lines": {"type": "integer", "description": "скільки рядків, до 500 (типово 80)"}},
         "required": ["container"]}},
    {"name": "cert", "description": "Сертифікат Let's Encrypt: check — строк і спосіб поновлення; renew — поновити (webroot, без випадкової затримки) і перечитати nginx. Let's Encrypt дає 5 невдалих перевірок на годину — renew не повторювати наосліп.",
     "inputSchema": {"type": "object", "properties": {"action": {"type": "string", "enum": ["check", "renew"]}},
                     "required": ["action"]}},
    {"name": "restart", "description": "Перезапустити контейнер home-hub (web — nginx і сайт, server — API і GPS-приймач, mongo — база).",
     "inputSchema": {"type": "object", "properties": {"container": {"type": "string", "enum": list(CONTAINERS)}},
                     "required": ["container"]}},
    {"name": "run", "description": "Виконати команду на сервері від root (bash, тека /root/project/home-hub). Для всього, чого нема в інших інструментах. Обережно: це root на робочому сервері сайту.",
     "inputSchema": {"type": "object", "properties": {
         "command": {"type": "string"},
         "timeout": {"type": "integer", "description": "секунд, до 600 (типово 60)"}},
         "required": ["command"]}},
]

# Попередження OpenSSH про пост-квантовий обмін ключами — шум у кожному виклику
NOISE = re.compile(r"^\*\* (WARNING: connection is not using a post-quantum|This session may be vulnerable|The server may need to be upgraded)")


def ssh(command, timeout=60):
    try:
        p = subprocess.run(["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", HOST,
                            f"cd /root/project/home-hub && {command}"],
                           capture_output=True, text=True, timeout=timeout + 15)
    except subprocess.TimeoutExpired:
        return f"‼ не вклалось у {timeout} с (команда могла лишитися працювати на сервері)", True
    err = "\n".join(l for l in p.stderr.splitlines() if not NOISE.match(l)).strip()
    out = p.stdout.rstrip()
    if err:
        out = (out + "\n" if out else "") + err
    if p.returncode == 255:
        return f"‼ SSH не з'єднався: {err or 'код 255'}", True
    return (out or "(порожньо)") + (f"\n[код виходу {p.returncode}]" if p.returncode else ""), p.returncode != 0


def container(a):
    if a.get("container") not in CONTAINERS:
        raise ValueError("контейнер — один із: %s" % ", ".join(CONTAINERS))
    return CONTAINERS[a["container"]]


def call(name, a):
    if name == "status":
        return ssh(STATUS)
    if name == "logs":
        c = container(a)
        n = max(1, min(int(a.get("lines") or 80), 500))
        return ssh(f"docker logs --tail {n} {c} 2>&1")
    if name == "cert":
        if a["action"] == "check":
            return ssh(CERT_INFO)
        if a["action"] == "renew":
            return ssh(RENEW, timeout=300)
    if name == "restart":
        c = container(a)
        return ssh(f"docker restart {c} && docker ps --filter name={c} --format '{{{{.Names}}}} | {{{{.Status}}}}'", timeout=120)
    if name == "run":
        t = max(1, min(int(a.get("timeout") or 60), 600))
        return ssh(f"timeout {t} bash -c {shlex.quote(a['command'])}", timeout=t)
    raise ValueError("невідомий інструмент %s" % name)


def reply(mid, result=None, error=None):
    msg = {"jsonrpc": "2.0", "id": mid}
    if error:
        msg["error"] = error
    else:
        msg["result"] = result
    sys.stdout.write(json.dumps(msg, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except ValueError:
            continue
        method, mid, params = msg.get("method"), msg.get("id"), msg.get("params") or {}
        if mid is None:
            continue                                   # сповіщення
        if method == "initialize":
            reply(mid, {"protocolVersion": params.get("protocolVersion", "2024-11-05"),
                        "capabilities": {"tools": {}},
                        "serverInfo": {"name": "mytracking", "version": "1.0"}})
        elif method == "ping":
            reply(mid, {})
        elif method == "tools/list":
            reply(mid, {"tools": TOOLS})
        elif method == "tools/call":
            try:
                out, is_err = call(params["name"], params.get("arguments") or {})
                reply(mid, {"content": [{"type": "text", "text": out}], "isError": is_err})
            except Exception as e:                     # помилку — моделі, не падати
                reply(mid, {"content": [{"type": "text", "text": "‼ %s: %s" % (type(e).__name__, e)}], "isError": True})
        else:
            reply(mid, error={"code": -32601, "message": "метод не підтримується: %s" % method})


if __name__ == "__main__":
    main()

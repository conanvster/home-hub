# 🏠 home-hub

Домашній дашборд. Централізована система управління будинком.

## Модулі

- **GPS трекінг** — відстеження авто в реальному часі + історія
- **Home Assistant** — інтеграція (локально) *(майбутнє)*
- **Фото / файли** — локальне сховище *(майбутнє)*
- **Бекапи** *(майбутнє)*

## Архітектура

```
[GPS Трекер] ──TCP──▶ [cloud/] Digital Ocean (mytracking.com.ua)
                          ├── TCP listener (порт 8090)
                          ├── REST API (Express)
                          ├── MongoDB
                          └── Веб-інтерфейс (React + Vite + Leaflet)

[local/] Домашній сервер
    └── Sync (кожну годину пулить нові дані з хмари)
```

## Структура

```
home-hub/
├── cloud/
│   ├── server/   ← Node.js бекенд (DO)
│   └── web/      ← React фронтенд (DO)
└── local/        ← sync сервіс (домашній сервер)
```

## Стек

| Частина     | Технологія                              |
|-------------|-----------------------------------------|
| Backend     | Node.js + Express + MongoDB (Mongoose)  |
| Frontend    | React + Vite + Tailwind CSS + Leaflet   |
| Auth        | JWT                                     |
| Real-time   | WebSocket (Socket.io)                   |
| Sync        | Cron (node-cron) + REST API             |

## Етапи розробки

- [ ] **Етап 1** — GPS трекінг (cloud + local sync)
- [ ] **Етап 2** — Home Assistant інтеграція
- [ ] **Етап 3** — Фото / файлове сховище
- [ ] **Етап 4** — Мультикористувач (батьки)

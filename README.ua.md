# Carcassonne (web)

[English version](README.md)

Невелика веб-гра за мотивами Carcassonne, зроблена на Next.js + React Three Fiber.

## Що є в проєкті

- **Solo** режим
- **Multiplayer Offline** (hotseat, 1–5 гравців, ходи по черзі)
- **Multiplayer Online (LAN)** кімнати (Socket.IO, найпростіша host-authoritative модель)
- **Сейви файлами** (окремі сейви для solo та multiplayer)
- **Rules**: вбудовані “Правила сайту” + зовнішнє посилання на PDF “Правила гри”

## Керування

- **Поставити тайл**: клік по підсвіченій порожній клітинці
- **Повернути тайл**: `R` (або кнопка Rotate)
- **Пропустити дяпчика (meeple)**: `Esc` (або `Next` в мультиплеєрі)

## Вимоги

- Node.js 18+ (рекомендовано)

## Запуск локально

У папці `my-app/`:

```bash
npm install
npm run dev
```

Відкрий: http://localhost:3000

Примітка: `npm run dev` запускає `server.mjs`, який піднімає Next.js **і** Socket.IO на одному порту.

## Online по локальній мережі (LAN)

1. На хості запусти: `npm run dev`
2. Переконайся, що firewall на хості пропускає вхідні TCP-з’єднання на порт `3000`
3. На інших пристроях у тій самій мережі відкрий:

```
http://<LAN_IP_ХОСТА>:3000
```

Далі: **Multiplayer → Online** (або сторінка `/online`) і створюй/приєднуйся до кімнати.

## Сейви

Файлові сейви записуються як JSON у:

- `src/game/store/save/saves/solo/`
- `src/game/store/save/saves/multi/`

Це варіант для локальної розробки (не для serverless-деплою, де файлової системи може не бути або вона тимчасова).

## Структура (коротко)

- `app/` — сторінки Next.js (меню, solo, online, API)
- `src/game/store/useGameStore.ts` — Zustand store (логіка гри + збереження)
- `src/scene/components/` — рендер дошки/тайлів/дяпчиків (React Three Fiber)

# Fantasy KNUST — Admin Dashboard

Production-grade admin console for Fantasy KNUST built with Next.js 14.

## Stack
- **Next.js 14** (App Router, no TypeScript)
- **CSS** (custom design system, no Tailwind)
- **Lucide React** icons
- **STOMP WebSocket** for live match updates
- **Chart.js** for data visualizations

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment

Create `.env.local`:
```
NEXT_PUBLIC_API_URL=https://fantasy-backend-oune.onrender.com
```

## Login

Email: `fantasy@knust.com`  
Password: your admin password

## Pages

| Page | URL | Description |
|------|-----|-------------|
| Dashboard | `/dashboard` | Overview, live ticker, quick actions |
| Matches | `/matches` | Full match lifecycle management |
| Players | `/players` | Player database with filtering |
| Users & Teams | `/users` | Manager and squad viewer |
| Leagues | `/leagues` | League management and standings |
| Broadcast | `/broadcast` | Push alerts and announcements |
| Tournament | `/tournament` | Season control and finalization |

## Teams

CS1, CS2, CS3, CS4, IT1, IT2

## Match Lifecycle

1. **Create** → `POST /api/admin/matches`
2. **Start** → `POST /api/admin/matches/{id}/start`
3. **Give Events** → `POST /api/admin/matches/{id}/event`
4. **Give Appearance** → `POST /api/admin/matches/{id}/appearance`
5. **Complete** → `POST /api/admin/matches/{id}/complete`

## Deploy

Push to GitHub and connect to Vercel or Render static site.

## Saved for Later (Backlog)

- Gameweek End trigger (adds 1 free transfer per team, cap 5)
- Free transfer override per team
- Push token monitor
- Points audit per match
- Transfer log per gameweek
- League admin tools (delete, remove member, reset code)

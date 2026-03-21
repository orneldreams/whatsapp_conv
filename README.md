# DiscipLink Workspace

Ce workspace est separe en 2 applications:

- `backend/` : API Express + webhook WhatsApp + jobs BullMQ
- `frontend/` : dashboard React (Vite + Tailwind)

## 1) Lancer le backend

Depuis `backend/`:

```bash
npm install
npm run dev
```

Optionnel pour les jobs:

```bash
npm run worker
npm run scheduler
```

Variables importantes backend (`backend/.env`):

- `DASHBOARD_PASSWORD` : mot de passe unique du dashboard
- `CORS_ORIGIN` : URL frontend (par defaut `http://localhost:5173`)
- Variables Twilio, Firebase, Redis deja presentes

## 2) Lancer le frontend

Depuis `frontend/`:

```bash
npm install
npm run dev
```

Le frontend tourne sur `http://localhost:5173`.

Variable frontend (`frontend/.env`):

```env
VITE_API_BASE_URL=http://localhost:3000
```

## 3) Connexion dashboard

- Ouvre `http://localhost:5173`
- Saisis le mot de passe `DASHBOARD_PASSWORD`
- Le mot de passe est stocke en localStorage et envoye dans le header `x-dashboard-password`

## 4) Endpoints Dashboard exposes

- `GET    /api/disciples`
- `POST   /api/disciples`
- `GET    /api/disciples/:id`
- `PUT    /api/disciples/:id`
- `DELETE /api/disciples/:id`

- `GET    /api/checkins?date=YYYY-MM-DD`
- `GET    /api/checkins/:discipleId`
- `POST   /api/checkins/send`

- `GET    /api/stats`

- `GET    /api/config/fields`
- `POST   /api/config/fields`
- `PUT    /api/config/fields/:key`
- `DELETE /api/config/fields/:key`

- `GET    /api/bot/config`
- `PUT    /api/bot/config`

- `GET    /api/auth/check`

Tous les endpoints `/api/*` demandent le header `x-dashboard-password`.

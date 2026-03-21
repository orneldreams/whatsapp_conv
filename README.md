# DiscipLink Workspace

Ce workspace est separe en 2 applications:

- `backend/` : API Express + webhook WhatsApp + jobs BullMQ
- `frontend/` : dashboard React (Vite + Tailwind + Firebase Auth)

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

- `CORS_ORIGIN` : URL frontend (par defaut `http://localhost:5173`)
- `PASTOR_WHATSAPP_NUMBER` : fallback si aucun numero n'est configure dans `/api/bot/config`
- Variables Twilio, Firebase Admin, Redis deja presentes

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
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## 3) Connexion dashboard

- Ouvre `http://localhost:5173`
- Connecte-toi avec un utilisateur Firebase Authentication (email/mot de passe)
- Le frontend recupere un ID token Firebase et l'envoie dans le header `Authorization: Bearer <token>`
- La page `register` est volontairement non exposee: cree les comptes pasteur depuis la console Firebase Auth

## 4) Migration Firestore

Les disciples sont maintenant ranges sous:

- `pasteurs/{pasteurId}/disciples/{phoneNumber}`

Pour migrer les documents legacy `users/{phoneNumber}`:

```bash
cd backend
npm run migrate:users -- --dry-run
npm run migrate:users
```

## 5) Endpoints Dashboard exposes

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

Tous les endpoints `/api/*` demandent un header `Authorization: Bearer <firebase-id-token>`.

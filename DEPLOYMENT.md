# Mise En Ligne (Production)

## 1. Pre-check local

1. Installer les deps:
   - `npm install`
   - `npm --prefix backend install`
   - `npm --prefix frontend install`
2. Vérifier frontend:
   - `npm --prefix frontend run lint`
   - `npm --prefix frontend run build`
3. Vérifier santé backend une fois déployé:
   - `GET /health` doit retourner `{ "status": "ok" }`.

## 2. Variables d'environnement

- Copier:
  - `backend/.env.example` -> `backend/.env`
  - `frontend/.env.example` -> `frontend/.env`
- Ne jamais committer de `.env` réel.

## 3. Déploiement recommandé

## Option A: Frontend sur Vercel + Backend sur Render

### Frontend (Vercel)

1. Importer le repo GitHub dans Vercel.
2. Root directory: `frontend`.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Définir toutes les variables `VITE_*`.
6. Déployer.

### Backend (Render)

1. Nouveau Web Service depuis le repo.
2. Root directory: `backend`.
3. Build command: `npm install`.
4. Start command: `npm run start`.
5. Ajouter les variables backend (`TWILIO_*`, `FIREBASE_*`, `REDIS_URL`, `CORS_ORIGIN`, etc.).
6. Déployer.
7. Vérifier l'URL `/health`.

### Workers (Render Worker / Cron)

- Worker process: `npm run worker`
- Scheduler process: `npm run scheduler`

## 4. Configuration Twilio

1. Incoming webhook WhatsApp:
   - `https://<backend>/webhook/twilio`
2. Status callback (géré automatiquement côté backend via `sendWithTyping`).
3. Si `TWILIO_VALIDATE_SIGNATURE=true`, `TWILIO_WEBHOOK_URL` doit correspondre exactement à l'URL webhook publique.

## 5. Configuration Firebase

1. Auth Email/Password activé.
2. CORS backend autorise le domaine frontend (via `CORS_ORIGIN`).
3. Vérifier Firestore indexes si nécessaire (`firestore.indexes.json`).
4. Vérifier règles Storage pour l'upload de documents.

## 6. Checklist go-live

- [ ] Frontend build OK
- [ ] Backend déployé et `/health` OK
- [ ] Webhook Twilio configuré
- [ ] Login dashboard OK
- [ ] Envoi message texte OK
- [ ] Envoi document/image OK
- [ ] Lecture/état de livraison OK
- [ ] Épinglage / désépinglage OK
- [ ] Profil depuis conversation -> Modifier OK

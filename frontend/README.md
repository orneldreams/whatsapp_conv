# Frontend Dashboard

Dashboard React/Vite pour DiscipLink.

## Installation

```bash
npm install
```

## Variables d'environnement

Copie `.env.example` vers `.env` puis renseigne:

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Le frontend utilise Firebase Authentication pour:

- la connexion email/mot de passe
- la page mot de passe oublie
- l'envoi automatique du token Firebase vers le backend

## Lancer en local

```bash
npm run dev
```

## Build production

```bash
npm run build
```

## Notes

- La page d'inscription existe mais n'est pas exposee publiquement.
- Les comptes pasteur doivent etre crees depuis Firebase Authentication.

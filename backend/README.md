# WhatsApp Discipleship Bot (MVP)

Bot WhatsApp en francais pour le suivi individuel pastoral:
- onboarding sequentiel en 3 questions
- check-in quotidien a 20h
- resume hebdomadaire envoye au pasteur

## 1. Prerequis

- Node.js 18+
- Redis local (ou URL distante)
- Compte Twilio WhatsApp Sandbox/API
- Service account Firebase Admin

## 2. Installation

```bash
npm install
```

## 3. Configuration

1. Copier `.env.example` vers `.env`
2. Remplir toutes les variables
3. Configurer la securite webhook Twilio:

```env
TWILIO_VALIDATE_SIGNATURE=true
TWILIO_WEBHOOK_URL=https://<ton-ngrok>/webhook/twilio
```

4. Mettre le numero du pasteur en dur dans `src/config.js`:

```js
pastorNumber: "whatsapp:+225000000000"
```

## 4. Lancer en local

Terminal 1 (webhook):

```bash
npm run dev
```

Terminal 2 (worker BullMQ):

```bash
npm run worker
```

Terminal 3 (scheduler cron):

```bash
npm run scheduler
```

## 5. Exposer le webhook via ngrok

```bash
ngrok http 3000
```

Configurer ensuite dans Twilio la webhook URL:

```text
https://<ton-ngrok>/webhook/twilio
```

Important: `TWILIO_WEBHOOK_URL` dans `.env` doit etre exactement la meme URL que celle configuree dans Twilio (sinon la validation de signature echoue).

## 6. Structure Firestore

### users/{phoneNumber}
- `name: string`
- `faithStatus: string`
- `prayerIntention: string`
- `onboardingComplete: boolean`
- `createdAt: timestamp`
- `lastContact: timestamp`

### users/{phoneNumber}/checkins/{YYYY-MM-DD}
- `dayFeeling: string`
- `prayed: boolean`
- `verse: string`
- `createdAt: timestamp`

## 7. Notes MVP

- La cle primaire absolue est le numero WhatsApp (`From` Twilio)
- Onboarding et check-in sont sequentiels (une question a la fois)
- Pas de dashboard web
- Toute la conversation est en francais

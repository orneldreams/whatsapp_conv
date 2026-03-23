const dotenv = require("dotenv");

dotenv.config();

function normalizeMultilineSecret(value) {
  if (!value) {
    return undefined;
  }

  const trimmed = String(value).trim();
  const withoutWrappingQuotes = trimmed.replace(/^"([\s\S]*)"$/, "$1");

  return withoutWrappingQuotes.replace(/\\n/g, "\n");
}

const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_WHATSAPP_NUMBER,
    webhookUrl: process.env.TWILIO_WEBHOOK_URL,
    validateSignature: process.env.TWILIO_VALIDATE_SIGNATURE !== "false",
    pastorNumber: process.env.PASTOR_WHATSAPP_NUMBER || ""
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: normalizeMultilineSecret(process.env.FIREBASE_PRIVATE_KEY)
  },
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  schedule: {
    checkinHour: Number(process.env.CHECKIN_HOUR || 20),
    checkinMinute: Number(process.env.CHECKIN_MINUTE || 0),
    weeklySummaryDay: Number(process.env.WEEKLY_SUMMARY_DAY || 0)
  }
};

const requiredEnv = [
  ["TWILIO_ACCOUNT_SID", config.twilio.accountSid],
  ["TWILIO_AUTH_TOKEN", config.twilio.authToken],
  ["TWILIO_WHATSAPP_NUMBER", config.twilio.fromNumber],
  ["FIREBASE_PROJECT_ID", config.firebase.projectId],
  ["FIREBASE_CLIENT_EMAIL", config.firebase.clientEmail],
  ["FIREBASE_PRIVATE_KEY", config.firebase.privateKey]
];

if (config.nodeEnv !== "test") {
  const missing = requiredEnv.filter(([, value]) => !value).map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Variables d'environnement manquantes: ${missing.join(", ")}`);
  }
}

module.exports = config;

const express = require("express");
const twilio = require("twilio");
const config = require("./config");
const dashboardRoutes = require("./routes/dashboard");
const { dashboardAuth } = require("./middleware/dashboardAuth");
const { db, admin } = require("./services/firebase");
const { sendWhatsAppMessage } = require("./services/twilio");
const { startOnboarding, handleOnboardingResponse } = require("./handlers/onboarding");
const { handleCheckinResponse } = require("./handlers/checkin");

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.set("trust proxy", true);

const allowedOrigins = config.corsOrigin.split(",").map((o) => o.trim());

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-dashboard-password");

  if (req.method === "OPTIONS") {
    return res.status(204).send();
  }

  return next();
});

function verifyTwilioSignature(req, res, next) {
  if (!config.twilio.validateSignature) {
    return next();
  }

  const signature = req.get("X-Twilio-Signature");
  if (!signature) {
    return res.status(403).send("Missing Twilio signature");
  }

  const requestUrl =
    config.twilio.webhookUrl || `${req.protocol}://${req.get("host")}${req.originalUrl}`;

  const isValid = twilio.validateRequest(
    config.twilio.authToken,
    signature,
    requestUrl,
    req.body
  );

  if (!isValid) {
    return res.status(403).send("Invalid Twilio signature");
  }

  return next();
}

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api", dashboardAuth, dashboardRoutes);

app.post("/webhook/twilio", verifyTwilioSignature, async (req, res) => {
  const from = req.body.From;
  const incomingBody = (req.body.Body || "").trim();

  if (!from) {
    return res.status(400).send("Missing sender");
  }

  try {
    const userRef = db.collection("users").doc(from);
    const userSnap = await userRef.get();

    let reply;

    if (!userSnap.exists) {
      reply = await startOnboarding(userRef);
    } else {
      const userData = userSnap.data();

      if (!userData.onboardingComplete) {
        reply = await handleOnboardingResponse(userRef, userData, incomingBody);
      } else {
        reply = await handleCheckinResponse(userRef, userData, incomingBody);
      }
    }

    await userRef.set(
      {
        lastContact: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    await sendWhatsAppMessage(from, reply);
    return res.status(200).send("OK");
  } catch (error) {
    console.error("[webhook] Erreur traitement message:", error);
    return res.status(500).send("Internal server error");
  }
});

app.listen(config.port, () => {
  console.log(`Serveur webhook actif sur le port ${config.port}`);
});

const express = require("express");
const twilio = require("twilio");
const config = require("./config");
const dashboardRoutes = require("./routes/dashboard");
const { firebaseAuth } = require("./middleware/firebaseAuth");
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

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

app.use("/api", firebaseAuth, dashboardRoutes);

app.post("/webhook/twilio", verifyTwilioSignature, async (req, res) => {
  const from = req.body.From;
  const incomingBody = (req.body.Body || "").trim();

  if (!from) {
    return res.status(400).send("Missing sender");
  }

  try {
    const normalizedPhone = String(from || "").trim();
    const discipleQuery = await db
      .collectionGroup("disciples")
      .where(admin.firestore.FieldPath.documentId(), "==", normalizedPhone)
      .limit(1)
      .get();

    const defaultPasteurId = "unassigned";
    const userRef = discipleQuery.empty
      ? db.collection("pasteurs").doc(defaultPasteurId).collection("disciples").doc(normalizedPhone)
      : discipleQuery.docs[0].ref;

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
        phoneNumber: normalizedPhone,
        phone: normalizedPhone,
        lastContact: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    await sendWhatsAppMessage(normalizedPhone, reply);
    return res.status(200).send("OK");
  } catch (error) {
    console.error("[webhook] Erreur traitement message:", error);
    return res.status(500).send("Internal server error");
  }
});

app.listen(config.port, () => {
  console.log(`Serveur webhook actif sur le port ${config.port}`);
});

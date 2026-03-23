const express = require("express");
const cors = require("cors");
const twilio = require("twilio");
const config = require("./config");
const dashboardRoutes = require("./routes/dashboard");
const { firebaseAuth } = require("./middleware/firebaseAuth");
const { db, admin } = require("./services/firebase");
const { sendWithTyping, mapDeliveryStatus } = require("./utils/messaging");
const { startOnboarding, handleOnboardingResponse } = require("./handlers/onboarding");
const { handleCheckinResponse } = require("./handlers/checkin");
const { handleVerification } = require("./handlers/verification");

function ensureWhatsappIdentifier(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  if (/^whatsapp:/i.test(raw)) {
    return `whatsapp:${raw.replace(/^whatsapp:/i, "")}`;
  }

  return `whatsapp:${raw}`;
}

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.set("trust proxy", true);

const explicitOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://localhost:5177",
  "http://localhost:5178",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5178",
  // Vercel URLs
  "https://whatsapp-conv.vercel.app",
  "https://whatsapp-conv-fhcub51cu-orneldreams-projects.vercel.app"
];

const configuredOrigins = String(config.corsOrigin || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...explicitOrigins, ...configuredOrigins]));

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  // Accepter tous les déploiements Vercel automatiquement
  if (/^https:\/\/whatsapp-conv[^.]*\.vercel\.app$/.test(origin)) return true;
  return false;
}

if (process.env.NODE_ENV === "development") {
  app.use(cors({ origin: true, credentials: true }));
} else {
  app.use(
    cors({
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS bloqué pour: ${origin}`));
        }
      },
      credentials: true
    })
  );
}

function verifyTwilioSignature(req, res, next) {
  if (!config.twilio.validateSignature) {
    return next();
  }

  const signature = req.get("X-Twilio-Signature");
  if (!signature) {
    return res.status(403).send("Missing Twilio signature");
  }

  const runtimeUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  const candidateUrls = [runtimeUrl];

  if (config.twilio.webhookUrl && config.twilio.webhookUrl !== runtimeUrl) {
    candidateUrls.push(config.twilio.webhookUrl);
  }

  const isValid = candidateUrls.some((url) =>
    twilio.validateRequest(config.twilio.authToken, signature, url, req.body)
  );

  if (!isValid) {
    console.error("[twilio-signature] Invalid signature", {
      runtimeUrl,
      candidateUrls,
      from: String(req.body?.From || ""),
      messageSid: String(req.body?.MessageSid || ""),
      accountSid: String(req.body?.AccountSid || "")
    });
    return res.status(403).send("Invalid Twilio signature");
  }

  return next();
}

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api", firebaseAuth, dashboardRoutes);

const handleTwilioWebhook = async (req, res) => {
  const from = req.body.From;
  const incomingBody = (req.body.Body || "").trim();
  const incomingMessageSid = String(req.body.MessageSid || "").trim();

  if (!from) {
    return res.status(400).send("Missing sender");
  }

  try {
    console.log("[webhook] Incoming WhatsApp", {
      from: String(from || ""),
      hasBody: Boolean(incomingBody),
      messageSid: incomingMessageSid
    });

    const normalizedPhone = ensureWhatsappIdentifier(from);
    const defaultPasteurId = null;
    let pasteurId = defaultPasteurId;
    let userRef = null;

    const pasteurSnap = await db.collection("pasteurs").get();
    for (const pasteurDoc of pasteurSnap.docs) {
      const discipleDoc = await db
        .collection("pasteurs")
        .doc(pasteurDoc.id)
        .collection("disciples")
        .doc(normalizedPhone)
        .get();

      if (discipleDoc.exists) {
        pasteurId = pasteurDoc.id;
        userRef = discipleDoc.ref;
        break;
      }
    }

    // In a single-pastor workspace, route unknown numbers to that pastor
    // instead of silently dropping the incoming WhatsApp message.
    if (!userRef && pasteurSnap.size === 1) {
      pasteurId = pasteurSnap.docs[0].id;
      userRef = db
        .collection("pasteurs")
        .doc(pasteurId)
        .collection("disciples")
        .doc(normalizedPhone);
    }

    if (!userRef) {
      console.warn("[webhook] Numéro non routé", {
        normalizedPhone,
        pasteurCount: pasteurSnap.size
      });
      return res.status(200).send("OK");
    }

    const userSnap = await userRef.get();

    if (incomingBody) {
      const incomingDocId = incomingMessageSid
        ? `disciple_${incomingMessageSid}`
        : `disciple_${Date.now()}`;
      const conversationPath = `pasteurs/${pasteurId}/disciples/${normalizedPhone}/conversations/${incomingDocId}`;

      await userRef.collection("conversations").doc(incomingDocId).set(
        {
          content: incomingBody,
          sender: "disciple",
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          read: false,
          pinned: false,
          deliveryStatus: "received"
        },
        { merge: true }
      );
    }

    let reply = null;
    let replyType = null;

    if (!userSnap.exists) {
      // Nouveau numéro inconnu → onboarding normal
      await userRef.set(
        { addedBy: "whatsapp", verificationStatus: "none" },
        { merge: true }
      );
      reply = await startOnboarding(userRef);
      replyType = "onboarding";
    } else {
      const userData = userSnap.data();
      const activeCheckin = userData?.activeCheckin;

      // 1) Check-in actif prioritaire
      if (activeCheckin && activeCheckin.active === true) {
        reply = await handleCheckinResponse(userRef, userData, incomingBody);
        replyType = "checkin";
      } else if (userData.addedBy === "manual" && userData.verificationStatus === "pending") {
        // 2) Vérification d'identité
        reply = await handleVerification(userRef, userData, incomingBody);
        if (!reply) return res.status(200).send("OK");
        replyType = "verification";
      } else if (userData.verificationStatus === "failed") {
        // Vérification échouée → ignorer silencieusement
        return res.status(200).send("OK");
      } else if (!userData.onboardingComplete) {
        // 3) Onboarding
        reply = await handleOnboardingResponse(userRef, userData, incomingBody);
        replyType = "onboarding";
      } else {
        // 4) Conversation libre (pas de check-in, pas de vérif, pas d'onboarding)
        const unreadPastorMessages = await userRef
          .collection("conversations")
          .where("sender", "==", "pastor")
          .where("read", "==", false)
          .get();

        if (!unreadPastorMessages.empty) {
          let batch = db.batch();
          let writes = 0;

          for (const doc of unreadPastorMessages.docs) {
            batch.update(doc.ref, { read: true });
            writes += 1;

            if (writes >= 450) {
              await batch.commit();
              batch = db.batch();
              writes = 0;
            }
          }

          if (writes > 0) {
            await batch.commit();
          }
        }
      }
    }

    await userRef.set(
      {
        phoneNumber: normalizedPhone,
        phone: normalizedPhone,
        lastContact: admin.firestore.FieldValue.serverTimestamp(),
        waitingForPastor: Boolean(incomingBody),
        lastInboundAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    if (reply) {
      await sendWithTyping(userRef, normalizedPhone, reply, replyType);
    }
    return res.status(200).send("OK");
  } catch (error) {
    console.error("[webhook] Erreur traitement message:", error);
    return res.status(500).send("Internal server error");
  }
};

const handleTwilioStatusWebhook = async (req, res) => {
  const pasteurId = String(req.query.pasteurId || "").trim();
  const discipleId = ensureWhatsappIdentifier(req.query.discipleId);
  const messageId = String(req.query.messageId || "").trim();
  const messageStatus = mapDeliveryStatus(req.body.MessageStatus);

  if (!pasteurId || !discipleId || !messageId) {
    return res.status(200).send("OK");
  }

  try {
    const messageRef = db
      .collection("pasteurs")
      .doc(pasteurId)
      .collection("disciples")
      .doc(discipleId)
      .collection("conversations")
      .doc(messageId);

    const payload = {
      twilioSid: String(req.body.MessageSid || ""),
      deliveryStatus: messageStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (messageStatus === "delivered") {
      payload.deliveredAt = admin.firestore.FieldValue.serverTimestamp();
    }

    if (messageStatus === "read") {
      payload.readAt = admin.firestore.FieldValue.serverTimestamp();
      payload.read = true;
    }

    if (messageStatus === "failed") {
      payload.errorMessage = String(req.body.ErrorMessage || req.body.SmsStatus || "Message non distribué");
      payload.failedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await messageRef.set(payload, { merge: true });
    return res.status(200).send("OK");
  } catch (error) {
    console.error("[twilio-status] Erreur callback statut:", error);
    return res.status(500).send("Internal server error");
  }
};

app.post("/webhook/twilio", verifyTwilioSignature, handleTwilioWebhook);
app.post("/webhooks/twilio/whatsapp", verifyTwilioSignature, handleTwilioWebhook);
app.post("/webhook/twilio/status", verifyTwilioSignature, handleTwilioStatusWebhook);
app.post("/webhooks/twilio/whatsapp/status", verifyTwilioSignature, handleTwilioStatusWebhook);

app.listen(config.port, () => {
  console.log("[startup] Backend ready", {
    nodeEnv: config.nodeEnv,
    port: config.port,
    twilioValidateSignature: config.twilio.validateSignature,
    twilioWebhookUrl: config.twilio.webhookUrl || null,
    twilioFromNumber: config.twilio.fromNumber || null
  });
});

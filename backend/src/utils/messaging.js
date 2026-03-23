const crypto = require("crypto");
const { admin } = require("../services/firebase");
const { sendWhatsAppMessage } = require("../services/twilio");
const config = require("../config");

function buildStatusCallbackUrl(userRef, messageId) {
  const webhookUrl = String(config.twilio.webhookUrl || "").trim();
  if (!webhookUrl) {
    return "";
  }

  const base = webhookUrl.replace(/\/webhooks?\/twilio\/whatsapp$/i, "").replace(/\/webhook\/twilio$/i, "");
  const disciplePath = userRef.path.split("/");
  const pasteurId = disciplePath[1] || "";
  const discipleId = disciplePath[3] || "";
  const params = new URLSearchParams({ pasteurId, discipleId, messageId });
  return `${base}/webhook/twilio/status?${params.toString()}`;
}

function mapDeliveryStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (!status) {
    return "sending";
  }

  if (["accepted", "queued", "sending"].includes(status)) {
    return "sending";
  }

  if (["sent", "delivered", "read", "failed", "undelivered"].includes(status)) {
    return status === "undelivered" ? "failed" : status;
  }

  return status;
}

/**
 * Affiche un indicateur de frappe dans la conversation Firestore,
 * attend un délai réaliste, puis envoie le vrai message.
 *
 * @param {FirebaseFirestore.DocumentReference} userRef
 * @param {string} phone  - numéro WhatsApp destinataire
 * @param {string} message - texte à envoyer
 * @param {string|null} type - type de message (checkin, onboarding, verification…)
 */
async function sendWithTyping(userRef, phone, message, type, replyTo, mediaUrl = [], mediaMeta = null) {
  const typingDelay = Math.min(1000 + message.length * 30, 4000);

  // 1. Créer le doc "typing" → apparaît dans la conversation
  const typingDocRef = await userRef.collection("conversations").add({
    content: "...",
    sender: "pastor",
    type: "typing",
    sentAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // 2. Attendre le délai de frappe simulé
  await new Promise((r) => setTimeout(r, typingDelay));

  // 3. Supprimer le doc typing
  await typingDocRef.delete();

  // 4. Sauvegarder le vrai message dans la conversation
  const createdRef = userRef.collection("conversations").doc(
    `pastor_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`
  );
  const messageData = {
    content: message,
    sender: "pastor",
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    read: true,
    pinned: false,
    deliveryStatus: "sending",
    errorMessage: "",
    twilioSid: ""
  };
  if (type) {
    messageData.type = type;
  }
  if (replyTo && replyTo.id) {
    messageData.replyTo = { id: replyTo.id, content: String(replyTo.content || ""), sender: replyTo.sender };
  }
  if (Array.isArray(mediaUrl) && mediaUrl.length > 0) {
    messageData.mediaUrl = mediaUrl;
  }
  if (mediaMeta && typeof mediaMeta === "object") {
    messageData.mediaMeta = {
      name: String(mediaMeta.name || ""),
      mimeType: String(mediaMeta.mimeType || mediaMeta.type || ""),
      size: Number(mediaMeta.size || 0)
    };
  }
  await createdRef.set(messageData, { merge: true });

  // 5. Envoyer via WhatsApp
  try {
    const twilioMessage = await sendWhatsAppMessage(phone, message, {
      statusCallback: buildStatusCallbackUrl(userRef, createdRef.id),
      mediaUrl
    });

    await createdRef.set(
      {
        twilioSid: String(twilioMessage.sid || ""),
        deliveryStatus: mapDeliveryStatus(twilioMessage.status),
        errorMessage: ""
      },
      { merge: true }
    );
  } catch (error) {
    await createdRef.set(
      {
        deliveryStatus: "failed",
        errorMessage: error?.message ? String(error.message) : "Envoi WhatsApp impossible"
      },
      { merge: true }
    );
    throw error;
  }

  return createdRef;
}

module.exports = { sendWithTyping, mapDeliveryStatus };

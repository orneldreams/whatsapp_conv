const twilio = require("twilio");
const config = require("../config");

const client = twilio(config.twilio.accountSid, config.twilio.authToken);

async function sendWhatsAppMessage(to, body, options = {}) {
  if (!to || !body) {
    throw new Error("Parametres manquants pour l'envoi WhatsApp");
  }

  const payload = {
    from: config.twilio.fromNumber,
    to,
    body
  };

  if (options.statusCallback) {
    payload.statusCallback = options.statusCallback;
  }

  if (Array.isArray(options.mediaUrl) && options.mediaUrl.length > 0) {
    payload.mediaUrl = options.mediaUrl;
  }

  return client.messages.create(payload);
}

module.exports = {
  sendWhatsAppMessage
};

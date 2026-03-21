const twilio = require("twilio");
const config = require("../config");

const client = twilio(config.twilio.accountSid, config.twilio.authToken);

async function sendWhatsAppMessage(to, body) {
  if (!to || !body) {
    throw new Error("Parametres manquants pour l'envoi WhatsApp");
  }

  return client.messages.create({
    from: config.twilio.fromNumber,
    to,
    body
  });
}

module.exports = {
  sendWhatsAppMessage
};

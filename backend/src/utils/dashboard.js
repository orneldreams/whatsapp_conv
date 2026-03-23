const dayjs = require("dayjs");

function formatPhoneForTwilio(value) {
  if (!value) {
    return "";
  }

  const trimmed = String(value).trim();
  if (trimmed.startsWith("whatsapp:+")) {
    return trimmed;
  }

  const normalized = trimmed.replace(/\s+/g, "");
  if (normalized.startsWith("+")) {
    return `whatsapp:${normalized}`;
  }

  return `whatsapp:+${normalized.replace(/^\+?/, "")}`;
}

function toIso(value) {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function computeDiscipleStatus(userData) {
  // Onboarding: not yet completed
  if (!userData.onboardingComplete) {
    return "Onboarding en cours";
  }

  const lastContactDate = userData.lastContact && typeof userData.lastContact.toDate === "function"
    ? userData.lastContact.toDate()
    : null;

  // No lastContact recorded yet = silent
  if (!lastContactDate) {
    return "Silencieux";
  }

  const daysSinceLastContact = dayjs().diff(dayjs(lastContactDate), "day");
  
  // Actif: onboardingComplete=true AND lastContact < 3 days
  if (daysSinceLastContact < 3) {
    return "Actif";
  }

  // Silencieux: onboardingComplete=true AND lastContact > 3 days
  return "Silencieux";
}

function capitalizeFirst(str) {
  const s = String(str || "").trim();
  if (!s) return str;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function serializeUser(doc) {
  const data = doc.data();

  return {
    id: doc.id,
    phoneNumber: doc.id,
    ...data,
    name: capitalizeFirst(data.name),
    displayPhone: doc.id.replace(/^whatsapp:/i, ""),
    phone: formatPhoneForTwilio(data.phone || doc.id),
    status: computeDiscipleStatus(data),
    createdAt: toIso(data.createdAt),
    lastContact: toIso(data.lastContact),
    // Champs vérification d'identité
    addedBy: data.addedBy || "whatsapp",
    verificationStatus: data.verificationStatus || "none",
    verificationStep: data.verificationStep || 0,
    verificationAttempts: data.verificationAttempts || 0,
    verifiedAt: toIso(data.verifiedAt),
    archived: Boolean(data.archived),
    archivedAt: toIso(data.archivedAt),
    waitingForPastor: Boolean(data.waitingForPastor),
    lastInboundAt: toIso(data.lastInboundAt),
    conversationPinned: Boolean(data.conversationPinned),
    conversationPinnedAt: toIso(data.conversationPinnedAt),
    conversationPinnedUntil: toIso(data.conversationPinnedUntil),
    conversationNote: String(data.conversationNote || "")
  };
}

function startOfDay(dateString) {
  const base = dateString ? dayjs(dateString) : dayjs();
  return base.startOf("day");
}

module.exports = {
  formatPhoneForTwilio,
  toIso,
  serializeUser,
  computeDiscipleStatus,
  startOfDay,
  capitalizeFirst
};

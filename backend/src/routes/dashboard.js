const express = require("express");
const dayjs = require("dayjs");
const crypto = require("crypto");
const { admin, db } = require("../services/firebase");
const { sendWhatsAppMessage } = require("../services/twilio");
const { sendWithTyping } = require("../utils/messaging");
const config = require("../config");
const {
  formatPhoneForTwilio,
  serializeUser,
  startOfDay,
  computeDiscipleStatus,
  toIso,
  capitalizeFirst
} = require("../utils/dashboard");
const {
  generateVerificationQuestions,
  sendInitialVerificationMessages
} = require("../handlers/verification");
const { startOnboarding } = require("../handlers/onboarding");

const router = express.Router();
const MAX_DOCUMENT_BYTES = 16 * 1024 * 1024;

function getPasteurRef(req) {
  return db.collection("pasteurs").doc(req.userId);
}

function getDisciplesCollection(req) {
  return getPasteurRef(req).collection("disciples");
}

function getConfigCollection(req) {
  return getPasteurRef(req).collection("config");
}

function getBotDefaults() {
  return {
    onboardingQuestions: [
      "Quel est ton prenom ?",
      "Es-tu nouveau dans la foi ou chrétien depuis un moment ?",
      "Quelle est ta principale intention de prière en ce moment ?"
    ],
    checkinQuestions: [
      "Comment s'est passée ta journée ?",
      "As-tu prié aujourd'hui ? (oui/non)",
      "Un verset ou une pensée du jour ?"
    ],
    checkinHour: config.schedule.checkinHour,
    checkinMinute: config.schedule.checkinMinute,
    pastorPhone: config.twilio.pastorNumber
  };
}

async function getFieldsConfig(req) {
  const fieldsDoc = await getConfigCollection(req).doc("fields").get();
  if (!fieldsDoc.exists) {
    return [];
  }

  const data = fieldsDoc.data();
  if (Array.isArray(data.items)) {
    return data.items;
  }

  if (Array.isArray(data.fields)) {
    return data.fields;
  }

  return [];
}

async function saveFieldsConfig(req, fields) {
  await getConfigCollection(req).doc("fields").set(
    {
      items: fields,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );
}

const baseFieldDefaults = [
  { key: "name", label: "Nom complet", type: "text" },
  { key: "phoneNumber", label: "Numéro WhatsApp", type: "text" },
  { key: "phone", label: "Téléphone", type: "text" },
  { key: "originCountry", label: "Pays d'origine", type: "text" },
  { key: "currentCountry", label: "Pays actuel", type: "text" },
  { key: "conversionDate", label: "Date de conversion", type: "date" },
  { key: "christianLifeStart", label: "Début vie chrétienne", type: "date" },
  { key: "discipleMaker", label: "Faiseur de disciple", type: "boolean" },
  { key: "mainPastor", label: "Pasteur principal", type: "text" },
  { key: "church", label: "Église", type: "text" }
];

async function getBaseFieldLabelsConfig(req) {
  const doc = await getConfigCollection(req).doc("baseFieldLabels").get();
  if (!doc.exists) {
    return {};
  }

  const data = doc.data() || {};
  return data.labels && typeof data.labels === "object" ? data.labels : {};
}

async function saveBaseFieldLabel(req, fieldKey, label) {
  await getConfigCollection(req).doc("baseFieldLabels").set(
    {
      labels: {
        [fieldKey]: String(label || "")
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );
}

async function getBaseFieldsConfig(req) {
  const labels = await getBaseFieldLabelsConfig(req);
  return baseFieldDefaults.map((field) => ({
    ...field,
    label: labels[field.key] || field.label
  }));
}

async function getBotConfig(req) {
  const defaults = getBotDefaults();
  const botDoc = await getConfigCollection(req).doc("bot").get();

  if (!botDoc.exists) {
    return defaults;
  }

  return {
    ...defaults,
    ...botDoc.data()
  };
}

function sanitizeQuestions(questions) {
  if (!Array.isArray(questions)) {
    return [];
  }

  return questions
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function applyConversationVariables(content, discipleData, req) {
  const text = String(content || "").trim();
  if (!text) {
    return "";
  }

  const discipleName = String(discipleData?.name || "").trim();
  const firstName = discipleName ? discipleName.split(/\s+/)[0] : "";
  const originCountry = String(discipleData?.originCountry || discipleData?.currentCountry || "").trim();
  const church = String(discipleData?.church || "").trim();
  const pastorName = String(req.user?.name || req.user?.displayName || req.user?.email || "Pasteur").trim();

  return text
    .replace(/\[prénom\]/gi, firstName)
    .replace(/\[prenom\]/gi, firstName)
    .replace(/\[pays\]/gi, originCountry)
    .replace(/\[église\]/gi, church)
    .replace(/\[eglise\]/gi, church)
    .replace(/\[pasteur\]/gi, pastorName);
}

async function getUnreadCountForDisciple(userRef) {
  const baseQuery = userRef
    .collection("conversations")
    .where("sender", "==", "disciple")
    .where("read", "==", false);

  if (typeof baseQuery.count === "function") {
    try {
      const aggregate = await baseQuery.count().get();
      return aggregate.data().count || 0;
    } catch {
      // Fallback for environments where aggregate queries fail (index/SDK/runtime differences)
    }
  }

  try {
    const snapshot = await baseQuery.get();
    return snapshot.size;
  } catch {
    return 0;
  }
}

function toBooleanParam(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return ["1", "true", "yes", "oui", "on"].includes(String(value).trim().toLowerCase());
}

function parseConversationCursor(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return admin.firestore.Timestamp.fromDate(date);
}

function parsePinDurationMinutes(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  if (parsed === 0) {
    return 0;
  }
  return Math.floor(parsed);
}

function isPinActive(data) {
  if (!data?.pinned) {
    return false;
  }

  const until = data.pinnedUntil;
  if (!until) {
    return true;
  }

  const untilDate = typeof until.toDate === "function" ? until.toDate() : new Date(until);
  if (Number.isNaN(untilDate.getTime())) {
    return true;
  }

  return untilDate.getTime() > Date.now();
}

function serializeConversationDoc(doc) {
  const data = doc.data() || {};
  const activePinned = isPinActive(data);
  return {
    id: doc.id,
    content: data.content || "",
    sender: data.sender || "disciple",
    type: data.type || null,
    read: Boolean(data.read),
    sentAt: toIso(data.sentAt),
    replyTo: data.replyTo || null,
    pinned: activePinned,
    pinnedAt: toIso(data.pinnedAt),
    pinnedUntil: toIso(data.pinnedUntil),
    mediaUrl: Array.isArray(data.mediaUrl) ? data.mediaUrl : [],
    mediaMeta: data.mediaMeta || null,
    deliveryStatus: data.deliveryStatus || null,
    errorMessage: data.errorMessage || "",
    twilioSid: data.twilioSid || ""
  };
}

function ensurePhoneIdentifier(raw) {
  return formatPhoneForTwilio(raw);
}

function normalizeStatusFilter(value) {
  const input = String(value || "").toLowerCase().trim();
  if (!input) {
    return "";
  }

  if (["actif", "active"].includes(input)) {
    return "Actif";
  }

  if (["silencieux", "silent"].includes(input)) {
    return "Silencieux";
  }

  if (["onboarding", "onboarding en cours"].includes(input)) {
    return "Onboarding en cours";
  }

  return "";
}

router.get("/disciples", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
    const search = String(req.query.search || "").trim().toLowerCase();
    const statusFilter = normalizeStatusFilter(req.query.status);
    const countryFilter = String(req.query.country || "").trim().toLowerCase();
    const includeArchived = toBooleanParam(req.query.includeArchived, false);
    const archivedOnly = toBooleanParam(req.query.archivedOnly, false);
    const waitingOnly = toBooleanParam(req.query.waitingOnly, false);

    const targetStart = (page - 1) * limit;
    const chunkSize = Math.max(limit, 100);

    let lastDoc = null;
    let totalMatched = 0;
    const pageItems = [];

    while (true) {
      let query = getDisciplesCollection(req).orderBy("createdAt", "desc").limit(chunkSize);
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();
      if (snapshot.empty) {
        break;
      }

      for (const doc of snapshot.docs) {
        const user = serializeUser(doc);
        const computedStatus = user.status;

        const textToSearch = `${user.name || ""} ${user.phoneNumber || ""} ${user.phone || ""}`
          .toLowerCase()
          .trim();

        const statusMatches = !statusFilter || computedStatus === statusFilter;
        const countryMatches =
          !countryFilter || (String(user.currentCountry || "").toLowerCase().trim() === countryFilter);
        const searchMatches = !search || textToSearch.includes(search);
        const archiveMatches = archivedOnly ? user.archived : includeArchived || !user.archived;
        const waitingMatches = !waitingOnly || user.waitingForPastor;

        if (statusMatches && countryMatches && searchMatches && archiveMatches && waitingMatches) {
          if (totalMatched >= targetStart && pageItems.length < limit) {
            pageItems.push(user);
          }
          totalMatched += 1;
        }
      }

      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      if (snapshot.docs.length < chunkSize) {
        break;
      }
    }

    const totalPages = Math.max(1, Math.ceil(totalMatched / limit));

    const pageItemsWithUnread = await Promise.all(
      pageItems.map(async (item) => {
        const ref = getDisciplesCollection(req).doc(item.id);
        const unreadCount = await getUnreadCountForDisciple(ref);
        return { ...item, unreadCount };
      })
    );

    return res.json({
      items: pageItemsWithUnread,
      pagination: {
        page,
        limit,
        total: totalMatched,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages
      }
    });
  } catch (error) {
    console.error("[stats] Erreur /api/stats:", error);
    return res.json({
      totalDisciples: 0,
      activeToday: 0,
      silentOver3Days: 0,
      nextCheckin: null,
      dailyResponseRate: [],
      recentResponses: [],
      silentDisciples: [],
      degraded: true
    });
  }
});

router.post("/disciples", async (req, res) => {
  try {
    const {
      phoneNumber,
      name,
      originCountry = "",
      currentCountry = "",
      conversionDate = "",
      christianLifeStart = "",
      discipleMaker = false,
      mainPastor = "",
      church = "",
      customFields = {}
    } = req.body;

    if (!phoneNumber || !name) {
      return res.status(400).json({ error: "phoneNumber et name sont requis" });
    }

    if (!/^\+?[0-9]{6,15}$/.test(phoneNumber)) {
      return res.status(400).json({ error: "Numéro invalide" });
    }

    const discipleId = ensurePhoneIdentifier(phoneNumber);
    const userRef = getDisciplesCollection(req).doc(discipleId);

    const payload = {
      phoneNumber: discipleId,
      phone: discipleId,
      name,
      originCountry,
      currentCountry,
      conversionDate,
      christianLifeStart,
      discipleMaker: Boolean(discipleMaker),
      mainPastor,
      church,
      onboardingComplete: true,
      onboardingStep: admin.firestore.FieldValue.delete(),
      addedBy: "manual",
      verificationStatus: "pending",
      verificationStep: 0,
      verificationAttempts: 0,
      verifiedAt: null,
      archived: false,
      waitingForPastor: false,
      conversationPinned: false,
      conversationPinnedAt: null,
      conversationPinnedUntil: null,
      conversationNote: "",
      customFields: customFields && typeof customFields === "object" ? customFields : {},
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastContact: admin.firestore.FieldValue.serverTimestamp()
    };

    await userRef.set(payload, { merge: true });

    // Générer les questions de vérification si assez de champs
    const profileForVerif = { ...payload, id: discipleId, phoneNumber: discipleId };
    const questions = await generateVerificationQuestions(profileForVerif, userRef);

    if (questions) {
      // Lire le doc mis à jour (avec verificationQuestions sauvegardées)
      const withQuestions = await userRef.get();
      const discipleData = { ...withQuestions.data(), id: discipleId, phoneNumber: discipleId };
      // Envoyer les messages de vérification en arrière-plan (ne pas bloquer la réponse)
      sendInitialVerificationMessages(userRef, discipleData, req.userId).catch((err) =>
        console.error("[dashboard] Erreur envoi vérification:", err)
      );
    } else {
      const onboardingMessage = await startOnboarding(userRef);
      sendWhatsAppMessage(discipleId, onboardingMessage).catch((err) =>
        console.error("[dashboard] Erreur envoi onboarding direct:", err)
      );
    }

    const created = await userRef.get();
    return res.status(201).json(serializeUser(created));
  } catch (error) {
    console.error("[stats] Erreur /api/stats:", error);
    return res.json({
      totalDisciples: 0,
      activeToday: 0,
      silentOver3Days: 0,
      nextCheckin: null,
      dailyResponseRate: [],
      recentResponses: [],
      silentDisciples: [],
      degraded: true
    });
  }
});

router.get("/disciples/:id", async (req, res) => {
  try {
    const discipleId = ensurePhoneIdentifier(req.params.id);
    const doc = await getDisciplesCollection(req).doc(discipleId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Disciple introuvable" });
    }

    const unreadCount = await getUnreadCountForDisciple(doc.ref);
    return res.json({ ...serializeUser(doc), unreadCount });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/disciples/:id/conversations", async (req, res) => {
  try {
    const discipleId = ensurePhoneIdentifier(req.params.id);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
    const beforeCursor = parseConversationCursor(req.query.before);
    const userRef = getDisciplesCollection(req).doc(discipleId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "Disciple introuvable" });
    }

    let queryRef = userRef.collection("conversations").orderBy("sentAt", "desc").limit(limit);
    if (beforeCursor) {
      queryRef = queryRef.startAfter(beforeCursor);
    }

    const snapshot = await queryRef.get();
    const now = Date.now();
    const expiredPinnedDocs = snapshot.docs.filter((doc) => {
      const data = doc.data() || {};
      if (!data.pinned || !data.pinnedUntil || typeof data.pinnedUntil.toDate !== "function") {
        return false;
      }
      return data.pinnedUntil.toDate().getTime() <= now;
    });

    if (expiredPinnedDocs.length > 0) {
      let batch = db.batch();
      let writes = 0;

      for (const expiredDoc of expiredPinnedDocs) {
        batch.set(
          expiredDoc.ref,
          {
            pinned: false,
            pinnedAt: null,
            pinnedUntil: null
          },
          { merge: true }
        );
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

    const docs = snapshot.docs.filter((doc) => doc.exists);
    const descItems = docs.map((doc) => serializeConversationDoc(doc));
    const items = [...descItems].reverse();
    const oldest = descItems[descItems.length - 1] || null;

    return res.json({
      items,
      pagination: {
        limit,
        hasMore: snapshot.size >= limit,
        nextCursor: oldest?.sentAt || null
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/disciples/:id/conversations", async (req, res) => {
  try {
    const discipleId = ensurePhoneIdentifier(req.params.id);
    const content = String(req.body?.content || "").trim();
    const mediaUrl = Array.isArray(req.body?.mediaUrl)
      ? req.body.mediaUrl.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const mediaMeta = req.body?.mediaMeta && typeof req.body.mediaMeta === "object"
      ? req.body.mediaMeta
      : null;
    const mediaSize = Number(mediaMeta?.size || 0);

    if (!content && mediaUrl.length === 0) {
      return res.status(400).json({ error: "content ou mediaUrl est requis" });
    }

    if (mediaUrl.length > 0 && mediaSize > MAX_DOCUMENT_BYTES) {
      return res.status(413).json({ error: "Fichier trop volumineux. Limite: 16 Mo." });
    }

    const userRef = getDisciplesCollection(req).doc(discipleId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "Disciple introuvable" });
    }

    const userData = userDoc.data() || {};
    const fallbackDocumentText = mediaMeta?.name
      ? `Document: ${String(mediaMeta.name).trim()}`
      : "Document envoyé";
    const finalContent = content
      ? applyConversationVariables(content, userData, req)
      : fallbackDocumentText;
    const replyTo = req.body?.replyTo || null;

    const createdRef = await sendWithTyping(
      userRef,
      discipleId,
      finalContent,
      null,
      replyTo,
      mediaUrl,
      mediaMeta
    );

    await userRef.set(
      {
        lastContact: admin.firestore.FieldValue.serverTimestamp(),
        waitingForPastor: false
      },
      { merge: true }
    );

    const created = await createdRef.get();
    return res.status(201).json(serializeConversationDoc(created));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put("/disciples/:id/conversations/:messageId/pin", async (req, res) => {
  try {
    const discipleId = ensurePhoneIdentifier(req.params.id);
    const messageId = String(req.params.messageId || "").trim();
    const pinned = toBooleanParam(req.body?.pinned, false);
    const durationMinutes = parsePinDurationMinutes(req.body?.durationMinutes);

    if (!messageId) {
      return res.status(400).json({ error: "messageId est requis" });
    }

    if (pinned && durationMinutes === null) {
      return res.status(400).json({ error: "durationMinutes invalide" });
    }

    const userRef = getDisciplesCollection(req).doc(discipleId);
    const messageRef = userRef.collection("conversations").doc(messageId);
    const messageDoc = await messageRef.get();

    if (!messageDoc.exists) {
      return res.status(404).json({ error: "Message introuvable" });
    }

    const payload = {
      pinned,
      pinnedAt: pinned ? admin.firestore.FieldValue.serverTimestamp() : null,
      pinnedUntil: null
    };

    if (pinned && durationMinutes > 0) {
      payload.pinnedUntil = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + durationMinutes * 60 * 1000)
      );
    }

    await messageRef.set(payload, { merge: true });

    const updated = await messageRef.get();
    return res.json(serializeConversationDoc(updated));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put("/disciples/:id/conversations/read", async (req, res) => {
  try {
    const discipleId = ensurePhoneIdentifier(req.params.id);
    const userRef = getDisciplesCollection(req).doc(discipleId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "Disciple introuvable" });
    }

    const unreadSnapshot = await userRef
      .collection("conversations")
      .where("sender", "==", "disciple")
      .where("read", "==", false)
      .get();

    if (!unreadSnapshot.empty) {
      let batch = db.batch();
      let writes = 0;

      for (const doc of unreadSnapshot.docs) {
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

    await userRef.set(
      {
        waitingForPastor: false
      },
      { merge: true }
    );

    return res.json({ success: true, waitingForPastor: false });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put("/disciples/:id/archive", async (req, res) => {
  try {
    const discipleId = ensurePhoneIdentifier(req.params.id);
    const archived = toBooleanParam(req.body?.archived, true);
    const userRef = getDisciplesCollection(req).doc(discipleId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "Disciple introuvable" });
    }

    await userRef.set(
      {
        archived,
        archivedAt: archived ? admin.firestore.FieldValue.serverTimestamp() : null
      },
      { merge: true }
    );

    const updated = await userRef.get();
    return res.json(serializeUser(updated));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put("/disciples/:id/pin", async (req, res) => {
  try {
    const discipleId = ensurePhoneIdentifier(req.params.id);
    const pinned = toBooleanParam(req.body?.pinned, false);
    const durationMinutes = parsePinDurationMinutes(req.body?.durationMinutes);

    if (pinned && durationMinutes === null) {
      return res.status(400).json({ error: "durationMinutes invalide" });
    }

    const userRef = getDisciplesCollection(req).doc(discipleId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "Disciple introuvable" });
    }

    const payload = {
      conversationPinned: pinned,
      conversationPinnedAt: pinned ? admin.firestore.FieldValue.serverTimestamp() : null,
      conversationPinnedUntil: null
    };

    if (pinned && durationMinutes > 0) {
      payload.conversationPinnedUntil = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + durationMinutes * 60 * 1000)
      );
    }

    await userRef.set(payload, { merge: true });

    const updated = await userRef.get();
    return res.json(serializeUser(updated));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put("/disciples/:id/conversation-note", async (req, res) => {
  try {
    const discipleId = ensurePhoneIdentifier(req.params.id);
    const conversationNote = String(req.body?.conversationNote || "");
    const userRef = getDisciplesCollection(req).doc(discipleId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "Disciple introuvable" });
    }

    await userRef.set(
      {
        conversationNote,
        conversationNoteUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    const updated = await userRef.get();
    return res.json({
      success: true,
      disciple: serializeUser(updated)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/conversations/unread-count", async (req, res) => {
  try {
    const disciplesSnapshot = await getDisciplesCollection(req).get();
    let totalUnread = 0;

    for (const discipleDoc of disciplesSnapshot.docs) {
      if (discipleDoc.data()?.archived) {
        continue;
      }
      totalUnread += await getUnreadCountForDisciple(discipleDoc.ref);
    }

    return res.json({ unreadCount: totalUnread, hasUnread: totalUnread > 0 });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/disciples/:id/checkin/launch", async (req, res) => {
  try {
    const discipleId = ensurePhoneIdentifier(req.params.id);
    const userRef = getDisciplesCollection(req).doc(discipleId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "Disciple introuvable" });
    }

    const userData = userDoc.data() || {};
    const today = dayjs().format("YYYY-MM-DD");

    if (userData.activeCheckin?.active && userData.activeCheckin?.date === today) {
      return res.status(409).json({ error: "Check-in déjà actif aujourd'hui" });
    }

    const todayCheckin = await userRef.collection("checkins").doc(today).get();
    if (todayCheckin.exists) {
      return res.status(409).json({ error: "Check-in déjà complété aujourd'hui" });
    }

    const customQuestions = sanitizeQuestions(req.body?.questions);
    let questions = customQuestions;

    if (questions.length === 0) {
      const botConfig = await getBotConfig(req);
      questions = sanitizeQuestions(botConfig.checkinQuestions);
    }

    if (questions.length === 0) {
      return res.status(400).json({ error: "Aucune question de check-in disponible" });
    }

    await userRef.set(
      {
        activeCheckin: {
          active: true,
          date: today,
          step: 1,
          questions: customQuestions.length > 0 ? customQuestions : admin.firestore.FieldValue.delete()
        },
        lastContact: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    await sendWhatsAppMessage(discipleId, questions[0]);

    await userRef.set(
      {
        waitingForPastor: false
      },
      { merge: true }
    );

    return res.status(201).json({
      success: true,
      activeCheckin: {
        active: true,
        date: today,
        step: 1,
        questions: customQuestions.length > 0 ? customQuestions : null
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put("/disciples/:id", async (req, res) => {
  try {
    const discipleId = ensurePhoneIdentifier(req.params.id);
    const userRef = getDisciplesCollection(req).doc(discipleId);
    const existing = await userRef.get();

    if (!existing.exists) {
      return res.status(404).json({ error: "Disciple introuvable" });
    }

    const allowedFields = [
      "name",
      "originCountry",
      "currentCountry",
      "conversionDate",
      "christianLifeStart",
      "discipleMaker",
      "mainPastor",
      "church",
      "onboardingComplete",
      "customFields"
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, "discipleMaker")) {
      updates.discipleMaker = Boolean(updates.discipleMaker);
    }

    updates.lastContact = admin.firestore.FieldValue.serverTimestamp();

    await userRef.set(updates, { merge: true });
    const updated = await userRef.get();
    return res.json(serializeUser(updated));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete("/disciples/:id", async (req, res) => {
  try {
    const discipleId = ensurePhoneIdentifier(req.params.id);
    const userRef = getDisciplesCollection(req).doc(discipleId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "Disciple introuvable" });
    }

    const checkins = await userRef.collection("checkins").get();
    const batch = db.batch();
    checkins.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(userRef);
    await batch.commit();

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Renvoyer la vérification d'identité (reset + renvoi des messages)
router.post("/disciples/:id/resend-verification", async (req, res) => {
  try {
    const discipleId = ensurePhoneIdentifier(req.params.id);
    const userRef = getDisciplesCollection(req).doc(discipleId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "Disciple introuvable" });
    }

    const data = { ...userDoc.data(), id: userDoc.id, phoneNumber: userDoc.id };
    const questions = await generateVerificationQuestions(data, userRef);

    if (!questions) {
      const onboardingMessage = await startOnboarding(userRef);
      sendWhatsAppMessage(discipleId, onboardingMessage).catch((err) =>
        console.error("[dashboard] Erreur envoi onboarding après renvoi:", err)
      );
      const updated = await userRef.get();
      return res.json(serializeUser(updated));
    }

    // Relire après génération des questions
    const withQuestions = await userRef.get();
    const discipleData = { ...withQuestions.data(), id: discipleId, phoneNumber: discipleId };

    // Envoyer les messages en arrière-plan
    sendInitialVerificationMessages(userRef, discipleData, req.userId).catch((err) =>
      console.error("[dashboard] Erreur renvoi vérification:", err)
    );

    const final = await userRef.get();
    return res.json(serializeUser(final));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/checkins", async (req, res) => {
  try {
    const targetDate = req.query.date || dayjs().format("YYYY-MM-DD");
    const usersSnapshot = await getDisciplesCollection(req).get();

    const items = await Promise.all(
      usersSnapshot.docs.map(async (userDoc) => {
        const userData = userDoc.data();
        const checkinDoc = await userDoc.ref.collection("checkins").doc(targetDate).get();

        return {
          discipleId: userDoc.id,
          name: userData.name || "Inconnu",
          status: checkinDoc.exists ? "repondu" : "pas_repondu",
          checkin: checkinDoc.exists
            ? {
                id: checkinDoc.id,
                ...checkinDoc.data(),
                createdAt: toIso(checkinDoc.data().createdAt)
              }
            : null
        };
      })
    );

    return res.json({ date: targetDate, items });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/checkins/:discipleId", async (req, res) => {
  try {
    const discipleId = ensurePhoneIdentifier(req.params.discipleId);
    const userRef = getDisciplesCollection(req).doc(discipleId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "Disciple introuvable" });
    }

    const snapshot = await userRef.collection("checkins").orderBy("createdAt", "desc").get();

    const items = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: toIso(data.createdAt)
      };
    });

    return res.json({ discipleId, items });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const usersSnapshot = await getDisciplesCollection(req).get();
    const users = usersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    const totalDisciples = users.length;
    const today = dayjs().format("YYYY-MM-DD");

    async function safeCheckinExists(userId, date) {
      try {
        const checkinDoc = await getDisciplesCollection(req)
          .doc(userId)
          .collection("checkins")
          .doc(date)
          .get();
        return checkinDoc.exists;
      } catch {
        return false;
      }
    }

    const silentOver3Days = users.reduce(
      (acc, user) => acc + (computeDiscipleStatus(user) === "Silencieux" ? 1 : 0),
      0
    );

    const activeTodayChecks = await Promise.all(
      users.map((user) => safeCheckinExists(user.id, today))
    );
    const activeToday = activeTodayChecks.filter(Boolean).length;

    const dailyResponseRate = [];
    for (let i = 6; i >= 0; i -= 1) {
      const date = dayjs().subtract(i, "day").format("YYYY-MM-DD");
      const checks = await Promise.all(
        users.map((user) => safeCheckinExists(user.id, date))
      );
      const responded = checks.filter(Boolean).length;

      dailyResponseRate.push({
        date,
        responded,
        total: totalDisciples,
        rate: totalDisciples ? Number(((responded / totalDisciples) * 100).toFixed(1)) : 0
      });
    }

    const nextCheckin = (() => {
      const candidate = dayjs()
        .hour(config.schedule.checkinHour)
        .minute(config.schedule.checkinMinute)
        .second(0)
        .millisecond(0);

      if (candidate.isAfter(dayjs())) {
        return candidate.toISOString();
      }

      return candidate.add(1, "day").toISOString();
    })();

    const perUserRecent = await Promise.all(
      users.map(async (user) => {
        try {
          const latestCheckin = await getDisciplesCollection(req)
            .doc(user.id)
            .collection("checkins")
            .orderBy(admin.firestore.FieldPath.documentId(), "desc")
            .limit(1)
            .get();

          if (latestCheckin.empty) {
            return null;
          }

          const doc = latestCheckin.docs[0];
          const data = doc.data();
          const createdAtDate = data.createdAt && typeof data.createdAt.toDate === "function"
            ? data.createdAt.toDate()
            : null;

          return {
            discipleId: user.id,
            name: capitalizeFirst(user.name || "Inconnu"),
            currentCountry: user.currentCountry || "",
            country: user.country || "",
            originCountry: user.originCountry || "",
            date: doc.id,
            excerpt: String(data.dayFeeling || "").trim() || "(aucune réponse)",
            prayed: typeof data.prayed === "boolean" ? data.prayed : null,
            createdAt: createdAtDate
          };
        } catch {
          // Skip malformed check-in data for a single disciple instead of failing the whole stats endpoint.
          return null;
        }
      })
    );

    const recentResponses = perUserRecent
      .filter(Boolean)
      .sort((a, b) => {
        const aTime = a.createdAt ? a.createdAt.getTime() : dayjs(a.date).valueOf();
        const bTime = b.createdAt ? b.createdAt.getTime() : dayjs(b.date).valueOf();
        return bTime - aTime;
      })
      .slice(0, 15)
      .map(({ createdAt, ...item }) => ({
        ...item,
        responseAt: createdAt ? createdAt.toISOString() : null
      }));

    const silentDisciples = users
      .filter((user) => computeDiscipleStatus(user) === "Silencieux")
      .map((user) => {
        const rawPhone = String(user.phone || user.id || "");
        return {
          discipleId: user.id,
          name: capitalizeFirst(user.name || "Inconnu"),
          phone: rawPhone,
          displayPhone: rawPhone.replace(/^whatsapp:/i, ""),
          lastContact: toIso(user.lastContact)
        };
      })
      .slice(0, 20);

    return res.json({
      totalDisciples,
      activeToday,
      silentOver3Days,
      nextCheckin,
      dailyResponseRate,
      recentResponses,
      silentDisciples
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/config/fields", async (req, res) => {
  try {
    const items = await getFieldsConfig(req);
    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/config/base-fields", async (req, res) => {
  try {
    const items = await getBaseFieldsConfig(req);
    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put("/config/base-fields/:key", async (req, res) => {
  try {
    const key = req.params.key;
    const label = String(req.body?.label || "").trim();

    const exists = baseFieldDefaults.some((field) => field.key === key);
    if (!exists) {
      return res.status(404).json({ error: "Champ de base introuvable" });
    }

    if (!label) {
      return res.status(400).json({ error: "label requis" });
    }

    await saveBaseFieldLabel(req, key, label);
    const items = await getBaseFieldsConfig(req);
    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/config/fields", async (req, res) => {
  try {
    const { key, label, type, options = [], required = false, unit = "" } = req.body;

    if (!key || !label || !type) {
      return res.status(400).json({ error: "key, label et type sont requis" });
    }

    const fields = await getFieldsConfig(req);
    const exists = fields.some((field) => field.key === key);
    if (exists) {
      return res.status(409).json({ error: "Ce champ existe deja" });
    }

    const next = [...fields, { key, label, type, options, required: Boolean(required), unit: type === "number" ? String(unit || "").trim() : "" }];
    await saveFieldsConfig(req, next);

    return res.status(201).json({ items: next });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put("/config/fields", async (req, res) => {
  try {
    const incoming = Array.isArray(req.body?.items) ? req.body.items : null;
    if (!incoming) {
      return res.status(400).json({ error: "items est requis" });
    }

    const sanitized = incoming.map((field) => ({
      key: String(field.key || "").trim(),
      label: String(field.label || "").trim(),
      type: String(field.type || "text"),
      required: Boolean(field.required),
      options: Array.isArray(field.options)
        ? field.options.map((opt) => String(opt || "").trim()).filter(Boolean)
        : [],
      unit: field.type === "number" ? String(field.unit || "").trim() : ""
    }));

    if (sanitized.some((field) => !field.key || !field.label || !field.type)) {
      return res.status(400).json({ error: "Chaque champ doit contenir key, label et type" });
    }

    const uniqueKeys = new Set(sanitized.map((field) => field.key));
    if (uniqueKeys.size !== sanitized.length) {
      return res.status(400).json({ error: "Les keys des champs doivent etre uniques" });
    }

    await saveFieldsConfig(req, sanitized);
    return res.json({ items: sanitized });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put("/config/fields/:key", async (req, res) => {
  try {
    const key = req.params.key;
    const fields = await getFieldsConfig(req);

    const next = fields.map((field) => {
      if (field.key !== key) {
        return field;
      }

      return {
        ...field,
        ...req.body,
        key: field.key,
        required: Object.prototype.hasOwnProperty.call(req.body, "required")
          ? Boolean(req.body.required)
          : field.required
      };
    });

    await saveFieldsConfig(req, next);
    return res.json({ items: next });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete("/config/fields/:key", async (req, res) => {
  try {
    const key = req.params.key;
    const fields = await getFieldsConfig(req);
    const next = fields.filter((field) => field.key !== key);

    const usersSnapshot = await getDisciplesCollection(req).get();
    let batch = db.batch();
    let writes = 0;

    for (const userDoc of usersSnapshot.docs) {
      batch.update(userDoc.ref, {
        [`customFields.${key}`]: admin.firestore.FieldValue.delete()
      });
      writes += 1;

      if (writes === 450) {
        await batch.commit();
        batch = db.batch();
        writes = 0;
      }
    }

    if (writes > 0) {
      await batch.commit();
    }

    await saveFieldsConfig(req, next);

    return res.json({ items: next });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/bot/config", async (req, res) => {
  try {
    const botConfig = await getBotConfig(req);
    return res.json(botConfig);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put("/bot/config", async (req, res) => {
  try {
    const incoming = req.body || {};
    const defaults = getBotDefaults();

    const payload = {
      onboardingQuestions: Array.isArray(incoming.onboardingQuestions)
        ? incoming.onboardingQuestions
        : defaults.onboardingQuestions,
      checkinQuestions: Array.isArray(incoming.checkinQuestions)
        ? incoming.checkinQuestions
        : defaults.checkinQuestions,
      checkinHour: Number.isFinite(Number(incoming.checkinHour))
        ? Number(incoming.checkinHour)
        : defaults.checkinHour,
      checkinMinute: Number.isFinite(Number(incoming.checkinMinute))
        ? Number(incoming.checkinMinute)
        : defaults.checkinMinute,
      pastorPhone: incoming.pastorPhone
        ? formatPhoneForTwilio(incoming.pastorPhone)
        : defaults.pastorPhone,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await getConfigCollection(req).doc("bot").set(payload, { merge: true });

    const botConfig = await getBotConfig(req);
    return res.json(botConfig);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/checkins/send", async (req, res) => {
  try {
    const { discipleId, message } = req.body;

    if (!discipleId || !message) {
      return res.status(400).json({ error: "discipleId et message sont requis" });
    }

    const normalizedId = ensurePhoneIdentifier(discipleId);
    const userRef = getDisciplesCollection(req).doc(normalizedId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "Disciple introuvable" });
    }

    const userData = userDoc.data() || {};
    const finalContent = applyConversationVariables(String(message).trim(), userData, req);

    await sendWhatsAppMessage(normalizedId, finalContent);

    await userRef.collection("conversations").doc(`pastor_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`).set({
      content: finalContent,
      sender: "pastor",
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      read: false,
      pinned: false,
      deliveryStatus: "sent"
    });

    await userRef.set(
      {
        waitingForPastor: false,
        lastContact: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/auth/check", (req, res) => {
  return res.json({
    ok: true,
    user: {
      uid: req.userId,
      email: req.user?.email || null,
      displayName: req.user?.name || req.user?.displayName || ""
    }
  });
});

// ─── Discussions ─────────────────────────────────────────────────────────────

router.get("/discussions", async (req, res) => {
  try {
    const includeArchived = toBooleanParam(req.query.includeArchived, false);
    const archivedOnly = toBooleanParam(req.query.archivedOnly, false);
    const waitingOnly = toBooleanParam(req.query.waitingOnly, false);
    const disciplesSnapshot = await getDisciplesCollection(req).get();

    const items = await Promise.all(
      disciplesSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        const archived = Boolean(data.archived);

        if ((archivedOnly && !archived) || (!archivedOnly && !includeArchived && archived)) {
          return null;
        }

        if (waitingOnly && !data.waitingForPastor) {
          return null;
        }

        // Dernier message de la conversation
        const lastMsgSnap = await doc.ref
          .collection("conversations")
          .orderBy("sentAt", "desc")
          .limit(1)
          .get();

        if (lastMsgSnap.empty) return null;

        const lastMsgDoc = lastMsgSnap.docs[0];
        const lastMsgData = lastMsgDoc.data();

        // Compter les non lus (messages disciple non lus)
        const unreadCount = await getUnreadCountForDisciple(doc.ref);

        return {
          discipleId: doc.id,
          name: data.name || "",
          phoneNumber: data.phoneNumber || data.phone || doc.id,
          archived,
          waitingForPastor: Boolean(data.waitingForPastor),
          conversationPinned: Boolean(data.conversationPinned),
          conversationPinnedAt: toIso(data.conversationPinnedAt),
          conversationPinnedUntil: toIso(data.conversationPinnedUntil),
          conversationNote: String(data.conversationNote || ""),
          lastMessage: {
            content: lastMsgData.content || "",
            sentAt: lastMsgData.sentAt ? lastMsgData.sentAt.toDate().toISOString() : null,
            sender: lastMsgData.sender || "unknown",
            deliveryStatus: lastMsgData.deliveryStatus || null,
            pinned: Boolean(lastMsgData.pinned)
          },
          unreadCount
        };
      })
    );

    // Filtrer les disciples sans messages + trier par sentAt DESC
    const sorted = items
      .filter(Boolean)
      .sort((a, b) => {
        const aPinned = a.conversationPinned
          && (!a.conversationPinnedUntil || new Date(a.conversationPinnedUntil).getTime() > Date.now());
        const bPinned = b.conversationPinned
          && (!b.conversationPinnedUntil || new Date(b.conversationPinnedUntil).getTime() > Date.now());

        if (aPinned !== bPinned) {
          return aPinned ? -1 : 1;
        }

        const aTime = a.lastMessage.sentAt ? new Date(a.lastMessage.sentAt).getTime() : 0;
        const bTime = b.lastMessage.sentAt ? new Date(b.lastMessage.sentAt).getTime() : 0;
        return bTime - aTime;
      });

    return res.json(sorted);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;

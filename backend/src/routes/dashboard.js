const express = require("express");
const dayjs = require("dayjs");
const { admin, db } = require("../services/firebase");
const { sendWhatsAppMessage } = require("../services/twilio");
const config = require("../config");
const {
  formatPhoneForTwilio,
  serializeUser,
  startOfDay,
  computeDiscipleStatus,
  toIso
} = require("../utils/dashboard");

const router = express.Router();

function getBotDefaults() {
  return {
    onboardingQuestions: [
      "Quel est ton prenom ?",
      "Es-tu nouveau dans la foi ou chretien depuis un moment ?",
      "Quelle est ta principale intention de priere en ce moment ?"
    ],
    checkinQuestions: [
      "Comment s'est passee ta journee ?",
      "As-tu prie aujourd'hui ? (oui/non)",
      "Un verset ou une pensee du jour ?"
    ],
    checkinHour: config.schedule.checkinHour,
    checkinMinute: config.schedule.checkinMinute,
    pastorPhone: config.twilio.pastorNumber
  };
}

async function getFieldsConfig() {
  const fieldsDoc = await db.collection("config").doc("fields").get();
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

async function saveFieldsConfig(fields) {
  await db.collection("config").doc("fields").set(
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

async function getBaseFieldLabelsConfig() {
  const doc = await db.collection("config").doc("baseFieldLabels").get();
  if (!doc.exists) {
    return {};
  }

  const data = doc.data() || {};
  return data.labels && typeof data.labels === "object" ? data.labels : {};
}

async function saveBaseFieldLabel(fieldKey, label) {
  await db.collection("config").doc("baseFieldLabels").set(
    {
      labels: {
        [fieldKey]: String(label || "")
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );
}

async function getBaseFieldsConfig() {
  const labels = await getBaseFieldLabelsConfig();
  return baseFieldDefaults.map((field) => ({
    ...field,
    label: labels[field.key] || field.label
  }));
}

async function getBotConfig() {
  const defaults = getBotDefaults();
  const botDoc = await db.collection("config").doc("bot").get();

  if (!botDoc.exists) {
    return defaults;
  }

  return {
    ...defaults,
    ...botDoc.data()
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

    const targetStart = (page - 1) * limit;
    const chunkSize = Math.max(limit, 100);

    let lastDoc = null;
    let totalMatched = 0;
    const pageItems = [];

    while (true) {
      let query = db.collection("users").orderBy("createdAt", "desc").limit(chunkSize);
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

        if (statusMatches && countryMatches && searchMatches) {
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

    return res.json({
      items: pageItems,
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
    return res.status(500).json({ error: error.message });
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

    const discipleId = ensurePhoneIdentifier(phoneNumber);
    const userRef = db.collection("users").doc(discipleId);

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
      customFields: customFields && typeof customFields === "object" ? customFields : {},
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastContact: admin.firestore.FieldValue.serverTimestamp()
    };

    await userRef.set(payload, { merge: true });

    const created = await userRef.get();
    return res.status(201).json(serializeUser(created));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/disciples/:id", async (req, res) => {
  try {
    const discipleId = ensurePhoneIdentifier(req.params.id);
    const doc = await db.collection("users").doc(discipleId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Disciple introuvable" });
    }

    return res.json(serializeUser(doc));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put("/disciples/:id", async (req, res) => {
  try {
    const discipleId = ensurePhoneIdentifier(req.params.id);
    const userRef = db.collection("users").doc(discipleId);
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
    const userRef = db.collection("users").doc(discipleId);
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

router.get("/checkins", async (req, res) => {
  try {
    const targetDate = req.query.date || dayjs().format("YYYY-MM-DD");
    const usersSnapshot = await db.collection("users").get();

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
    const userRef = db.collection("users").doc(discipleId);
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

router.get("/stats", async (_req, res) => {
  try {
    const usersSnapshot = await db.collection("users").get();
    const users = usersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    const totalDisciples = users.length;
    const today = dayjs().format("YYYY-MM-DD");

    let activeToday = 0;
    let silentOver3Days = 0;

    for (const user of users) {
      const status = computeDiscipleStatus(user);
      if (status === "Silencieux") {
        silentOver3Days += 1;
      }

      const checkinDoc = await db
        .collection("users")
        .doc(user.id)
        .collection("checkins")
        .doc(today)
        .get();

      if (checkinDoc.exists) {
        activeToday += 1;
      }
    }

    const dailyResponseRate = [];
    for (let i = 6; i >= 0; i -= 1) {
      const date = dayjs().subtract(i, "day").format("YYYY-MM-DD");
      let responded = 0;

      for (const user of users) {
        const checkinDoc = await db
          .collection("users")
          .doc(user.id)
          .collection("checkins")
          .doc(date)
          .get();

        if (checkinDoc.exists) {
          responded += 1;
        }
      }

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
        const latestCheckin = await db
          .collection("users")
          .doc(user.id)
          .collection("checkins")
          .orderBy("createdAt", "desc")
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
          name: user.name || "Inconnu",
          date: doc.id,
          excerpt: data.dayFeeling || data.verse || "(aucune reponse)",
          prayed: typeof data.prayed === "boolean" ? data.prayed : null,
          createdAt: createdAtDate
        };
      })
    );

    const recentResponses = perUserRecent
      .filter(Boolean)
      .sort((a, b) => {
        const aTime = a.createdAt ? a.createdAt.getTime() : 0;
        const bTime = b.createdAt ? b.createdAt.getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 15)
      .map(({ createdAt, ...item }) => item);

    const silentDisciples = users
      .filter((user) => computeDiscipleStatus(user) === "Silencieux")
      .map((user) => ({
        discipleId: user.id,
        name: user.name || "Inconnu",
        phone: user.phone || user.id,
        lastContact: toIso(user.lastContact)
      }))
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

router.get("/config/fields", async (_req, res) => {
  try {
    const items = await getFieldsConfig();
    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/config/base-fields", async (_req, res) => {
  try {
    const items = await getBaseFieldsConfig();
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

    await saveBaseFieldLabel(key, label);
    const items = await getBaseFieldsConfig();
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

    const fields = await getFieldsConfig();
    const exists = fields.some((field) => field.key === key);
    if (exists) {
      return res.status(409).json({ error: "Ce champ existe deja" });
    }

    const next = [...fields, { key, label, type, options, required: Boolean(required), unit: type === "number" ? String(unit || "").trim() : "" }];
    await saveFieldsConfig(next);

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

    await saveFieldsConfig(sanitized);
    return res.json({ items: sanitized });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put("/config/fields/:key", async (req, res) => {
  try {
    const key = req.params.key;
    const fields = await getFieldsConfig();

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

    await saveFieldsConfig(next);
    return res.json({ items: next });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete("/config/fields/:key", async (req, res) => {
  try {
    const key = req.params.key;
    const fields = await getFieldsConfig();
    const next = fields.filter((field) => field.key !== key);

    const usersSnapshot = await db.collection("users").get();
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

    await saveFieldsConfig(next);

    return res.json({ items: next });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/bot/config", async (_req, res) => {
  try {
    const botConfig = await getBotConfig();
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

    await db.collection("config").doc("bot").set(payload, { merge: true });

    const botConfig = await getBotConfig();
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
    const userRef = db.collection("users").doc(normalizedId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "Disciple introuvable" });
    }

    await sendWhatsAppMessage(normalizedId, String(message).trim());

    await userRef.collection("manualMessages").add({
      body: String(message).trim(),
      sentAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/auth/check", (_req, res) => {
  return res.json({ ok: true });
});

module.exports = router;

/**
 * handlers/verification.js
 *
 * Système de vérification d'identité pour les disciples ajoutés manuellement.
 * Flux : pending (step 1 → 2) → verified | failed
 */

const { admin, db } = require("../services/firebase");
const { sendWhatsAppMessage } = require("../services/twilio");
const { sendWithTyping } = require("../utils/messaging");
const { onboardingQuestions } = require("./onboarding");

// Pool de questions possibles par champ du profil
const QUESTION_POOL = [
  { field: "name",           question: "Quel est ton prénom ?" },
  { field: "church",         question: "Quelle est ton église ?" },
  { field: "currentCountry", question: "Dans quel pays vis-tu actuellement ?" },
  { field: "mainPastor",     question: "Quel est le nom de ton pasteur principal ?" },
  { field: "conversionDate", question: "En quelle année t'es-tu converti(e) ?" },
  { field: "originCountry",  question: "De quel pays es-tu originaire ?" }
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeAnswer(str) {
  return String(str || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => {
    const row = [];
    for (let j = 0; j <= n; j++) row.push(j === 0 ? i : 0);
    return row;
  });
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i][j - 1], dp[i - 1][j]);
    }
  }
  return dp[m][n];
}

function answersMatch(given, expected) {
  const g = normalizeAnswer(given);
  const e = normalizeAnswer(expected);
  if (!g || !e) return false;
  if (g === e) return true;
  if (g.includes(e) || e.includes(g)) return true;
  const longer = Math.max(g.length, e.length);
  return (longer - levenshtein(g, e)) / longer >= 0.7;
}


// ─── Firestore helpers ───────────────────────────────────────────────────────

async function getPasteurName(pasteurId) {
  if (!pasteurId || pasteurId === "unassigned") return "votre pasteur";
  try {
    const doc = await db.collection("pasteurs").doc(pasteurId).get();
    if (doc.exists) {
      const d = doc.data();
      return d.name || d.firstName || d.displayName || "votre pasteur";
    }
  } catch {
    // silent
  }
  return "votre pasteur";
}

async function getPastorPhone(pasteurId) {
  if (!pasteurId) return null;
  try {
    const doc = await db
      .collection("pasteurs")
      .doc(pasteurId)
      .collection("config")
      .doc("bot")
      .get();
    if (doc.exists) return doc.data().pastorPhone || null;
  } catch {
    // silent
  }
  return null;
}

async function alertPastor(pasteurId, discipleName, disciplePhone) {
  const pastorPhone = await getPastorPhone(pasteurId);
  if (!pastorPhone) return;
  try {
    await sendWhatsAppMessage(
      pastorPhone,
      `⚠️ Vérification échouée pour ${discipleName}.\n` +
        `Le numéro ${disciplePhone} n'a pas pu confirmer son identité après 2 tentatives.\n` +
        `Vérifiez que le numéro est correct.`
    );
  } catch (err) {
    console.error("[verification] Erreur alerte pasteur:", err);
  }
}

async function logAttempt(userRef, question, givenAnswer, expectedAnswer, correct) {
  try {
    await userRef
      .collection("verificationLogs")
      .doc(Date.now().toString())
      .set({
        question: question || "",
        givenAnswer: givenAnswer || "",
        expectedAnswer: expectedAnswer || "",
        correct,
        attemptAt: admin.firestore.FieldValue.serverTimestamp()
      });
  } catch {
    // non-critical
  }
}

// ─── Génération des questions ────────────────────────────────────────────────

/**
 * Génère 2 questions depuis le profil, les sauvegarde dans Firestore.
 * Retourne les questions, ou null si profil insuffisant (→ verificationStatus: "none").
 */
async function generateVerificationQuestions(disciple, userRef) {
  const available = QUESTION_POOL.filter(({ field }) => {
    const val = disciple[field];
    return val && String(val).trim().length > 0;
  });

  const nonNameAvailable = available.filter((q) => q.field !== "name");

  // Condition métier: minimum 2 champs remplis en dehors du nom/numéro
  if (nonNameAvailable.length < 2) {
    await userRef.set(
      {
        addedBy: "manual",
        verificationStatus: "none",
        verificationStep: 0,
        verificationQuestions: [],
        verificationAttempts: 0,
        verifiedAt: null
      },
      { merge: true }
    );
    return null;
  }

  const questions = [...available]
    .sort(() => Math.random() - 0.5)
    .slice(0, 2)
    .map(({ field, question }) => ({
      question,
      expectedAnswer: String(disciple[field]).trim(),
      field
    }));

  await userRef.set(
    {
      addedBy: "manual",
      verificationStatus: "pending",
      verificationStep: 0,
      verificationQuestions: questions,
      verificationAttempts: 0,
      verifiedAt: null
    },
    { merge: true }
  );

  return questions;
}

// ─── Envoi initial ───────────────────────────────────────────────────────────

/**
 * Envoie le message de bienvenue + première question, met verificationStep à 1.
 * À appeler depuis POST /disciples après generateVerificationQuestions.
 */
async function sendInitialVerificationMessages(userRef, disciple, pasteurId) {
  const pasteurName = await getPasteurName(pasteurId);
  const firstName = (disciple.name || "").split(" ")[0] || "ami(e)";
  const questions = disciple.verificationQuestions || [];
  const phone = disciple.phoneNumber || disciple.phone;

  const welcomeMsg =
    `Bonjour ${firstName} ! Je suis l'assistant du Pasteur ${pasteurName}. ` +
    `Pour confirmer ton identité, j'ai 2 petites questions pour toi.`;

  await sendWithTyping(userRef, phone, welcomeMsg, "verification");

  if (questions[0]?.question) {
    await sendWithTyping(userRef, phone, questions[0].question, "verification");
  }

  await userRef.set({ verificationStep: 1 }, { merge: true });
}

// ─── Gestion des réponses (webhook) ─────────────────────────────────────────

/**
 * Gère une réponse de vérification reçue via webhook.
 * Retourne le message à envoyer au disciple, ou null si aucune réponse.
 */
async function handleVerification(userRef, userData, message) {
  const pasteurId = userRef.parent?.parent?.id || null;
  const step = Number(userData.verificationStep || 1);
  const questions = userData.verificationQuestions || [];
  const discipleName = userData.name || "ami(e)";
  const disciplePhone = userData.phoneNumber || userData.phone;

  // ── Étape 1 : vérifier réponse à la question 1 ──────────────────────────
  if (step === 1) {
    const q = questions[0];
    const correct = q ? answersMatch(message, q.expectedAnswer) : false;

    await logAttempt(userRef, q?.question, message, q?.expectedAnswer, correct);

    if (correct) {
      await userRef.set({ verificationStep: 2 }, { merge: true });
      const nextQuestion = questions[1]?.question || "Merci ! Une dernière question.";
      return nextQuestion;
    }

    const attempts = Number(userData.verificationAttempts || 0) + 1;
    await userRef.set({ verificationAttempts: attempts }, { merge: true });

    if (attempts >= 2) {
      await userRef.set({ verificationStatus: "failed" }, { merge: true });
      alertPastor(pasteurId, discipleName, disciplePhone).catch(() => {});
      return (
        "Je n'ai pas pu confirmer ton identité. " +
        "Ton pasteur a été informé et te contactera directement."
      );
    }

    const retryQuestion = `Je n'ai pas bien compris ta réponse, peux-tu réessayer ?\n\n${q?.question || ""}`;

    return retryQuestion;
  }

  // ── Étape 2 : vérifier réponse à la question 2 ──────────────────────────
  if (step === 2) {
    const q = questions[1];
    const correct = q ? answersMatch(message, q.expectedAnswer) : false;

    await logAttempt(userRef, q?.question, message, q?.expectedAnswer, correct);

    if (correct) {
      await userRef.set(
        {
          verificationStatus: "verified",
          verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          verificationStep: admin.firestore.FieldValue.delete(),
          onboardingComplete: false,
          onboardingStep: 1
        },
        { merge: true }
      );
      const welcomeOnboarding = (
        "Parfait ! Ton identité est confirmée. Bienvenue 🎉\n\n" +
        onboardingQuestions[0]
      );

      return welcomeOnboarding;
    }

    const attempts = Number(userData.verificationAttempts || 0) + 1;
    await userRef.set({ verificationAttempts: attempts }, { merge: true });

    if (attempts >= 2) {
      await userRef.set({ verificationStatus: "failed" }, { merge: true });
      alertPastor(pasteurId, discipleName, disciplePhone).catch(() => {});
      return (
        "Je n'ai pas pu confirmer ton identité. " +
        "Ton pasteur a été informé et te contactera directement."
      );
    }

    const retryQuestion = `Je n'ai pas bien compris ta réponse, peux-tu réessayer ?\n\n${q?.question || ""}`;
    return retryQuestion;
  }

  return null;
}

module.exports = {
  generateVerificationQuestions,
  sendInitialVerificationMessages,
  handleVerification,
  getPasteurName
};

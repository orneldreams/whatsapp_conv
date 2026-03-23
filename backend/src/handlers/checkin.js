const dayjs = require("dayjs");
const { admin, db } = require("../services/firebase");
const { sendWhatsAppMessage } = require("../services/twilio");
const { sendWithTyping } = require("../utils/messaging");
const config = require("../config");

const defaultCheckinQuestions = [
  "Comment s'est passée ta journée ?",
  "As-tu prié aujourd'hui ? (oui/non)",
  "Un verset ou une pensée du jour ?"
];

function normalizeBooleanAnswer(value) {
  const text = (value || "").trim().toLowerCase();
  if (["oui", "o", "yes", "y"].includes(text)) {
    return true;
  }
  if (["non", "n", "no"].includes(text)) {
    return false;
  }
  return null;
}

async function getBotConfigForPasteur(pasteurId) {
  if (!pasteurId) {
    return {
      checkinQuestions: defaultCheckinQuestions,
      pastorPhone: config.twilio.pastorNumber
    };
  }

  const botDoc = await db
    .collection("pasteurs")
    .doc(pasteurId)
    .collection("config")
    .doc("bot")
    .get();

  const botData = botDoc.exists ? botDoc.data() : {};
  return {
    checkinQuestions: Array.isArray(botData.checkinQuestions)
      ? botData.checkinQuestions
      : defaultCheckinQuestions,
    pastorPhone: botData.pastorPhone || config.twilio.pastorNumber
  };
}

async function getCheckinQuestionsForUser(userRef) {
  const pasteurId = userRef.parent && userRef.parent.parent ? userRef.parent.parent.id : null;
  const botConfig = await getBotConfigForPasteur(pasteurId);
  return botConfig.checkinQuestions;
}

function normalizeQuestions(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.map((q) => String(q || "").trim()).filter(Boolean);
}

function updateAnswersArray(previousAnswers, index, value) {
  const answers = Array.isArray(previousAnswers) ? [...previousAnswers] : [];
  answers[index] = value;
  return answers;
}

function shouldValidatePrayedAnswer(question, step) {
  if (step !== 2) {
    return false;
  }

  const text = String(question || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return text.includes("prie") || text.includes("priere");
}

async function handleCheckinResponse(userRef, userData, message) {
  const checkinState = userData.activeCheckin;

  if (!checkinState || !checkinState.active || !checkinState.date) {
    return "Merci pour ton message. Je t'ecrirai a 20h pour ton check-in du jour.";
  }

  const checkinQuestionsFromState = normalizeQuestions(checkinState.questions);
  const checkinQuestions =
    checkinQuestionsFromState.length > 0
      ? checkinQuestionsFromState
      : await getCheckinQuestionsForUser(userRef);

  const safeQuestions = checkinQuestions.length > 0 ? checkinQuestions : defaultCheckinQuestions;

  const checkinDate = checkinState.date;
  const checkinDocRef = userRef.collection("checkins").doc(checkinDate);
  const currentStep = Number(checkinState.step || 1);
  const normalizedMessage = (message || "").trim();

  if (!normalizedMessage) {
    const sameQuestion = safeQuestions[Math.max(0, currentStep - 1)] || defaultCheckinQuestions[Math.max(0, currentStep - 1)];
    return sameQuestion;
  }

  const questionForStep = safeQuestions[Math.max(0, currentStep - 1)] || "";
  if (shouldValidatePrayedAnswer(questionForStep, currentStep)) {
    const prayedValue = normalizeBooleanAnswer(normalizedMessage);
    if (prayedValue === null) {
      return "Reponds seulement par oui ou non.";
    }
  }

  const checkinSnap = await checkinDocRef.get();
  const previousData = checkinSnap.exists ? checkinSnap.data() : {};
  const answers = updateAnswersArray(previousData.answers, currentStep - 1, normalizedMessage);
  const payload = {
    answers,
    questions: safeQuestions,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };

  if (currentStep === 1) {
    payload.dayFeeling = normalizedMessage;
  }

  if (currentStep === 2) {
    const prayed = normalizeBooleanAnswer(normalizedMessage);
    if (prayed !== null) {
      payload.prayed = prayed;
    }
  }

  if (currentStep === 3) {
    payload.verse = normalizedMessage;
  }

  await checkinDocRef.set(payload, { merge: true });

  if (currentStep < safeQuestions.length) {
    const nextStep = currentStep + 1;
    const nextQuestion = safeQuestions[currentStep] || defaultCheckinQuestions[Math.min(defaultCheckinQuestions.length - 1, currentStep)];

    await userRef.set(
      {
        activeCheckin: {
          active: true,
          date: checkinDate,
          step: nextStep,
          questions: checkinQuestionsFromState.length > 0 ? checkinQuestionsFromState : admin.firestore.FieldValue.delete()
        },
        lastContact: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    return nextQuestion;
  }

  await userRef.set(
    {
      activeCheckin: {
        active: false,
        date: checkinDate,
        step: 0,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        questions: admin.firestore.FieldValue.delete()
      },
      lastContact: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return "Merci pour ton partage. Que le Seigneur te fortifie !";
}

async function startDailyCheckinForAllUsers() {
  const pasteursSnapshot = await db.collection("pasteurs").get();
  const today = dayjs().format("YYYY-MM-DD");
  const tasks = [];
  let totalUsers = 0;

  for (const pasteurDoc of pasteursSnapshot.docs) {
    const pasteurId = pasteurDoc.id;
    const botConfig = await getBotConfigForPasteur(pasteurId);
    const openingQuestion = botConfig.checkinQuestions[0] || defaultCheckinQuestions[0];

    const usersSnapshot = await db
      .collection("pasteurs")
      .doc(pasteurId)
      .collection("disciples")
      .where("onboardingComplete", "==", true)
      .get();

    totalUsers += usersSnapshot.size;

    usersSnapshot.forEach((userDoc) => {
      const phoneNumber = userDoc.id;
      const userRef = userDoc.ref;

      tasks.push(
        userRef.set(
          {
            activeCheckin: {
              active: true,
              date: today,
              step: 1
            }
          },
          { merge: true }
        )
      );

      tasks.push(
        sendWithTyping(userRef, phoneNumber, openingQuestion, "checkin")
      );
    });
  }

  await Promise.all(tasks);
  return totalUsers;
}

async function sendWeeklySummaryToPastor() {
  const pasteursSnapshot = await db.collection("pasteurs").get();
  const startOfWeek = dayjs().startOf("week");
  const endOfWeek = dayjs().endOf("week");
  let totalUsers = 0;

  for (const pasteurDoc of pasteursSnapshot.docs) {
    const pasteurId = pasteurDoc.id;
    const botConfig = await getBotConfigForPasteur(pasteurId);
    const usersSnapshot = await db
      .collection("pasteurs")
      .doc(pasteurId)
      .collection("disciples")
      .where("onboardingComplete", "==", true)
      .get();

    totalUsers += usersSnapshot.size;

    const summaryLines = [
      `Resume hebdomadaire (${startOfWeek.format("DD/MM")} - ${endOfWeek.format("DD/MM")})`
    ];

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const phoneNumber = userDoc.id;

      const checkinsSnapshot = await userDoc.ref
        .collection("checkins")
        .where("createdAt", ">=", startOfWeek.toDate())
        .where("createdAt", "<=", endOfWeek.toDate())
        .orderBy("createdAt", "asc")
        .get();

      summaryLines.push("------------------------");
      summaryLines.push(`Nom: ${userData.name || "Inconnu"}`);
      summaryLines.push(`Numero: ${phoneNumber}`);

      if (checkinsSnapshot.empty) {
        summaryLines.push("Aucun check-in cette semaine.");
        continue;
      }

      checkinsSnapshot.forEach((checkinDoc) => {
        const checkinData = checkinDoc.data();
        summaryLines.push(`Date: ${checkinDoc.id}`);
        summaryLines.push(`- Journee: ${checkinData.dayFeeling || "-"}`);
        summaryLines.push(
          `- A prie: ${typeof checkinData.prayed === "boolean" ? (checkinData.prayed ? "oui" : "non") : "-"}`
        );
        summaryLines.push(`- Verset/Pensee: ${checkinData.verse || "-"}`);
      });
    }

    const summaryMessage = summaryLines.join("\n");
    if (botConfig.pastorPhone) {
      await sendWhatsAppMessage(botConfig.pastorPhone, summaryMessage);
    }
  }

  return totalUsers;
}

module.exports = {
  handleCheckinResponse,
  startDailyCheckinForAllUsers,
  sendWeeklySummaryToPastor
};

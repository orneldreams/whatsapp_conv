const dayjs = require("dayjs");
const { admin, db } = require("../services/firebase");
const { sendWhatsAppMessage } = require("../services/twilio");
const config = require("../config");

const checkinQuestions = [
  "Comment s'est passee ta journee ?",
  "As-tu prie aujourd'hui ? (oui/non)",
  "Un verset ou une pensee du jour ?"
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

async function handleCheckinResponse(userRef, userData, message) {
  const checkinState = userData.activeCheckin;

  if (!checkinState || !checkinState.active || !checkinState.date) {
    return "Merci pour ton message. Je t'ecrirai a 20h pour ton check-in du jour.";
  }

  const checkinDate = checkinState.date;
  const checkinDocRef = userRef.collection("checkins").doc(checkinDate);
  const currentStep = Number(checkinState.step || 1);
  const normalizedMessage = (message || "").trim();

  if (!normalizedMessage) {
    return checkinQuestions[Math.max(0, currentStep - 1)];
  }

  if (currentStep === 1) {
    await checkinDocRef.set(
      {
        dayFeeling: normalizedMessage,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    await userRef.set(
      {
        activeCheckin: {
          active: true,
          date: checkinDate,
          step: 2
        },
        lastContact: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    return checkinQuestions[1];
  }

  if (currentStep === 2) {
    const prayed = normalizeBooleanAnswer(normalizedMessage);

    if (prayed === null) {
      return "Reponds seulement par oui ou non: As-tu prie aujourd'hui ?";
    }

    await checkinDocRef.set(
      {
        prayed,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    await userRef.set(
      {
        activeCheckin: {
          active: true,
          date: checkinDate,
          step: 3
        },
        lastContact: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    return checkinQuestions[2];
  }

  await checkinDocRef.set(
    {
      verse: normalizedMessage,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  await userRef.set(
    {
      activeCheckin: {
        active: false,
        date: checkinDate,
        step: 0
      },
      lastContact: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return "Merci pour ton partage. Que le Seigneur te fortifie !";
}

async function startDailyCheckinForAllUsers() {
  const usersSnapshot = await db
    .collection("users")
    .where("onboardingComplete", "==", true)
    .get();

  const today = dayjs().format("YYYY-MM-DD");
  const tasks = [];

  usersSnapshot.forEach((userDoc) => {
    const phoneNumber = userDoc.id;
    const userRef = db.collection("users").doc(phoneNumber);

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

    tasks.push(sendWhatsAppMessage(phoneNumber, checkinQuestions[0]));
  });

  await Promise.all(tasks);
  return usersSnapshot.size;
}

async function sendWeeklySummaryToPastor() {
  const usersSnapshot = await db
    .collection("users")
    .where("onboardingComplete", "==", true)
    .get();

  const startOfWeek = dayjs().startOf("week");
  const endOfWeek = dayjs().endOf("week");

  const summaryLines = [
    `Resume hebdomadaire (${startOfWeek.format("DD/MM")} - ${endOfWeek.format("DD/MM")})`
  ];

  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    const phoneNumber = userDoc.id;

    const checkinsSnapshot = await db
      .collection("users")
      .doc(phoneNumber)
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
  await sendWhatsAppMessage(config.twilio.pastorNumber, summaryMessage);

  return usersSnapshot.size;
}

module.exports = {
  handleCheckinResponse,
  startDailyCheckinForAllUsers,
  sendWeeklySummaryToPastor
};

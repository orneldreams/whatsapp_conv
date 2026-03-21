const { admin } = require("../services/firebase");

const onboardingQuestions = [
  "Quel est ton prenom ?",
  "Es-tu nouveau dans la foi ou chretien depuis un moment ?",
  "Quelle est ta principale intention de priere en ce moment ?"
];

async function startOnboarding(userRef) {
  await userRef.set(
    {
      onboardingComplete: false,
      onboardingStep: 1,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastContact: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return onboardingQuestions[0];
}

async function handleOnboardingResponse(userRef, userData, message) {
  const currentStep = Number(userData.onboardingStep || 1);
  const normalizedMessage = (message || "").trim();

  if (!normalizedMessage) {
    return onboardingQuestions[Math.max(0, currentStep - 1)];
  }

  if (currentStep === 1) {
    await userRef.set(
      {
        name: normalizedMessage,
        onboardingStep: 2,
        lastContact: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    return onboardingQuestions[1];
  }

  if (currentStep === 2) {
    await userRef.set(
      {
        faithStatus: normalizedMessage,
        onboardingStep: 3,
        lastContact: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    return onboardingQuestions[2];
  }

  await userRef.set(
    {
      prayerIntention: normalizedMessage,
      onboardingStep: admin.firestore.FieldValue.delete(),
      onboardingComplete: true,
      lastContact: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return "Merci, ton profil est complete. Je t'ecrirai chaque soir pour ton check-in spirituel.";
}

module.exports = {
  startOnboarding,
  handleOnboardingResponse
};

const { Worker } = require("bullmq");
const { queueName, connection } = require("./queue");
const {
  startDailyCheckinForAllUsers,
  sendWeeklySummaryToPastor
} = require("../handlers/checkin");

const worker = new Worker(
  queueName,
  async (job) => {
    if (job.name === "daily-checkin") {
      const usersCount = await startDailyCheckinForAllUsers();
      console.log(`[worker] Daily check-in lance pour ${usersCount} personne(s)`);
      return { usersCount };
    }

    if (job.name === "weekly-summary") {
      const usersCount = await sendWeeklySummaryToPastor();
      console.log(`[worker] Resume hebdomadaire envoye (${usersCount} personne(s))`);
      return { usersCount };
    }

    throw new Error(`Type de job inconnu: ${job.name}`);
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`[worker] Job complete: ${job.name} (${job.id})`);
});

worker.on("failed", (job, error) => {
  console.error(`[worker] Job en echec: ${job ? job.name : "inconnu"}`, error);
});

console.log("[worker] Pret a consommer les jobs BullMQ");

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
      return { usersCount };
    }

    if (job.name === "weekly-summary") {
      const usersCount = await sendWeeklySummaryToPastor();
      return { usersCount };
    }

    throw new Error(`Type de job inconnu: ${job.name}`);
  },
  { connection }
);

worker.on("failed", (job, error) => {
  console.error(`[worker] Job en echec: ${job ? job.name : "inconnu"}`, error);
});

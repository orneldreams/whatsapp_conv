const cron = require("node-cron");
const config = require("../config");
const { queue } = require("./queue");

const dailyCron = `${config.schedule.checkinMinute} ${config.schedule.checkinHour} * * *`;
const weeklyCron = `0 8 * * ${config.schedule.weeklySummaryDay}`;

async function scheduleDailyCheckin() {
  await queue.add("daily-checkin", {
    triggeredAt: new Date().toISOString()
  });
}

async function scheduleWeeklySummary() {
  await queue.add("weekly-summary", {
    triggeredAt: new Date().toISOString()
  });
}

cron.schedule(dailyCron, () => {
  scheduleDailyCheckin().catch((error) => {
    console.error("[scheduler] Erreur daily-checkin", error);
  });
});

cron.schedule(weeklyCron, () => {
  scheduleWeeklySummary().catch((error) => {
    console.error("[scheduler] Erreur weekly-summary", error);
  });
});

const { Queue } = require("bullmq");
const IORedis = require("ioredis");
const config = require("../config");

const connection = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null
});

const queueName = "discipleship-jobs";
const queue = new Queue(queueName, { connection });

module.exports = {
  queue,
  queueName,
  connection
};

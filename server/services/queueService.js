const crypto = require('crypto');
const { DateTime } = require('luxon');
const QueueEntry = require('../models/QueueEntry');
const ServiceRequest = require('../models/ServiceRequest');
const Service = require('../models/Service');
const Counter = require('../models/Counter');

// unique queue id helper
function generateQueueId() {
  return 'que_' + crypto.randomBytes(6).toString('hex');
}

// daily atomic token generator using mongo counters
async function generateDailyToken(service) {
  const timezone = service.timezone || 'Australia/Brisbane';
  const localDate = DateTime.now().setZone(timezone).toFormat('yyyy-MM-dd');

  // use first letter of service id for token prefix
  const prefix = (service.serviceId && service.serviceId[0]) ? service.serviceId[0].toUpperCase() : 'Q';

  const counter = await Counter.findOneAndUpdate(
    { serviceId: service.serviceId, date: localDate },
    { $inc: { sequence: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const paddedSequence = String(counter.sequence).padStart(3, '0');
  return `${prefix}${paddedSequence}`;
}

// join virtual queue
async function joinQueue(userId, requestId) {
  const request = await ServiceRequest.findOne({ requestId, userId });
  if (!request) {
    const error = new Error('Service request not found or not owned by user.');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (request.status !== 'AWAITING_BOOKING') {
    const error = new Error(`Cannot join queue when request status is ${request.status}.`);
    error.statusCode = 409;
    error.code = 'INVALID_STATE';
    throw error;
  }

  const service = await Service.findOne({ serviceId: request.serviceId });
  if (!service) {
    const error = new Error('Associated service does not exist.');
    error.statusCode = 404;
    error.code = 'SERVICE_NOT_FOUND';
    throw error;
  }

  if (!service.queueAvailable) {
    const error = new Error('Virtual queue is not enabled for this service.');
    error.statusCode = 400;
    error.code = 'QUEUE_DISABLED';
    throw error;
  }

  // get next token for today
  const token = await generateDailyToken(service);
  const queueId = generateQueueId();

  // update request to booked_queued
  const updatedRequest = await ServiceRequest.findOneAndUpdate(
    { requestId, userId, status: 'AWAITING_BOOKING' },
    { $set: { status: 'BOOKED_QUEUED', updatedAt: new Date() } },
    { new: true }
  );

  if (!updatedRequest) {
    const error = new Error('Request state was modified concurrently.');
    error.statusCode = 409;
    error.code = 'CONCURRENT_CONFLICT';
    throw error;
  }

  const queueEntry = new QueueEntry({
    queueId,
    requestId,
    userId,
    serviceId: service.serviceId,
    token,
    status: 'WAITING'
  });

  await queueEntry.save();

  return {
    queueEntry,
    request: updatedRequest
  };
}

// staff calls next waiting token
async function serveQueueEntry(staffUserId, queueId) {
  const queueEntry = await QueueEntry.findOne({ queueId });
  if (!queueEntry) {
    const error = new Error('Queue entry not found.');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (queueEntry.status !== 'WAITING') {
    const error = new Error(`Queue entry is already in ${queueEntry.status} status.`);
    error.statusCode = 409;
    error.code = 'INVALID_STATE';
    throw error;
  }

  // mark ticket as served
  queueEntry.status = 'SERVED';
  await queueEntry.save();

  // advance request to under_review
  const updatedRequest = await ServiceRequest.findOneAndUpdate(
    { requestId: queueEntry.requestId, status: 'BOOKED_QUEUED' },
    { $set: { status: 'UNDER_REVIEW', updatedAt: new Date() } },
    { new: true }
  );

  return {
    queueEntry,
    request: updatedRequest
  };
}

// student cancels queue ticket
async function cancelQueueEntry(userId, queueId) {
  const queueEntry = await QueueEntry.findOne({ queueId, userId });
  if (!queueEntry) {
    const error = new Error('Queue entry not found.');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (queueEntry.status !== 'WAITING') {
    const error = new Error('Cannot cancel a queue entry that has already been served.');
    error.statusCode = 409;
    error.code = 'INVALID_STATE';
    throw error;
  }

  const updatedRequest = await ServiceRequest.findOneAndUpdate(
    { requestId: queueEntry.requestId, status: 'BOOKED_QUEUED' },
    { $set: { status: 'AWAITING_BOOKING', updatedAt: new Date() } },
    { new: true }
  );

  if (!updatedRequest) {
    const error = new Error('Request state was modified concurrently.');
    error.statusCode = 409;
    error.code = 'CONCURRENT_CONFLICT';
    throw error;
  }

  await QueueEntry.deleteOne({ queueId });

  return {
    success: true,
    message: 'Queue participation cancelled successfully.',
    request: updatedRequest
  };
}

module.exports = {
  joinQueue,
  serveQueueEntry,
  cancelQueueEntry
};

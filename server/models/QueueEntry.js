const mongoose = require('mongoose');

const queueEntrySchema = new mongoose.Schema({
  queueId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  requestId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  serviceId: {
    type: String,
    required: true,
    index: true
  },
  token: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['WAITING', 'SERVED'],
    default: 'WAITING',
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'QueueEntries'
});

queueEntrySchema.index({ serviceId: 1, status: 1 });

queueEntrySchema.pre('save', function (next) {
  this.updatedAt = new Date();
  if (next) next();
});

module.exports = mongoose.model('QueueEntry', queueEntrySchema);

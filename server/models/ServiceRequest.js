const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema({
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
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  supportingEvidence: {
    data: {
      type: String,
      default: null
    },
    mimeType: {
      type: String,
      default: null
    },
    filename: {
      type: String,
      default: null
    },
    fileSize: {
      type: Number,
      default: null
    }
  },
  status: {
    type: String,
    enum: [
      'AWAITING_BOOKING',
      'BOOKED_QUEUED',
      'UNDER_REVIEW',
      'PROCESSING',
      'COMPLETED'
    ],
    default: 'AWAITING_BOOKING',
    required: true,
    index: true
  },
  staffResponse: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: null
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
  collection: 'ServiceRequests'
});

serviceRequestSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  if (next) next();
});

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);

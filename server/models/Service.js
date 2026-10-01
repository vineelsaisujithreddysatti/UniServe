const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  serviceId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  department: {
    type: String,
    required: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  requirements: {
    type: [String],
    default: []
  },
  evidenceRequired: {
    type: Boolean,
    default: false
  },
  appointmentAvailable: {
    type: Boolean,
    default: true
  },
  queueAvailable: {
    type: Boolean,
    default: true
  },
  openingHours: {
    openTime: {
      type: String,
      default: '09:00'
    },
    closeTime: {
      type: String,
      default: '17:00'
    },
    operatingDays: {
      type: [Number],
      default: [1, 2, 3, 4, 5]
    }
  },
  slotMinutes: {
    type: Number,
    default: 30
  },
  timezone: {
    type: String,
    default: 'Australia/Brisbane'
  }
}, {
  collection: 'Services'
});

module.exports = mongoose.model('Service', serviceSchema);

const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  appointmentId: {
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
  slotStart: {
    type: Date,
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  }
}, {
  collection: 'Appointments'
});

// prevent double booking same slot for a service
appointmentSchema.index({ serviceId: 1, slotStart: 1 }, { unique: true });

module.exports = mongoose.model('Appointment', appointmentSchema);

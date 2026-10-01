const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  serviceId: {
    type: String,
    required: true,
    index: true
  },
  date: {
    type: String,
    required: true,
    index: true
  },
  sequence: {
    type: Number,
    default: 0
  }
}, {
  collection: 'Counters'
});

counterSchema.index({ serviceId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Counter', counterSchema);

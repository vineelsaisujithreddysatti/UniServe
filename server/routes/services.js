const express = require('express');
const Service = require('../models/Service');
const { authenticateToken } = require('../middleware/auth');
const { validateDateQuery } = require('../middleware/validation');
const { getAvailableSlots } = require('../services/slotService');

const router = express.Router();

// get all services
router.get('/', async (req, res, next) => {
  try {
    const services = await Service.find().select(
      'serviceId department name description requirements evidenceRequired appointmentAvailable queueAvailable openingHours slotMinutes timezone'
    );
    res.status(200).json(services);
  } catch (error) {
    next(error);
  }
});

// single service details
router.get('/:id', async (req, res, next) => {
  try {
    const service = await Service.findOne({ serviceId: req.params.id }).select(
      'serviceId department name description requirements evidenceRequired appointmentAvailable queueAvailable openingHours slotMinutes timezone'
    );

    if (!service) {
      return res.status(404).json({
        error: 'SERVICE_NOT_FOUND',
        message: 'The requested service was not found.'
      });
    }

    res.status(200).json(service);
  } catch (error) {
    next(error);
  }
});

// available booking slots for a date
router.get('/:id/slots', authenticateToken, validateDateQuery, async (req, res, next) => {
  try {
    const service = await Service.findOne({ serviceId: req.params.id });
    if (!service) {
      return res.status(404).json({
        error: 'SERVICE_NOT_FOUND',
        message: 'The requested service was not found.'
      });
    }

    if (!service.appointmentAvailable) {
      return res.status(400).json({
        error: 'APPOINTMENTS_DISABLED',
        message: 'Appointments are not available for this service.'
      });
    }

    const slots = await getAvailableSlots(service, req.query.date);
    res.status(200).json({
      serviceId: service.serviceId,
      date: req.query.date,
      timezone: service.timezone,
      slotMinutes: service.slotMinutes,
      slots: slots
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

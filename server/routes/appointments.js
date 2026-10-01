const express = require('express');
const Appointment = require('../models/Appointment');
const Service = require('../models/Service');
const ServiceRequest = require('../models/ServiceRequest');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { bookAppointment, cancelAppointment } = require('../services/bookingService');

const router = express.Router();

// get appointments list
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    let query = {};
    if (req.user.role === 'student') {
      query.userId = req.user.userId;
    }

    const appointments = await Appointment.find(query).sort({ slotStart: 1 });

    const serviceIds = [...new Set(appointments.map(a => a.serviceId))];
    const services = await Service.find({ serviceId: { $in: serviceIds } }).select('serviceId name department timezone');
    const serviceMap = services.reduce((acc, s) => {
      acc[s.serviceId] = s;
      return acc;
    }, {});

    const results = appointments.map(appt => {
      const s = serviceMap[appt.serviceId];
      return {
        appointmentId: appt.appointmentId,
        requestId: appt.requestId,
        userId: appt.userId,
        serviceId: appt.serviceId,
        serviceName: s ? s.name : appt.serviceId,
        department: s ? s.department : '',
        timezone: s ? s.timezone : 'UTC',
        slotStart: appt.slotStart,
        createdAt: appt.createdAt
      };
    });

    res.status(200).json(results);
  } catch (error) {
    next(error);
  }
});

// book slot for a request (students only)
router.post('/', authenticateToken, requireRole('student'), async (req, res, next) => {
  try {
    const { requestId, slotStart } = req.body;

    if (!requestId || typeof requestId !== 'string') {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'A valid requestId is required.'
      });
    }

    if (!slotStart) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'A valid slotStart ISO timestamp is required.'
      });
    }

    const result = await bookAppointment(req.user.userId, requestId, slotStart);

    res.status(201).json({
      message: 'Appointment booked successfully.',
      appointment: result.appointment,
      request: {
        requestId: result.request.requestId,
        status: result.request.status
      }
    });
  } catch (error) {
    next(error);
  }
});

// cancel appointment, resets request to awaiting booking
router.delete('/:id', authenticateToken, requireRole('student'), async (req, res, next) => {
  try {
    const result = await cancelAppointment(req.user.userId, req.params.id);

    res.status(200).json({
      message: result.message,
      request: {
        requestId: result.request.requestId,
        status: result.request.status
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

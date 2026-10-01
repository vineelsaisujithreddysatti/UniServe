const express = require('express');
const crypto = require('crypto');
const ServiceRequest = require('../models/ServiceRequest');
const Service = require('../models/Service');
const Appointment = require('../models/Appointment');
const QueueEntry = require('../models/QueueEntry');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { validateImageEvidence } = require('../middleware/validation');

const router = express.Router();

function generateRequestId() {
  return 'req_' + crypto.randomBytes(6).toString('hex');
}

// get requests list
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    let query = {};
    if (req.user.role === 'student') {
      query.userId = req.user.userId;
    }

    const requests = await ServiceRequest.find(query).sort({ createdAt: -1 });

    // batch fetch appointments and queues to attach to results
    const requestIds = requests.map(r => r.requestId);
    const appointments = await Appointment.find({ requestId: { $in: requestIds } });
    const queueEntries = await QueueEntry.find({ requestId: { $in: requestIds } });

    // fetch student names for staff view
    let studentMap = {};
    if (req.user.role === 'staff') {
      const userIds = [...new Set(requests.map(r => r.userId))];
      const students = await User.find({ userId: { $in: userIds } }).select('userId name email');
      studentMap = students.reduce((acc, s) => {
        acc[s.userId] = s;
        return acc;
      }, {});
    }

    const appointmentMap = appointments.reduce((acc, a) => {
      acc[a.requestId] = a;
      return acc;
    }, {});

    const queueMap = queueEntries.reduce((acc, q) => {
      acc[q.requestId] = q;
      return acc;
    }, {});

    const results = requests.map(reqDoc => {
      const appt = appointmentMap[reqDoc.requestId];
      const queue = queueMap[reqDoc.requestId];

      return {
        requestId: reqDoc.requestId,
        userId: reqDoc.userId,
        studentName: studentMap[reqDoc.userId] ? studentMap[reqDoc.userId].name : undefined,
        studentEmail: studentMap[reqDoc.userId] ? studentMap[reqDoc.userId].email : undefined,
        serviceId: reqDoc.serviceId,
        description: reqDoc.description,
        status: reqDoc.status,
        hasEvidence: Boolean(reqDoc.supportingEvidence && reqDoc.supportingEvidence.data),
        staffResponse: reqDoc.staffResponse,
        createdAt: reqDoc.createdAt,
        updatedAt: reqDoc.updatedAt,
        appointment: appt ? {
          appointmentId: appt.appointmentId,
          slotStart: appt.slotStart
        } : null,
        queue: queue ? {
          queueId: queue.queueId,
          token: queue.token,
          status: queue.status
        } : null
      };
    });

    res.status(200).json(results);
  } catch (error) {
    next(error);
  }
});

// get single request
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const query = { requestId: req.params.id };
    if (req.user.role === 'student') {
      query.userId = req.user.userId;
    }

    const request = await ServiceRequest.findOne(query);
    if (!request) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'The requested service request was not found.'
      });
    }

    const [appointment, queue, studentUser, service] = await Promise.all([
      Appointment.findOne({ requestId: request.requestId }),
      QueueEntry.findOne({ requestId: request.requestId }),
      User.findOne({ userId: request.userId }).select('userId name email'),
      Service.findOne({ serviceId: request.serviceId }).select('serviceId name department')
    ]);

    res.status(200).json({
      requestId: request.requestId,
      userId: request.userId,
      studentName: studentUser ? studentUser.name : 'Unknown',
      studentEmail: studentUser ? studentUser.email : 'Unknown',
      serviceId: request.serviceId,
      serviceName: service ? service.name : request.serviceId,
      department: service ? service.department : '',
      description: request.description,
      status: request.status,
      hasEvidence: Boolean(request.supportingEvidence && request.supportingEvidence.data),
      staffResponse: request.staffResponse,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      appointment: appointment ? {
        appointmentId: appointment.appointmentId,
        slotStart: appointment.slotStart
      } : null,
      queue: queue ? {
        queueId: queue.queueId,
        token: queue.token,
        status: queue.status
      } : null
    });
  } catch (error) {
    next(error);
  }
});

// create request (students only)
router.post('/', authenticateToken, requireRole('student'), async (req, res, next) => {
  try {
    const { serviceId, description, evidence } = req.body;

    if (!serviceId || typeof serviceId !== 'string') {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'A valid serviceId is required.'
      });
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'A request description is required.'
      });
    }

    const service = await Service.findOne({ serviceId });
    if (!service) {
      return res.status(404).json({
        error: 'SERVICE_NOT_FOUND',
        message: 'The specified service does not exist.'
      });
    }

    if (service.evidenceRequired && !evidence) {
      return res.status(400).json({
        error: 'EVIDENCE_REQUIRED',
        message: 'Supporting evidence is mandatory for this service.'
      });
    }

    let evidenceData = null;
    if (evidence) {
      const validation = validateImageEvidence(evidence);
      if (!validation.valid) {
        return res.status(validation.code || 400).json({
          error: 'INVALID_EVIDENCE',
          message: validation.message
        });
      }
      evidenceData = {
        data: validation.cleanedData,
        mimeType: validation.mimeType,
        filename: evidence.filename || 'evidence.jpg',
        fileSize: validation.fileSize
      };
    }

    const requestId = generateRequestId();
    const newRequest = new ServiceRequest({
      requestId,
      userId: req.user.userId,
      serviceId,
      description: description.trim(),
      supportingEvidence: evidenceData,
      status: 'AWAITING_BOOKING'
    });

    await newRequest.save();

    res.status(201).json({
      message: 'Service request created successfully.',
      request: {
        requestId: newRequest.requestId,
        userId: newRequest.userId,
        serviceId: newRequest.serviceId,
        description: newRequest.description,
        status: newRequest.status,
        hasEvidence: Boolean(evidenceData),
        createdAt: newRequest.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// update status or add notes (staff only)
router.put('/:id', authenticateToken, requireRole('staff'), async (req, res, next) => {
  try {
    const { status, staffResponse } = req.body;

    // make sure immutable fields aren't being touched
    const forbiddenFields = ['userId', 'serviceId', 'requestId', 'createdAt', 'supportingEvidence'];
    for (const field of forbiddenFields) {
      if (req.body[field] !== undefined) {
        return res.status(400).json({
          error: 'IMMUTABLE_FIELD',
          message: `Field '${field}' cannot be updated.`
        });
      }
    }

    const request = await ServiceRequest.findOne({ requestId: req.params.id });
    if (!request) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Service request not found.'
      });
    }

    // check valid status transitions
    if (status !== undefined && status !== request.status) {
      const allowedStatuses = [
        'AWAITING_BOOKING',
        'BOOKED_QUEUED',
        'UNDER_REVIEW',
        'PROCESSING',
        'COMPLETED'
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          error: 'INVALID_STATUS',
          message: `Unknown status '${status}'.`
        });
      }

      // staff cannot bypass appointment or queue steps directly
      if (
        (request.status === 'AWAITING_BOOKING' && status === 'BOOKED_QUEUED') ||
        (request.status === 'BOOKED_QUEUED' && status === 'AWAITING_BOOKING')
      ) {
        return res.status(400).json({
          error: 'INVALID_TRANSITION',
          message: 'Booking and cancellation state transitions must use the appointment or queue endpoints.'
        });
      }

      const validTransitions = {
        'BOOKED_QUEUED': ['UNDER_REVIEW'],
        'UNDER_REVIEW': ['PROCESSING'],
        'PROCESSING': ['COMPLETED']
      };

      const permitted = validTransitions[request.status];
      if (!permitted || !permitted.includes(status)) {
        return res.status(400).json({
          error: 'INVALID_TRANSITION',
          message: `Transition from ${request.status} to ${status} is not allowed.`
        });
      }

      request.status = status;
    }

    if (staffResponse !== undefined) {
      if (typeof staffResponse !== 'string') {
        return res.status(400).json({
          error: 'INVALID_INPUT',
          message: 'Staff response must be a text string.'
        });
      }
      if (staffResponse.length > 1000) {
        return res.status(400).json({
          error: 'INVALID_INPUT',
          message: 'Staff response must not exceed 1000 characters.'
        });
      }
      request.staffResponse = staffResponse.trim();
    }

    request.updatedAt = new Date();
    await request.save();

    res.status(200).json({
      message: 'Request updated successfully.',
      request: {
        requestId: request.requestId,
        status: request.status,
        staffResponse: request.staffResponse,
        updatedAt: request.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// get attached evidence image (owner or staff)
router.get('/:id/evidence', authenticateToken, async (req, res, next) => {
  try {
    const query = { requestId: req.params.id };
    if (req.user.role === 'student') {
      query.userId = req.user.userId;
    }

    const request = await ServiceRequest.findOne(query);
    if (!request) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Service request not found.'
      });
    }

    if (!request.supportingEvidence || !request.supportingEvidence.data) {
      return res.status(404).json({
        error: 'NO_EVIDENCE',
        message: 'No supporting evidence attached to this request.'
      });
    }

    res.status(200).json({
      requestId: request.requestId,
      mimeType: request.supportingEvidence.mimeType || 'image/jpeg',
      data: request.supportingEvidence.data,
      filename: request.supportingEvidence.filename || 'evidence.jpg',
      fileSize: request.supportingEvidence.fileSize
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

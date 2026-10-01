const express = require('express');
const QueueEntry = require('../models/QueueEntry');
const Service = require('../models/Service');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { joinQueue, serveQueueEntry, cancelQueueEntry } = require('../services/queueService');

const router = express.Router();

// get queue entries
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    let query = {};
    if (req.user.role === 'student') {
      query.userId = req.user.userId;
    }

    const entries = await QueueEntry.find(query).sort({ createdAt: 1 });

    const serviceIds = [...new Set(entries.map(e => e.serviceId))];
    const services = await Service.find({ serviceId: { $in: serviceIds } }).select('serviceId name department');
    const serviceMap = services.reduce((acc, s) => {
      acc[s.serviceId] = s;
      return acc;
    }, {});

    const results = entries.map(entry => {
      const s = serviceMap[entry.serviceId];
      return {
        queueId: entry.queueId,
        requestId: entry.requestId,
        userId: entry.userId,
        serviceId: entry.serviceId,
        serviceName: s ? s.name : entry.serviceId,
        department: s ? s.department : '',
        token: entry.token,
        status: entry.status,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt
      };
    });

    res.status(200).json(results);
  } catch (error) {
    next(error);
  }
});

// join virtual queue (students only)
router.post('/', authenticateToken, requireRole('student'), async (req, res, next) => {
  try {
    const { requestId } = req.body;

    if (!requestId || typeof requestId !== 'string') {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'A valid requestId is required.'
      });
    }

    const result = await joinQueue(req.user.userId, requestId);

    res.status(201).json({
      message: 'Joined queue successfully.',
      queueEntry: result.queueEntry,
      request: {
        requestId: result.request.requestId,
        status: result.request.status
      }
    });
  } catch (error) {
    next(error);
  }
});

// call/serve queue token (staff only)
router.put('/:id', authenticateToken, requireRole('staff'), async (req, res, next) => {
  try {
    const result = await serveQueueEntry(req.user.userId, req.params.id);

    res.status(200).json({
      message: 'Queue entry served. Request moved to Under Review.',
      queueEntry: result.queueEntry,
      request: {
        requestId: result.request.requestId,
        status: result.request.status
      }
    });
  } catch (error) {
    next(error);
  }
});

// cancel waiting queue entry (students only)
router.delete('/:id', authenticateToken, requireRole('student'), async (req, res, next) => {
  try {
    const result = await cancelQueueEntry(req.user.userId, req.params.id);

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

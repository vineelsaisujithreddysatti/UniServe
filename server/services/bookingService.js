const crypto = require('crypto');
const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const ServiceRequest = require('../models/ServiceRequest');
const Service = require('../models/Service');
const { validateSlotAvailability } = require('./slotService');

// helper for appointment ids
function generateAppointmentId() {
  return 'apt_' + crypto.randomBytes(6).toString('hex');
}

// handles booking an appointment slot
async function bookAppointment(userId, requestId, slotStartIso) {
  // make sure request belongs to this user
  const request = await ServiceRequest.findOne({ requestId, userId });
  if (!request) {
    const error = new Error('Service request not found or not owned by user.');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  // can only book if awaiting booking
  if (request.status !== 'AWAITING_BOOKING') {
    const error = new Error(`Cannot book an appointment for request in ${request.status} status.`);
    error.statusCode = 409;
    error.code = 'INVALID_STATE';
    throw error;
  }

  // check service and if appointments are allowed
  const service = await Service.findOne({ serviceId: request.serviceId });
  if (!service) {
    const error = new Error('Associated service does not exist.');
    error.statusCode = 404;
    error.code = 'SERVICE_NOT_FOUND';
    throw error;
  }

  if (!service.appointmentAvailable) {
    const error = new Error('Appointments are not enabled for this service.');
    error.statusCode = 400;
    error.code = 'APPOINTMENTS_DISABLED';
    throw error;
  }

  // double check slot availibility before booking
  const slotValidation = await validateSlotAvailability(service, slotStartIso);
  if (!slotValidation.valid) {
    const error = new Error(slotValidation.message);
    error.statusCode = 409;
    error.code = 'SLOT_UNAVAILABLE';
    throw error;
  }

  const slotStart = slotValidation.slotStart;
  const appointmentId = generateAppointmentId();

  // use transactions if running on replica set / atlas
  let session = null;
  const topologyType = mongoose.connection.client?.topology?.description?.type;
  const supportsTransactions = topologyType === 'ReplicaSetWithPrimary' || topologyType === 'Sharded';

  if (supportsTransactions) {
    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch (sessErr) {
      session = null;
    }
  }

  try {
    const sessionOpts = session ? { session } : {};

    // transition request to booked_queued
    const updatedRequest = await ServiceRequest.findOneAndUpdate(
      { requestId, userId, status: 'AWAITING_BOOKING' },
      { $set: { status: 'BOOKED_QUEUED', updatedAt: new Date() } },
      { new: true, ...sessionOpts }
    );

    if (!updatedRequest) {
      const error = new Error('Request state was modified concurrently.');
      error.statusCode = 409;
      error.code = 'CONCURRENT_CONFLICT';
      throw error;
    }

    // create appointment entry
    const appointment = new Appointment({
      appointmentId,
      requestId,
      userId,
      serviceId: service.serviceId,
      slotStart
    });

    await appointment.save(sessionOpts);

    if (session) {
      await session.commitTransaction();
    }

    return {
      appointment,
      request: updatedRequest
    };
  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortErr) {
        // ignore abort error if already rolled back
      }
    }

    // catch race condition or duplicate key from concurrent slot booking
    if (
      error.code === 11000 ||
      error.code === 112 ||
      (error.hasErrorLabel && error.hasErrorLabel('TransientTransactionError'))
    ) {
      const conflictError = new Error('This slot was booked by another student.');
      conflictError.statusCode = 409;
      conflictError.code = 'BOOKING_CONFLICT';
      throw conflictError;
    }

    throw error;
  } finally {
    if (session) {
      session.endSession();
    }
  }
}

// cancel appointment and reset status
async function cancelAppointment(userId, appointmentId) {
  const appointment = await Appointment.findOne({ appointmentId, userId });
  if (!appointment) {
    const error = new Error('Appointment not found.');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  // make sure request is currently booked
  const request = await ServiceRequest.findOne({ requestId: appointment.requestId });
  if (!request) {
    const error = new Error('Associated service request not found.');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (request.status !== 'BOOKED_QUEUED') {
    const error = new Error(`Cannot cancel appointment when request status is ${request.status}.`);
    error.statusCode = 409;
    error.code = 'INVALID_STATE';
    throw error;
  }

  // put request back to awaiting booking
  const updatedRequest = await ServiceRequest.findOneAndUpdate(
    { requestId: appointment.requestId, status: 'BOOKED_QUEUED' },
    { $set: { status: 'AWAITING_BOOKING', updatedAt: new Date() } },
    { new: true }
  );

  if (!updatedRequest) {
    const error = new Error('Request status changed concurrently.');
    error.statusCode = 409;
    error.code = 'CONCURRENT_CONFLICT';
    throw error;
  }

  // remove appointment doc
  await Appointment.deleteOne({ appointmentId: appointment.appointmentId });

  return {
    success: true,
    message: 'Appointment cancelled successfully.',
    request: updatedRequest
  };
}

module.exports = {
  bookAppointment,
  cancelAppointment
};

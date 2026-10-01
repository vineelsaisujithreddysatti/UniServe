const { DateTime } = require('luxon');
const Appointment = require('../models/Appointment');
const Service = require('../models/Service');

// generates available appointment slots for a service on given date
async function getAvailableSlots(service, dateString) {
  const timezone = service.timezone || 'Australia/Brisbane';
  const slotMinutes = service.slotMinutes || 30;

  const openingHours = service.openingHours || {
    openTime: '09:00',
    closeTime: '17:00',
    operatingDays: [1, 2, 3, 4, 5]
  };

  // parse date in service timezone
  const startOfDay = DateTime.fromISO(dateString, { zone: timezone }).startOf('day');
  if (!startOfDay.isValid) {
    throw new Error('Invalid date format');
  }

  // check if weekday is an operating day (1 = mon, 7 = sun)
  const dayOfWeek = startOfDay.weekday;
  const isOperatingDay = openingHours.operatingDays.includes(dayOfWeek);
  if (!isOperatingDay) {
    return [];
  }

  const [openHour, openMin] = openingHours.openTime.split(':').map(Number);
  const [closeHour, closeMin] = openingHours.closeTime.split(':').map(Number);

  let currentSlot = startOfDay.set({ hour: openHour, minute: openMin, second: 0, millisecond: 0 });
  const closingTime = startOfDay.set({ hour: closeHour, minute: closeMin, second: 0, millisecond: 0 });

  const generatedSlots = [];
  const now = DateTime.now().toUTC();

  while (currentSlot.plus({ minutes: slotMinutes }) <= closingTime) {
    const slotUtc = currentSlot.toUTC();
    // skip slots already passed
    if (slotUtc > now) {
      generatedSlots.push({
        slotStart: slotUtc.toISO(),
        localTime: currentSlot.toFormat('HH:mm'),
        slotMinutes: slotMinutes
      });
    }
    currentSlot = currentSlot.plus({ minutes: slotMinutes });
  }

  if (generatedSlots.length === 0) {
    return [];
  }

  // check booked appointments for the day
  const dayStartUtc = startOfDay.toUTC().toJSDate();
  const dayEndUtc = startOfDay.endOf('day').toUTC().toJSDate();

  const bookedAppointments = await Appointment.find({
    serviceId: service.serviceId,
    slotStart: {
      $gte: dayStartUtc,
      $lte: dayEndUtc
    }
  }).select('slotStart');

  const bookedTimestamps = new Set(
    bookedAppointments.map(appt => new Date(appt.slotStart).toISOString())
  );

  // filter out slots that are already taken
  const availableSlots = generatedSlots.filter(slot => {
    const utcIso = new Date(slot.slotStart).toISOString();
    return !bookedTimestamps.has(utcIso);
  });

  return availableSlots;
}

// re-check slot before confirming booking
async function validateSlotAvailability(service, slotStartIso) {
  const slotDate = new Date(slotStartIso);
  if (isNaN(slotDate.getTime())) {
    return { valid: false, message: 'Invalid slot timestamp.' };
  }

  const now = new Date();
  if (slotDate <= now) {
    return { valid: false, message: 'Selected slot is in the past.' };
  }

  // check if another booking took it
  const existing = await Appointment.findOne({
    serviceId: service.serviceId,
    slotStart: slotDate
  });

  if (existing) {
    return { valid: false, message: 'Selected slot has already been booked.' };
  }

  return { valid: true, slotStart: slotDate };
}

module.exports = {
  getAvailableSlots,
  validateSlotAvailability
};

const Service = require('../models/Service');

const initialServices = [
  {
    serviceId: 'IT001',
    department: 'IT Services',
    name: 'IT Support',
    description: 'Technical assistance with student portals, university credentials, campus Wi-Fi, and software licenses.',
    requirements: [
      'Valid Student ID',
      'Detailed description of the technical issue',
      'Screenshot of the error message if applicable'
    ],
    evidenceRequired: true,
    appointmentAvailable: true,
    queueAvailable: true,
    openingHours: {
      openTime: '08:30',
      closeTime: '17:00',
      operatingDays: [1, 2, 3, 4, 5]
    },
    slotMinutes: 30,
    timezone: 'Australia/Brisbane'
  },
  {
    serviceId: 'ADM001',
    department: 'Academic Registrar',
    name: 'Student Administration',
    description: 'Official enrollment support, course variations, academic transcripts, and graduation assistance.',
    requirements: [
      'Student ID Number',
      'Current Enrolled Course Code',
      'Relevant official forms or supporting documentation'
    ],
    evidenceRequired: true,
    appointmentAvailable: true,
    queueAvailable: true,
    openingHours: {
      openTime: '09:00',
      closeTime: '16:30',
      operatingDays: [1, 2, 3, 4, 5]
    },
    slotMinutes: 20,
    timezone: 'Australia/Brisbane'
  },
  {
    serviceId: 'ACA001',
    department: 'Learning Advisory',
    name: 'Academic Skills and Support',
    description: 'One-on-one academic writing support, referencing assistance, and study technique guidance.',
    requirements: [
      'Unit Code',
      'Assignment Task Sheet or Draft Document'
    ],
    evidenceRequired: false,
    appointmentAvailable: true,
    queueAvailable: false,
    openingHours: {
      openTime: '09:00',
      closeTime: '17:00',
      operatingDays: [1, 2, 3, 4, 5]
    },
    slotMinutes: 45,
    timezone: 'Australia/Brisbane'
  },
  {
    serviceId: 'FIN001',
    department: 'Student Finance',
    name: 'Fees and Financial Aid',
    description: 'Tuition fees consultation, payment plans, scholarship queries, and emergency student financial support.',
    requirements: [
      'Student ID Number',
      'Fee Statement or Invoice Reference',
      'Proof of financial hardship if applying for assistance'
    ],
    evidenceRequired: true,
    appointmentAvailable: true,
    queueAvailable: true,
    openingHours: {
      openTime: '09:30',
      closeTime: '16:00',
      operatingDays: [1, 2, 3, 4, 5]
    },
    slotMinutes: 30,
    timezone: 'Australia/Brisbane'
  },
  {
    serviceId: 'WEL001',
    department: 'Health and Wellbeing',
    name: 'Student Wellbeing',
    description: 'Confidential personal support, mental health counselling, and accessibility accommodation advising.',
    requirements: [
      'Student ID Number'
    ],
    evidenceRequired: false,
    appointmentAvailable: true,
    queueAvailable: true,
    openingHours: {
      openTime: '09:00',
      closeTime: '17:00',
      operatingDays: [1, 2, 3, 4, 5]
    },
    slotMinutes: 45,
    timezone: 'Australia/Brisbane'
  }
];

async function seedServices() {
  for (const s of initialServices) {
    await Service.findOneAndUpdate(
      { serviceId: s.serviceId },
      { $set: s },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  console.log(`Seeded ${initialServices.length} university services.`);
}

module.exports = {
  seedServices,
  initialServices
};

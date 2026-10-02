const bcrypt = require('bcryptjs');
const User = require('../models/User');

const defaultStaffAccount = {
  userId: 'usr_staff001',
  name: 'Staff Reviewer',
  email: process.env.INITIAL_STAFF_EMAIL || 'staff@uniserve.edu.au',
  role: 'staff'
};

const DEFAULT_STAFF_HASH = '$2a$10$.h2Zvg.gyl7ebrOYN6L/e.SNfUnGS2LOhjJTUsmqMRigDDF2CDBda';

async function seedStaff() {
  let passwordHash = DEFAULT_STAFF_HASH;
  if (process.env.INITIAL_STAFF_PASSWORD) {
    const salt = await bcrypt.genSalt(10);
    passwordHash = await bcrypt.hash(process.env.INITIAL_STAFF_PASSWORD, salt);
  }

  await User.findOneAndUpdate(
    { email: defaultStaffAccount.email },
    {
      $set: {
        userId: defaultStaffAccount.userId,
        name: defaultStaffAccount.name,
        email: defaultStaffAccount.email,
        passwordHash: passwordHash,
        role: defaultStaffAccount.role
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log('Seeded initial staff member account.');
}

module.exports = {
  seedStaff,
  defaultStaffAccount
};

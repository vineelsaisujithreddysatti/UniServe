const bcrypt = require('bcryptjs');
const User = require('../models/User');

const defaultStaffAccount = {
  userId: 'usr_staff001',
  name: 'Staff Reviewer',
  email: 'staff@uniserve.edu.au',
  password: 'StaffPassword123!',
  role: 'staff'
};

async function seedStaff() {
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(defaultStaffAccount.password, salt);

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

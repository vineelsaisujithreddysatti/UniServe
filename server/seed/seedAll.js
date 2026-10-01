require('dotenv').config();
const { connectDatabase, closeDatabase } = require('../config/db');
const { seedServices } = require('./seedServices');
const { seedStaff } = require('./seedStaff');

async function runSeed() {
  console.log('seeding database...');
  await connectDatabase();
  await seedServices();
  await seedStaff();
  console.log('seeding finished.');
  await closeDatabase();
  process.exit(0);
}

if (require.main === module) {
  runSeed().catch(err => {
    console.error('Seeding encountered an error:', err);
    process.exit(1);
  });
}

module.exports = { runSeed };

const mongoose = require('mongoose');

let memoryServer = null;

async function connectDatabase() {
  const uri = process.env.NODE_ENV === 'test'
    ? process.env.TEST_MONGODB_URI
    : process.env.MONGODB_URI;

  if (uri) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000
      });
      console.log('Connected to MongoDB database');
      return mongoose.connection;
    } catch (error) {
      console.error('Failed to connect to configured MongoDB URI:', error.message);
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
    }
  }

  // if no uri is set, fallback to mongo memory server for dev and testing
  if (!process.env.MONGODB_URI || mongoose.connection.readyState === 0) {
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create();
      const fallbackUri = memoryServer.getUri();
      await mongoose.connect(fallbackUri);
      console.log('Connected to in-memory MongoDB database for development/testing');
      return mongoose.connection;
    } catch (fallbackError) {
      console.error('In-memory database initialization failed:', fallbackError.message);
      throw fallbackError;
    }
  }

  return mongoose.connection;
}

async function closeDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  if (memoryServer) {
    await memoryServer.stop();
  }
}

module.exports = {
  connectDatabase,
  closeDatabase
};

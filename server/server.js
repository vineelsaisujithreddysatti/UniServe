require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { connectDatabase } = require('./config/db');
const { errorHandler } = require('./middleware/errorHandler');

const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const servicesRoutes = require('./routes/services');
const requestsRoutes = require('./routes/requests');
const appointmentsRoutes = require('./routes/appointments');
const queueRoutes = require('./routes/queue');

const app = express();
const PORT = process.env.PORT || 5000;

// security headers
app.use(helmet({
  contentSecurityPolicy: false // needed for cordova and local client
}));

// cors config for cordova & local client
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:3000', 'http://localhost:8080', 'http://127.0.0.1:8080', 'file://'];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests without origin (cordova, curl, etc)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    // allow localhost ports in dev
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }
    return callback(new Error('CORS policy: origin not allowed'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// json body parser with higher limit for base64 images
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// serve frontend assets
const clientPath = path.join(__dirname, '../client/www');
app.use(express.static(clientPath));

// routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/queue', queueRoutes);

// fallback for client-side routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      error: 'ENDPOINT_NOT_FOUND',
      message: 'API endpoint does not exist.'
    });
  }
  res.sendFile(path.join(clientPath, 'index.html'));
});

// global error handler
app.use(errorHandler);

// start server (works both directly and in tests)
async function startServer() {
  await connectDatabase();

  // make sure default services and staff exist
  const User = require('./models/User');
  const Service = require('./models/Service');
  const userCount = await User.countDocuments();
  const serviceCount = await Service.countDocuments();

  if (serviceCount === 0 || userCount === 0) {
    const { seedServices } = require('./seed/seedServices');
    const { seedStaff } = require('./seed/seedStaff');
    await seedServices();
    await seedStaff();
  }

  // fallback to port 5000 if not specfied in env
  return app.listen(PORT, () => {
    console.log(`UniServe server running on port ${PORT}`);
  });
}

if (require.main === module) {
  startServer().catch(err => {
    console.error('Fatal server startup error:', err);
    process.exit(1);
  });
}

module.exports = {
  app,
  startServer
};

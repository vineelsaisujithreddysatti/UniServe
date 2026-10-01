const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { validateSignupPayload, validateLoginPayload } = require('../middleware/validation');
const { getJwtSecret } = require('../config/jwtSecret');

const router = express.Router();

// rate limit login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts. Please try again after 15 minutes.'
    });
  }
});

// helper to make random user id
function generateUserId() {
  return 'usr_' + crypto.randomBytes(6).toString('hex');
}

// student registration
router.post('/signup', validateSignupPayload, async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    // check if email already registered
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        error: 'DUPLICATE_EMAIL',
        message: 'An account with this email address already exists.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const userId = generateUserId();

    const newUser = new User({
      userId,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'student'
    });

    await newUser.save();

    res.status(201).json({
      message: 'Account registered successfully.',
      user: {
        userId: newUser.userId,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    next(error);
  }
});

// login for students and staff
router.post('/login', loginLimiter, validateLoginPayload, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.'
      });
    }

    const secret = getJwtSecret();
    const payload = {
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role
    };

    const token = jwt.sign(payload, secret, {
      expiresIn: '1h',
      algorithm: 'HS256'
    });

    res.status(200).json({
      token,
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

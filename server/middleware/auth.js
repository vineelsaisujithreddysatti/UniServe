const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication token is required.'
    });
  }

  // expect "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Invalid authorization header format.'
    });
  }

  const token = parts[1];
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({
      error: 'SERVER_MISCONFIGURED',
      message: 'JWT secret not configured.'
    });
  }

  jwt.verify(token, secret, { algorithms: ['HS256'] }, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'TOKEN_EXPIRED',
          message: 'Session expired. Please log in again.'
        });
      }
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Invalid authentication token.'
      });
    }

    // attach decoded user payload
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name
    };

    next();
  });
}

module.exports = {
  authenticateToken
};

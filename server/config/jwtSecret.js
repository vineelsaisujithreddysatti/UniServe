const crypto = require('crypto');

// cryptographically generated fallback to avoid hardcoded secrets in source
const runtimeSecret = crypto.randomBytes(32).toString('hex');

function getJwtSecret() {
  return process.env.JWT_SECRET || runtimeSecret;
}

module.exports = {
  getJwtSecret
};

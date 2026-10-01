function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

function isPlainString(value) {
  return typeof value === 'string';
}

function validateSignupPayload(req, res, next) {
  const { name, email, password } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'Name is required.'
    });
  }

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'A valid email address is required.'
    });
  }

  if (!password || !isValidPassword(password)) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'Password must be at least 8 characters long.'
    });
  }

  next();
}

function validateLoginPayload(req, res, next) {
  const { email, password } = req.body;

  if (!email || !isValidEmail(email) || !password || typeof password !== 'string') {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'Valid email and password are required.'
    });
  }

  next();
}

function validateDateQuery(req, res, next) {
  const { date } = req.query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({
      error: 'INVALID_DATE',
      message: 'Date query parameter is required in YYYY-MM-DD format.'
    });
  }
  next();
}

function validateImageEvidence(evidence) {
  if (!evidence) return { valid: true };

  let base64Data = evidence.data || evidence;
  if (typeof base64Data !== 'string') {
    return { valid: false, message: 'Invalid evidence format.' };
  }

  // strip data uri prefix if present
  if (base64Data.startsWith('data:')) {
    const commaIndex = base64Data.indexOf(',');
    if (commaIndex !== -1) {
      base64Data = base64Data.slice(commaIndex + 1);
    }
  }

  try {
    const buffer = Buffer.from(base64Data, 'base64');
    
    // limit decoded file size to 5mb
    const maxSizeBytes = 5 * 1024 * 1024;
    if (buffer.length > maxSizeBytes) {
      return { valid: false, code: 413, message: 'Supporting evidence exceeds 5MB size limit.' };
    }

    // fail if file is empty or missng header bytes
    if (buffer.length < 3) {
      return { valid: false, message: 'Supporting evidence file is too small or empty.' };
    }

    // check jpeg magic bytes: FF D8 FF
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    // also check png magic bytes: 89 50 4E 47
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;

    if (!isJpeg && !isPng) {
      return { valid: false, message: 'Supporting evidence must be a valid JPEG or PNG image.' };
    }

    return {
      valid: true,
      cleanedData: base64Data,
      mimeType: isJpeg ? 'image/jpeg' : 'image/png',
      fileSize: buffer.length
    };
  } catch (error) {
    return { valid: false, message: 'Failed to process evidence image.' };
  }
}

module.exports = {
  isValidEmail,
  isValidPassword,
  isPlainString,
  validateSignupPayload,
  validateLoginPayload,
  validateDateQuery,
  validateImageEvidence
};

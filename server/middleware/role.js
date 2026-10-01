function requireRole(...allowedRoles) {
  return function (req, res, next) {
    // make sure user is logged in
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required.'
      });
    }

    // check if current role has access
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You do not have permission to access this resource.'
      });
    }

    next();
  };
}

module.exports = {
  requireRole
};

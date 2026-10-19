const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiResponse = require('../utils/apiResponse');

const GUEST_SCAN_LIMIT = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_SCANS = 10;
const guestScansByDevice = new Map();
const scansByDevice = new Map();

const sendDeviceMismatch = (res) => ApiResponse.codedError(
  res,
  'DEVICE_MISMATCH',
  'This account is permanently locked to another device. Multiple device logins are not allowed.',
  403
);

const deviceAuth = async (req, res, next) => {
  const authorization = req.get('authorization');
  if (!authorization) return next();

  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return ApiResponse.error(res, 'A valid Bearer token is required.', 401);
  }

  if (!process.env.JWT_SECRET) {
    return ApiResponse.error(res, 'Authentication is not configured.', 500);
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return ApiResponse.error(res, 'User account was not found.', 401);

    req.user = user;
    if (user.role === 'admin') return next();

    const deviceId = req.get('x-device-id');
    if (!deviceId || !user.isDeviceLocked || !user.registeredDeviceId
      || user.registeredDeviceId !== deviceId) {
      return sendDeviceMismatch(res);
    }

    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return ApiResponse.error(res, 'Invalid or expired authentication token.', 401);
    }
    return next(error);
  }
};

const requireAuth = (req, res, next) => {
  if (!req.user) return ApiResponse.error(res, 'Authentication is required.', 401);
  return next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return ApiResponse.error(res, 'Admin access is required.', 403);
  }
  return next();
};

const guestScanQuota = (req, res, next) => {
  if (req.user?.role === 'admin' || req.user) return next();

  const deviceId = req.get('x-device-id');
  if (!deviceId) return ApiResponse.error(res, 'x-device-id header is required.', 400);

  const scansUsed = guestScansByDevice.get(deviceId) || 0;
  if (scansUsed >= GUEST_SCAN_LIMIT) {
    return ApiResponse.codedError(
      res,
      'GUEST_LIMIT_REACHED',
      'You have reached your 3 free scans limit. Please login or subscribe to continue.',
      403
    );
  }

  guestScansByDevice.set(deviceId, scansUsed + 1);
  return next();
};

const scanRateLimit = (req, res, next) => {
  if (req.user?.role === 'admin') return next();

  const deviceId = req.get('x-device-id');
  if (!deviceId) return ApiResponse.error(res, 'x-device-id header is required.', 400);

  const now = Date.now();
  const activeScans = (scansByDevice.get(deviceId) || [])
    .filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
  if (activeScans.length >= RATE_LIMIT_MAX_SCANS) {
    return ApiResponse.codedError(
      res,
      'RATE_LIMIT_EXCEEDED',
      'You have exceeded the 10 scan limit for this device. Please try again later.',
      429
    );
  }

  activeScans.push(now);
  scansByDevice.set(deviceId, activeScans);
  return next();
};

module.exports = { deviceAuth, requireAuth, requireAdmin, guestScanQuota, scanRateLimit };

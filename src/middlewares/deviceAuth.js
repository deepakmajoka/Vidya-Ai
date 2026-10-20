const jwt = require('jsonwebtoken');
const User = require('../models/User');
const DeviceUsage = require('../models/DeviceUsage');
const ApiResponse = require('../utils/apiResponse');

const GUEST_SCAN_LIMIT = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_SCANS = 10;
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

const guestScanQuota = async (req, res, next) => {
  if (req.user?.role === 'admin' || req.user) return next();

  const deviceId = req.get('x-device-id');
  if (!deviceId) return ApiResponse.error(res, 'x-device-id header is required.', 400);

  try {
    const usage = await DeviceUsage.findOne({ deviceId }).lean();
    if ((usage?.scanCount || 0) >= GUEST_SCAN_LIMIT) {
      return ApiResponse.codedError(
        res,
        'GUEST_LIMIT_REACHED',
        'You have reached your 3 free scans limit. Please login or subscribe to continue.',
        403
      );
    }
    return next();
  } catch (error) {
    return next(error);
  }
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

  req.scanDeviceId = deviceId;
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  let recorded = false;
  const recordAndSend = (send, payload) => {
    if (recorded || res.statusCode < 200 || res.statusCode >= 300) return send(payload);
    recorded = true;
    const record = async () => {
      const timestamps = (scansByDevice.get(deviceId) || [])
        .filter((timestamp) => Date.now() - timestamp < RATE_LIMIT_WINDOW_MS);
      if (timestamps.length >= RATE_LIMIT_MAX_SCANS) {
        throw new Error('Scan rate limit was reached while processing the request.');
      }
      if (!req.user) {
        const existing = await DeviceUsage.findOne({ deviceId });
        if (existing) {
          if (existing.scanCount >= GUEST_SCAN_LIMIT) {
            throw new Error('Guest scan quota was reached while processing the request.');
          }
          existing.scanCount += 1;
          existing.lastScanAt = new Date();
          await existing.save();
        } else {
          await DeviceUsage.create({ deviceId, scanCount: 1, lastScanAt: new Date() });
        }
      }
      timestamps.push(Date.now());
      scansByDevice.set(deviceId, timestamps);
    };
    return record().then(() => send(payload)).catch((error) => {
      if (!res.headersSent) return next(error);
      return undefined;
    });
  };
  res.json = (payload) => recordAndSend(originalJson, payload);
  res.send = (payload) => recordAndSend(originalSend, payload);
  return next();
};

module.exports = { deviceAuth, requireAuth, requireAdmin, guestScanQuota, scanRateLimit };

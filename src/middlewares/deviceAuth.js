const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const DeviceUsage = require('../models/DeviceUsage');
const ApiResponse = require('../utils/apiResponse');

const GUEST_SCAN_LIMIT = 3;
const FREE_STUDENT_SCAN_LIMIT = 10;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_SCANS = 10;
const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX_REQUESTS = 10;
const scansByDevice = new Map();
const authRequestsByIp = new Map();

const authRateLimit = (req, res, next) => {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const activeRequests = (authRequestsByIp.get(key) || [])
    .filter((timestamp) => now - timestamp < AUTH_RATE_LIMIT_WINDOW_MS);
  if (activeRequests.length >= AUTH_RATE_LIMIT_MAX_REQUESTS) {
    return ApiResponse.codedError(res, 'AUTH_RATE_LIMIT_EXCEEDED', 'Too many authentication attempts. Please try again later.', 429);
  }
  activeRequests.push(now);
  authRequestsByIp.set(key, activeRequests);
  if (authRequestsByIp.size > 10000) {
    for (const [ip, timestamps] of authRequestsByIp) {
      if (!timestamps.some((timestamp) => now - timestamp < AUTH_RATE_LIMIT_WINDOW_MS)) {
        authRequestsByIp.delete(ip);
      }
    }
  }
  return next();
};

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
    if (typeof payload.sub !== 'string' || !mongoose.Types.ObjectId.isValid(payload.sub)) {
      return ApiResponse.error(res, 'Invalid authentication token.', 401, 'INVALID_TOKEN');
    }
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
  if (req.user?.role === 'admin' || req.user?.plan === 'premium') return next();

  if (req.user) {
    try {
      // Reserve atomically before calling paid services so parallel requests cannot
      // pass the free-tier limit. Attempts count toward the lifetime free allowance.
      const updatedUser = await User.findOneAndUpdate(
        {
          _id: req.user._id,
          role: 'student',
          $and: [
            { $or: [{ plan: 'free' }, { plan: { $exists: false } }] },
            { $or: [{ scanCount: { $lt: FREE_STUDENT_SCAN_LIMIT } }, { scanCount: { $exists: false } }] }
          ]
        },
        { $inc: { scanCount: 1 } },
        { new: true }
      );
      if (!updatedUser) {
        return ApiResponse.codedError(res, 'FREE_LIMIT_REACHED', 'You have reached the 10 free scans limit. Please upgrade to premium.', 403);
      }
      req.freeScanReserved = true;
      return next();
    } catch (error) {
      return next(error);
    }
  }

  const deviceId = req.get('x-device-id');
  if (!deviceId) return ApiResponse.error(res, 'x-device-id header is required.', 400);

  try {
    const usage = await DeviceUsage.findOneAndUpdate(
      {
        deviceId,
        $or: [{ scanCount: { $lt: GUEST_SCAN_LIMIT } }, { scanCount: { $exists: false } }]
      },
      { $inc: { scanCount: 1 }, $set: { lastScanAt: new Date() } },
      { new: true }
    );
    if (!usage) {
      try {
        await DeviceUsage.create({ deviceId, scanCount: 1, lastScanAt: new Date() });
      } catch (error) {
        if (error.code === 11000) {
          return ApiResponse.codedError(res, 'GUEST_LIMIT_REACHED', 'You have reached your 3 free scans limit. Please login or subscribe to continue.', 403);
        }
        throw error;
      }
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

module.exports = { deviceAuth, requireAuth, requireAdmin, guestScanQuota, scanRateLimit, authRateLimit };

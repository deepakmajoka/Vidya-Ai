const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiResponse = require('../utils/apiResponse');

const PUBLIC_SIGNUP_ROLE = 'student';

const sendDeviceMismatch = (res) => ApiResponse.codedError(
  res,
  'DEVICE_MISMATCH',
  'This account is permanently locked to another device. Multiple device logins are not allowed.',
  403
);

const createToken = (user) => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured.');
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

exports.register = async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || !email.trim() || email.trim().length > 255
    || typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return ApiResponse.error(res, 'Email must be at most 255 characters and password must be 8 to 128 characters.', 400, 'VALIDATION_ERROR');
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      email: normalizedEmail,
      passwordHash,
      role: PUBLIC_SIGNUP_ROLE
    });
    return ApiResponse.success(res, { user: { id: user.id, email: user.email, role: user.role } }, 'Account created.', 201);
  } catch (error) {
    if (error.code === 11000) return ApiResponse.error(res, 'An account with this email already exists.', 409);
    console.error('Registration error:', error);
    return ApiResponse.error(res, 'Internal Server Error', 500);
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || !email.trim() || email.trim().length > 255
    || typeof password !== 'string' || !password || password.length > 128) {
    return ApiResponse.error(res, 'Email must be at most 255 characters and password must be 1 to 128 characters.', 400, 'VALIDATION_ERROR');
  }
  if (!process.env.JWT_SECRET) return ApiResponse.error(res, 'Authentication is not configured.', 500);

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return ApiResponse.error(res, 'Invalid email or password.', 401);
    }

    if (user.role !== 'admin') {
      const deviceId = req.get('x-device-id');
      if (!deviceId) return ApiResponse.error(res, 'x-device-id header is required.', 400);

      if (user.isDeviceLocked && user.registeredDeviceId !== deviceId) {
        return sendDeviceMismatch(res);
      }

      if (!user.isDeviceLocked || !user.registeredDeviceId) {
        const boundUser = await User.findOneAndUpdate(
          {
            _id: user.id,
            $or: [
              { registeredDeviceId: null },
              { registeredDeviceId: '' },
              { registeredDeviceId: { $exists: false } }
            ],
            isDeviceLocked: { $ne: true }
          },
          { $set: { registeredDeviceId: deviceId, isDeviceLocked: true } },
          { new: true }
        );

        if (boundUser) {
          user.registeredDeviceId = boundUser.registeredDeviceId;
          user.isDeviceLocked = boundUser.isDeviceLocked;
        } else {
          const latestUser = await User.findById(user.id);
          if (!latestUser || latestUser.registeredDeviceId !== deviceId || !latestUser.isDeviceLocked) {
            return sendDeviceMismatch(res);
          }
          user.registeredDeviceId = latestUser.registeredDeviceId;
          user.isDeviceLocked = latestUser.isDeviceLocked;
        }
      }
    }

    return ApiResponse.success(res, {
      token: createToken(user),
      user: { id: user.id, email: user.email, role: user.role }
    }, 'Login successful.');
  } catch (error) {
    console.error('Login error:', error);
    return ApiResponse.error(res, 'Internal Server Error', 500);
  }
};

exports.resetDevice = async (req, res) => {
  const { userId } = req.body || {};
  if (typeof userId !== 'string' || !userId.trim()) {
    return ApiResponse.error(res, 'userId is required.', 400);
  }

  try {
    const user = await User.findOneAndUpdate(
      { _id: userId.trim(), role: 'student' },
      { $set: { registeredDeviceId: null, isDeviceLocked: false } },
      { new: true }
    );
    if (!user) return ApiResponse.error(res, 'Student account was not found.', 404);
    return ApiResponse.success(res, { userId: user.id, isDeviceLocked: user.isDeviceLocked }, 'Device binding reset.');
  } catch (error) {
    if (error.name === 'CastError') return ApiResponse.error(res, 'Invalid userId.', 400);
    console.error('Device reset error:', error);
    return ApiResponse.error(res, 'Internal Server Error', 500);
  }
};

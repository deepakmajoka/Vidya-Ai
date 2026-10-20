const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true,
    select: false
  },
  role: {
    type: String,
    enum: ['student', 'admin'],
    default: 'student',
    required: true
  },
  plan: {
    type: String,
    enum: ['free', 'premium'],
    default: 'free',
    required: true
  },
  scanCount: {
    type: Number,
    default: 0,
    min: 0
  },
  registeredDeviceId: {
    type: String,
    default: null
  },
  isDeviceLocked: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);

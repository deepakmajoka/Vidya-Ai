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

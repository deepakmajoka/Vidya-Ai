const mongoose = require('mongoose');

const deviceUsageSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true, index: true },
  scanCount: { type: Number, default: 0, min: 0 },
  lastScanAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.models.DeviceUsage || mongoose.model('DeviceUsage', deviceUsageSchema);

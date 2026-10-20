const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const errorHandler = require('./middleware/errorHandler');
const ApiResponse = require('./utils/apiResponse');
const { deviceAuth } = require('./middlewares/deviceAuth');

const app = express();
const solveRoutes = require('./routes/solveRoutes');
const pdfRoutes = require('./routes/pdfRoutes');
const quizRoutes = require('./routes/quizRoutes');
const languageRoutes = require('./routes/languageRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Security & Parsing Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use('/api', deviceAuth);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/v1/solve', solveRoutes);
app.use('/api/v1/pdf', pdfRoutes);
app.use('/api/v1/quiz', quizRoutes);
app.use('/api/v1/languages', languageRoutes);

// Health Check
app.get('/health', (req, res) => {
  return ApiResponse.success(res, { status: 'OK', uptime: process.uptime() }, 'Service is healthy.');
});

app.use((req, res) => res.status(404).json({
  success: false,
  message: 'Route not found',
  error: 'NOT_FOUND'
}));

app.use(errorHandler);

module.exports = app;

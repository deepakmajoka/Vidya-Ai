const express = require('express');
const { SUPPORTED_LANGUAGES } = require('../constants/languages');
const ApiResponse = require('../utils/apiResponse');

const router = express.Router();

router.get('/', (req, res) => ApiResponse.success(res, SUPPORTED_LANGUAGES, 'Languages retrieved successfully.'));

module.exports = router;

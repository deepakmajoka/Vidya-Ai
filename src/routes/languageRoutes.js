const express = require('express');
const { SUPPORTED_LANGUAGES } = require('../constants/languages');

const router = express.Router();

router.get('/', (req, res) => res.status(200).json(SUPPORTED_LANGUAGES));

module.exports = router;

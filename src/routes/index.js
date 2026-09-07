const express = require('express');
const router = express.Router();

router.use(require('./customerRoutes'));
router.use(require('./policyRoutes'));
router.use(require('./paymentRoutes'));

module.exports = router;

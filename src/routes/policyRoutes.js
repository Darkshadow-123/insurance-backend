const express = require('express');
const router = express.Router();
const policyController = require('../controllers/policyController');

router.post('/policies', policyController.createPolicy);
router.get('/policies/:id', policyController.getPolicy);
router.get('/policies/:id/ledger', policyController.getPolicyLedger);
router.get('/policies/:id/summary', policyController.getPolicySummary);

module.exports = router;

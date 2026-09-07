const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.post('/payments', paymentController.createPayment);
// Bonus: insert-only correction endpoint (not overwriting original payment)
router.post('/payments/:id/reverse', paymentController.reversePayment);

module.exports = router;

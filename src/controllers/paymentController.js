const paymentService = require('../services/paymentService');

async function createPayment(req, res, next) {
  try {
    const payment = await paymentService.createPayment(req.body);
    res.status(201).json({ success: true, data: payment });
  } catch (err) {
    next(err);
  }
}

async function reversePayment(req, res, next) {
  try {
    const reversal = await paymentService.reversePayment({
      paymentId: req.params.id,
      remarks: req.body ? req.body.remarks : undefined,
    });
    res.status(201).json({ success: true, data: reversal });
  } catch (err) {
    next(err);
  }
}

module.exports = { createPayment, reversePayment };

const policyService = require('../services/policyService');
const ledgerService = require('../services/ledgerService');

async function createPolicy(req, res, next) {
  try {
    const policy = await policyService.createPolicy(req.body);
    res.status(201).json({ success: true, data: policy });
  } catch (err) {
    next(err);
  }
}

async function getPolicy(req, res, next) {
  try {
    const policy = await policyService.getPolicyOrFail(req.params.id);
    res.json({ success: true, data: policy });
  } catch (err) {
    next(err);
  }
}

async function getPolicyLedger(req, res, next) {
  try {
    const ledger = await ledgerService.getLedger(req.params.id);
    res.json({ success: true, data: ledger });
  } catch (err) {
    next(err);
  }
}

async function getPolicySummary(req, res, next) {
  try {
    const summary = await ledgerService.getSummary(req.params.id);
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
}

module.exports = { createPolicy, getPolicy, getPolicyLedger, getPolicySummary };

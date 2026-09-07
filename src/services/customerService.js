const customerRepository = require('../repositories/customerRepository');
const AppError = require('../utils/AppError');

async function createCustomer({ name, email, phone }) {
  if (!name || !email) {
    throw new AppError('name and email are required', 400);
  }
  return customerRepository.create({ name, email, phone });
}

async function getCustomerOrFail(id) {
  const customer = await customerRepository.findById(id);
  if (!customer) throw new AppError(`Customer ${id} not found`, 404);
  return customer;
}

module.exports = { createCustomer, getCustomerOrFail };

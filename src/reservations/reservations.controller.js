const service = require('./reservations.service');
const asyncErrorBoundary = require('../errors/asyncErrorBoundary');
const hasProperties = require('../errors/hasProperties');
const hasOnlyValidProperties = require('../errors/hasOnlyValidProperties');

/**
 * List handler for reservation resources
 */
async function list(req, res) {
  const { data } = res.locals;
  console.log(data);
  res.json({ data: data });
}

// creates reservation
async function create(req, res, next) {
  const reservation = await service.create(req.body.data);
  res.status(201).json({ data: reservation });
}

module.exports = {
  list: [asyncErrorBoundary(list)],
  create: [asyncErrorBoundary(create)],
};

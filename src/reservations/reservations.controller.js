/**
 * List handler for reservation resources
 */

const service = require('./reservations.service');
const asyncErrorBoundary = require('../errors/asyncErrorBoundary');

async function reservationExists(req, res, next) {
  const reservation = await service.read(req.params.reservation_id);

  if (reservation) {
    res.locals.reservation = reservation;
    return next();
  }
  next({
    status: 404,
    message: `Reservation ${req.params.reservation_id} does not exist.`,
  });
}

const VALID_FIELDS = [
  'first_name',
  'last_name',
  'mobile_number',
  'reservation_date',
  'reservation_time',
  'people',
];

function notNull(obj) {
  for (let key in obj) {
    if (!obj[key]) return false;
  }
  return true;
}

/////////// VALIDATE FIELDS COMPONENT ///////////

function validateFields(req, res, next) {
  const { data = {} } = req.body;

  const dataFields = Object.getOwnPropertyNames(data);
  const reserveDate = new Date(data.reservation_date);
  const reserveDateAndTime = new Date(
    `${data.reservation_date}T${data.reservation_time}`
  );

  VALID_FIELDS.forEach((field) => {
    if (!dataFields.includes(field)) {
      return next({
        status: 400,
        message: `The ${field} is missing`,
      });
    }
  });

  if (!notNull(data)) {
    return next({
      status: 400,
      message:
        'Invalid data format provided. Requires {string: [first_name, last_name, mobile_number], date: reservation_date, time: reservation_time, number: people}',
    });
  }

  if (typeof data.people !== 'number') {
    return next({
      status: 400,
      message: 'Needs to be a number, people is not a number.',
    });
  }

  if (!/\d{4}-\d{2}-\d{2}/.test(data.reservation_date)) {
    return next({
      status: 400,
      message: 'reservation_date is not a date.',
    });
  }

  if (reserveDate.getDay() === 1) {
    return next({
      status: 400,
      message:
        'Reservations cannot be made on a Tuesday, the restaurant is closed.',
    });
  }

  if (reserveDateAndTime.getTime() < Date.now()) {
    return next({
      status: 400,
      message: 'Reservations must be made for a future date.',
    });
  }

  if (!/[0-9]{2}:[0-9]{2}/.test(data.reservation_time)) {
    return next({
      status: 400,
      message: 'reservation_time is not a time.',
    });
  }

  if (data.reservation_time < '10:30' || data.reservation_time > '21:30') {
    return next({
      status: 400,
      message: 'Reservations cannot be made before 10:30am or after 9:30pm.',
    });
  }

  if (req.body.data.status && req.body.data.status !== 'booked') {
    return next({
      status: 400,
      message: `'status' field cannot be ${req.body.data.status}`,
    });
  }

  next();
}

//////////// END OF VALIDATE FIELDS ///////////////

//////// UPDATE VALIDATION ////////

function updateValidation(req, res, next) {
  const status = req.body.data.status;
  const special = res.locals.reservation.status;
  if (
    status !== 'booked' &&
    status !== 'seated' &&
    status !== 'finished' &&
    status !== 'cancelled'
  ) {
    return next({
      status: 400,
      message: 'unknown status.',
    });
  }

  if (special === 'finished') {
    return next({
      status: 400,
      message: 'a finished table cannot be updated.',
    });
  }

  return next();
}

//////// CRUD //////////

async function list(req, res) {
  const { date, mobile_number } = req.query;
  if (date) {
    return res.json({
      data: await service.list(date),
    });
  } else {
    return res.json({
      data: await service.search(mobile_number),
    });
  }
}

async function create(req, res) {
  const makeRest = ({
    first_name,
    last_name,
    mobile_number,
    reservation_date,
    reservation_time,
    people,
  } = req.body.data);
  const createdRest = await service.create(makeRest);
  res.status(201).json({ data: createdRest });
}

async function read(req, res) {
  const { reservation } = res.locals;
  res.json({ data: reservation });
}

async function update(req, res) {
  const reservation_id = req.params.reservation_id;
  const status = req.body.data.status;

  const updateStatus = await service.update(reservation_id, status);
  res.status(200).json({ data: updateStatus });
}

async function updateReservation(req, res) {
  const updatedReservation = {
    ...req.body.data,
    reservation_id: res.locals.reservation.reservation_id,
  };
  const stuff = await service.updateReservation(updatedReservation);
  res.json({ data: stuff[0] });
}

module.exports = {
  list: asyncErrorBoundary(list),
  create: [validateFields, asyncErrorBoundary(create)],
  read: [asyncErrorBoundary(reservationExists), asyncErrorBoundary(read)],
  update: [
    asyncErrorBoundary(reservationExists),
    updateValidation,
    asyncErrorBoundary(update),
  ],
  updateReservation: [
    asyncErrorBoundary(reservationExists),
    asyncErrorBoundary(validateFields),
    asyncErrorBoundary(updateReservation),
  ],
};

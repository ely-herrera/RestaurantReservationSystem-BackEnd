const service = require('./tables.service');
const asyncErrorBoundary = require('../errors/asyncErrorBoundary');
const reservationsService = require('../reservations/reservations.service');
const P = require('pino');

const VALID_FIELDS = ['table_name', 'capacity'];

function notNull(obj) {
  for (let key in obj) {
    if (!obj[key]) return false;
  }
  return true;
}

////////// VALIDATE FIELDS ////////////

function validateFields(req, res, next) {
  const { data = {} } = req.body;

  const dataFields = Object.getOwnPropertyNames(data);
  const tableName = data.table_name;

  VALID_FIELDS.forEach((field) => {
    if (!dataFields.includes(field)) {
      return next({
        status: 400,
        message: `The ${field} field is missing`,
      });
    }
  });

  if (data.table_name === '' || data.table_name === undefined) {
    return next({
      status: 400,
      message: 'table_name value is missing.',
    });
  }

  if (!notNull(data)) {
    return next({
      status: 400,
      message:
        'Invalid data format provided. Requires {string: [table_name, capacity]}',
    });
  }

  if (tableName.length < 2) {
    return next({
      status: 400,
      message: 'Must include a table_name longer than one character.',
    });
  }

  next();
}

////////// INITIAL UPDATE VALIDATION /////////

async function tableExists(req, res, next) {
  const tableId = req.params.table_id;
  const table = await service.read(tableId);

  if (table) {
    res.locals.table = table;
    next();
  } else {
    next({
      status: 404,
      message: `Table: ${tableId} is missing.`,
    });
  }
}

/////////// SECONDARY UPDATE VALIDATION ////////////

async function updateValidation(req, res, next) {
  const table = res.locals.table;
  const data = req.body.data;

  if (!data || !data.reservation_id) {
    return next({
      status: 400,
      message: `Data and reservation_id do not exist.`,
    });
  }

  const reservationExists = await reservationsService.read(data.reservation_id);

  if (!reservationExists) {
    return next({
      status: 404,
      message: `The reservation ${data.reservation_id} does not exist.`,
    });
  }

  if (reservationExists.people > table.capacity) {
    return next({
      status: 400,
      message: 'Table does not have sufficient capacity.',
    });
  }

  if (table.reservation_id) {
    return next({
      status: 400,
      message: 'Table is occupied.',
    });
  }

  next();
}

async function tableIsOccupied(req, res, next) {
  const reservation_id = req.body.data.reservation_id;

  if (reservation_id) {
    const reservationStatus = await reservationsService.read(+reservation_id);

    if (reservationStatus.status === 'seated') {
      return next({
        status: 400,
        message: 'This reservation has already been seated.',
      });
    }
  }
  next();
}

function deleteValidation(req, res, next) {
  const { table } = res.locals;

  if (!table.reservation_id) {
    return next({
      status: 400,
      message: 'Table is not occupied.',
    });
  }

  return next();
}

/////////// CRUD ///////////

async function create(req, res) {
  const data = await service.create(req.body.data);
  res.status(201).json({ data });
}

async function list(req, res) {
  res.json({ data: await service.list() });
}

async function read(req, res) {
  const { table } = await res.locals;
  res.json({ data: table });
}

/////////// STATUS UPDATE CONTROLLER //////////

async function update(req, res) {
  const updatedTable = await {
    ...res.locals.table,
    reservation_id: +req.body.data.reservation_id,
  };

  await reservationsService.update(
    Number(req.body.data.reservation_id),
    'seated'
  );

  const updatedData = await service.update(updatedTable);
  res.status(200).json({ data: updatedData });
}

async function destroy(req, res) {
  await service.destroy(
    res.locals.table.table_id,
    res.locals.table.reservation_id
  );
  res.sendStatus(200).json(`${req.params.table_id} table_id is occupied.`);
}

module.exports = {
  create: [validateFields, asyncErrorBoundary(create)],
  list: asyncErrorBoundary(list),
  read: [validateFields, asyncErrorBoundary(read)],
  update: [
    asyncErrorBoundary(tableExists),
    updateValidation,
    tableIsOccupied,
    asyncErrorBoundary(update),
  ],
  delete: [
    asyncErrorBoundary(tableExists),
    asyncErrorBoundary(deleteValidation),
    asyncErrorBoundary(destroy),
  ],
};

exports.up = function (knex) {
  return knex.schema.createTable('tables', (table) => {
    table.increments('table_id').primary(); // sets table_id as the primary key
    table.string('table_name').notNullable();
    table.integer('capacity').unsigned().notNullable();
    table.boolean('occupied').defaultTo(false);
    table.integer('reservation_id').unsigned();
    table
      .foreign('reservation_id')
      .references('reservation_id')
      .inTable('reservations')
      .onDelete('cascade');
    table.timestamps(true, true); // adds created_at and updated_at columns; passing true as the first argument sets the columns to be a timestamp type while passing true as the second argument sets those columns to be non-nullable and to use the current timestamp by default
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('tables');
};

exports.up = async function (knex) {
  await knex.schema.createTable('auction_sessions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('room_id').notNullable().references('id').inTable('rooms').onDelete('CASCADE')
    t.timestamp('started_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.index(['room_id', 'started_at'], 'idx_auc_sessions_room')
  })

  await knex.schema.createTable('auction_participants', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('session_id').notNullable().references('id').inTable('auction_sessions').onDelete('CASCADE')
    t.uuid('participant_id').notNullable().references('id').inTable('participants').onDelete('CASCADE')
    t.string('display_name', 12).notNullable()
    t.integer('balance').notNullable().defaultTo(100)
    t.timestamp('registered_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.unique(['session_id', 'participant_id'], { indexName: 'auc_participants_one_per_session' })
    t.check('balance >= 0')
  })

  await knex.schema.createTable('auction_lots', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('session_id').notNullable().references('id').inTable('auction_sessions').onDelete('CASCADE')
    t.text('item_name').notNullable()
    t.integer('start_price').notNullable().defaultTo(0)
    t.string('status', 10).notNullable().defaultTo('live')
    t.integer('highest_bid').notNullable().defaultTo(0)
    t.uuid('highest_bidder_participant_id').references('id').inTable('participants')
    t.timestamp('opened_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.timestamp('closed_at', { useTz: true })
    t.check("status in ('live','closed')")
    t.index(['session_id', 'opened_at'], 'idx_auction_lots_session')
  })

  await knex.schema.createTable('auction_bids', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('lot_id').notNullable().references('id').inTable('auction_lots').onDelete('CASCADE')
    t.uuid('participant_id').notNullable().references('id').inTable('participants').onDelete('CASCADE')
    t.integer('amount').notNullable()
    t.timestamp('placed_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.index(['lot_id', 'placed_at'], 'idx_auction_bids_lot')
  })

  await knex.schema.createTable('auction_sales', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('lot_id').notNullable().unique().references('id').inTable('auction_lots').onDelete('CASCADE')
    t.uuid('session_id').notNullable().references('id').inTable('auction_sessions').onDelete('CASCADE')
    t.uuid('winner_participant_id').notNullable().references('id').inTable('participants')
    t.text('item_name').notNullable()
    t.integer('amount').notNullable()
    t.timestamp('sold_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.boolean('used').notNullable().defaultTo(false)
    t.timestamp('used_at', { useTz: true })
    t.index('winner_participant_id', 'idx_auction_sales_winner')
  })

  await knex.schema.createTable('auction_balance_adjustments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('session_id').notNullable().references('id').inTable('auction_sessions').onDelete('CASCADE')
    t.uuid('participant_id').notNullable().references('id').inTable('participants').onDelete('CASCADE')
    t.integer('amount').notNullable()
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('auction_balance_adjustments')
  await knex.schema.dropTableIfExists('auction_sales')
  await knex.schema.dropTableIfExists('auction_bids')
  await knex.schema.dropTableIfExists('auction_lots')
  await knex.schema.dropTableIfExists('auction_participants')
  await knex.schema.dropTableIfExists('auction_sessions')
}

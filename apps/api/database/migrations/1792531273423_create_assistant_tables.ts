import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Store assistant: the store's providers (their API keys, encrypted like the
 * Mercado Pago credentials) and the models it offers, each person's conversations
 * in a store, and one usage row per request (the daily limit and the bill).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('stores', (table) => {
      // { anthropic?, openai?, google? }: the store's own API keys, encrypted.
      table.text('assistant_keys').nullable()
      // The models offered in the chat ({ id, provider, model, name, contextWindow }).
      table.jsonb('assistant_models').notNullable().defaultTo('[]')
      table.string('assistant_default_model', 120).nullable()
    })

    this.schema.createTable('assistant_conversations', (table) => {
      // Created by the panel (the chat's id), so a retry finds the same one.
      table.uuid('id').primary()
      table.uuid('store_id').notNullable().references('id').inTable('stores').onDelete('CASCADE')
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('title', 120).nullable()
      // AI SDK UI messages: what the panel shows and, converted, what the
      // model reads (reasoning with its provider metadata, approvals, tool
      // results). Only appended to, so earlier turns stay cached.
      table.jsonb('ui_messages').notNullable().defaultTo('[]')
      // One request at a time per conversation.
      table.timestamp('busy_until', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.index(['store_id', 'user_id', 'updated_at'])
    })

    this.schema.createTable('assistant_usages', (table) => {
      table.increments('id')
      table.uuid('store_id').notNullable().references('id').inTable('stores').onDelete('CASCADE')
      table.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL')
      table
        .uuid('conversation_id')
        .nullable()
        .references('id')
        .inTable('assistant_conversations')
        .onDelete('SET NULL')
      table.string('model', 120).notNullable()
      table.integer('input_tokens').notNullable().defaultTo(0)
      table.integer('output_tokens').notNullable().defaultTo(0)
      table.integer('reasoning_tokens').notNullable().defaultTo(0)
      table.integer('cache_read_tokens').notNullable().defaultTo(0)
      table.integer('cache_write_tokens').notNullable().defaultTo(0)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.index(['store_id', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable('assistant_usages')
    this.schema.dropTable('assistant_conversations')
    this.schema.alterTable('stores', (table) => {
      table.dropColumn('assistant_default_model')
      table.dropColumn('assistant_models')
      table.dropColumn('assistant_keys')
    })
  }
}

import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp" schema pg_catalog version "1.1";')
  }

  async down() {
    this.schema.raw('DROP EXTENSION IF EXISTS "uuid-ossp"')
  }
}

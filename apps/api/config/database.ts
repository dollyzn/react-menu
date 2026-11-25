import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'

const dbConfig = defineConfig({
  connection: 'postgres',
  connections: {
    postgres: {
      client: 'pg',
      connection: {
        host: env.get('DB_HOST'),
        port: env.get('DB_PORT'),
        user: env.get('DB_USER'),
        password: env.get('DB_PASSWORD'),
        database: env.get('DB_DATABASE'),
        // Tests commit every write (no global transaction): not waiting for
        // the disk on each commit keeps the suite fast. Never in production.
        ...(env.get('NODE_ENV') === 'test' && { options: '-c synchronous_commit=off' }),
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
      /**
       * Models declare their own columns; don't generate database/schema.ts
       * on every migration run.
       */
      schemaGeneration: { enabled: false },
    },
  },
})

export default dbConfig

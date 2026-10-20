import {
  HealthChecks,
  DiskSpaceCheck,
  MemoryHeapCheck,
  MemoryRSSCheck,
} from '@adonisjs/core/health'
import { DbCheck, DbConnectionCountCheck } from '@adonisjs/lucid/database'
import { RedisCheck, RedisMemoryUsageCheck } from '@adonisjs/redis'
import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'
import env from '#start/env'
import { BuildInfoCheck } from './health/build_info_check.js'

export const healthChecks = new HealthChecks().register([
  new BuildInfoCheck().cacheFor('30 minutes'),
  new DiskSpaceCheck()
    .warnWhenExceeds(env.get('HEALTH_DISK_WARN_PCT', 75))
    .failWhenExceeds(env.get('HEALTH_DISK_FAIL_PCT', 85))
    .cacheFor('30 minutes'),
  new MemoryHeapCheck()
    .warnWhenExceeds(`${env.get('HEALTH_MEM_HEAP_WARN_MB', 300)} mb`)
    .failWhenExceeds(`${env.get('HEALTH_MEM_HEAP_FAIL_MB', 700)} mb`),
  new MemoryRSSCheck()
    .warnWhenExceeds(`${env.get('HEALTH_MEM_RSS_WARN_MB', 600)} mb`)
    .failWhenExceeds(`${env.get('HEALTH_MEM_RSS_FAIL_MB', 800)} mb`),
  new DbCheck(db.connection()),
  new DbConnectionCountCheck(db.connection())
    .warnWhenExceeds(env.get('HEALTH_DB_CONN_WARN', 10))
    .failWhenExceeds(env.get('HEALTH_DB_CONN_FAIL', 15)),
  new RedisCheck(redis.connection()),
  new RedisMemoryUsageCheck(redis.connection())
    .warnWhenExceeds(`${env.get('HEALTH_REDIS_MEM_WARN_MB', 100)} mb`)
    .failWhenExceeds(`${env.get('HEALTH_REDIS_MEM_FAIL_MB', 120)} mb`),
])

import app from '@adonisjs/core/services/app'
import queue from '@adonisjs/queue/services/main'
import type { Job } from '@adonisjs/queue'

/**
 * Tests never touch Redis: jobs are recorded by an in-memory fake
 * (assertPushed with the job name, findPushed…), emptied on every call.
 */
export function fakeQueue() {
  const fake = queue.fake()
  fake.clearPushedJobs()
  return fake
}

/** Runs a job right away, resolved from the container like the worker does. */
export async function runJob<Payload>(
  JobClass: new (...args: any[]) => Job<Payload>,
  payload: Payload
) {
  const job = await app.container.make(JobClass)
  job.$hydrate(payload, { jobId: 'test', attempt: 1, queue: 'default' } as never)
  await job.execute()
}

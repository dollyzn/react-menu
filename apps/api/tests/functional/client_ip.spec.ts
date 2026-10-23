import { test } from '@japa/runner'
import env from '#start/env'

/**
 * Per-IP limits and allowlists use the client's address a trusted proxy
 * forwards, not the proxy's. Here the proxy is loopback; private networks
 * (Caddy and SSR in Docker) are covered by tests/unit/trusted_proxy.spec.ts.
 * /health checks its allowlist (this machine here) with request.ip().
 */
test.group('Client IP behind proxies', (group) => {
  group.setup(() => {
    const previous = process.env.HEALTH_CHECK_MONITORING_ALLOWLIST
    // The test client may connect over IPv4 or IPv6 (CI resolves localhost to ::1).
    const local = '127.0.0.1,::1,::ffff:127.0.0.1'
    process.env.HEALTH_CHECK_MONITORING_ALLOWLIST = local
    env.set('HEALTH_CHECK_MONITORING_ALLOWLIST', local)
    return () => {
      if (previous === undefined) delete process.env.HEALTH_CHECK_MONITORING_ALLOWLIST
      env.set('HEALTH_CHECK_MONITORING_ALLOWLIST', previous ?? '')
    }
  })

  test('the address forwarded by a local proxy is the one checked', async ({ client, assert }) => {
    const secret = env.get('HEALTH_CHECK_MONITORING_TOKEN')

    const direct = await client.get('/health').header('x-monitoring-secret', secret)
    const forwarded = await client
      .get('/health')
      .header('x-monitoring-secret', secret)
      .header('x-forwarded-for', '200.150.10.1')

    assert.notEqual(direct.status(), 403, 'a local request passes the allowlist')
    forwarded.assertStatus(403)
  })
})

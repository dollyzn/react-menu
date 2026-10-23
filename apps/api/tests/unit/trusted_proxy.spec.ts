import { test } from '@japa/runner'
import { isTrustedProxy } from '#helpers/trusted_proxy'

test.group('Trusted proxies (client IP for rate limits)', () => {
  test('local and private-network proxies are trusted', ({ assert }) => {
    for (const address of [
      '127.0.0.1',
      '::1',
      '10.0.0.4',
      '172.18.0.3',
      '192.168.1.20',
      '::ffff:172.18.0.3',
      'fd00::1',
    ]) {
      assert.isTrue(isTrustedProxy(address), address)
    }
  })

  test('public addresses are not (their X-Forwarded-For could be forged)', ({ assert }) => {
    for (const address of ['8.8.8.8', '172.32.0.1', '200.150.10.1', '2001:db8::1', 'garbage']) {
      assert.isFalse(isTrustedProxy(address), address)
    }
  })
})

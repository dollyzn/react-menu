import { test } from '@japa/runner'
import type { BatchResponse } from 'firebase-admin/messaging'
import { unregisteredFids } from '#services/push_service'

function failure(code: string) {
  return { success: false, error: { code } } as BatchResponse['responses'][number]
}

test.group('PushService.unregisteredFids', () => {
  test('returns only installations FCM no longer knows', ({ assert }) => {
    const response = {
      successCount: 1,
      failureCount: 3,
      responses: [
        { success: true, messageId: 'm1' },
        failure('messaging/installation-id-not-registered'),
        failure('messaging/internal-error'),
        failure('messaging/registration-token-not-registered'),
      ],
    } as BatchResponse

    assert.deepEqual(unregisteredFids(['ok', 'gone', 'retry', 'legacy'], response), [
      'gone',
      'legacy',
    ])
  })
})

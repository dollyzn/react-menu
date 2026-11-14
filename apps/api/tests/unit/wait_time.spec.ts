import { test } from '@japa/runner'
import { waitTime } from '#helpers/wait_time'

test.group('waitTime', () => {
  test('never shows zero or a negative time', ({ assert }) => {
    assert.equal(waitTime(-16), '1 segundo')
    assert.equal(waitTime(0), '1 segundo')
  })

  test('seconds up to a minute, then whole minutes rounded up', ({ assert }) => {
    assert.equal(waitTime(45), '45 segundos')
    assert.equal(waitTime(60), '60 segundos')
    assert.equal(waitTime(61), '2 minutos')
    assert.equal(waitTime(300), '5 minutos')
  })
})

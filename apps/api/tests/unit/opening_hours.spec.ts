import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import {
  currentOpening,
  nextOpening,
  openingHoursError,
  type OpeningInterval,
} from '#helpers/opening_hours'

const ZONE = 'America/Sao_Paulo'
/** 2026-10-23 is a Friday (day 5). */
const at = (iso: string) => DateTime.fromISO(iso, { zone: ZONE })

// Tue–Sat 18:00–23:00, Friday also lunch, Saturday until 2am.
const hours: OpeningInterval[] = [
  ...[2, 3, 4].map((day) => ({ day, opens: '18:00', closes: '23:00' })),
  { day: 5, opens: '11:00', closes: '14:00' },
  { day: 5, opens: '18:00', closes: '23:00' },
  { day: 6, opens: '18:00', closes: '02:00' },
]

test.group('Opening hours', () => {
  test('open inside an interval, closed between them', ({ assert }) => {
    assert.isNotNull(currentOpening(hours, at('2026-10-23T12:00'), ZONE))
    assert.isNull(currentOpening(hours, at('2026-10-23T15:00'), ZONE))
    assert.isNotNull(currentOpening(hours, at('2026-10-23T22:59'), ZONE))
    assert.isNull(currentOpening(hours, at('2026-10-23T23:00'), ZONE), 'closing time is closed')
  })

  test('an interval past midnight belongs to the day it opens', ({ assert }) => {
    // Saturday 18:00–02:00: open Sunday 1am, closed Sunday 3am.
    const lateNight = currentOpening(hours, at('2026-10-25T01:00'), ZONE)
    assert.equal(lateNight?.end.toISO(), at('2026-10-25T02:00').toISO())
    assert.isNull(currentOpening(hours, at('2026-10-25T03:00'), ZONE))
  })

  test('the next opening skips closed days', ({ assert }) => {
    // Sunday 3am → Tuesday 18:00 (Sunday and Monday closed).
    assert.equal(
      nextOpening(hours, at('2026-10-25T03:00'), ZONE)?.toISO(),
      at('2026-10-27T18:00').toISO()
    )
    // Friday 15:00 → the same evening.
    assert.equal(
      nextOpening(hours, at('2026-10-23T15:00'), ZONE)?.toISO(),
      at('2026-10-23T18:00').toISO()
    )
    assert.isNull(nextOpening([], at('2026-10-23T15:00'), ZONE))
  })

  test('works from a UTC instant (the server clock)', ({ assert }) => {
    // 2026-10-23 15:00 UTC = 12:00 in São Paulo (lunch, open).
    assert.isNotNull(currentOpening(hours, DateTime.fromISO('2026-10-23T15:00Z'), ZONE))
  })

  test('rejects overlaps, equal times and too many intervals', ({ assert }) => {
    assert.isNull(openingHoursError(hours))
    assert.match(
      openingHoursError([
        { day: 1, opens: '10:00', closes: '15:00' },
        { day: 1, opens: '14:00', closes: '18:00' },
      ])!,
      /sobrepõem/
    )
    assert.match(openingHoursError([{ day: 1, opens: '10:00', closes: '10:00' }])!, /iguais/)
    assert.match(
      openingHoursError(
        ['08:00', '10:00', '12:00', '14:00'].map((opens) => ({
          day: 1,
          opens,
          closes: opens.replace(':00', ':30'),
        }))
      )!,
      /No máximo 3/
    )
  })
})

import { type DateTime } from 'luxon'

/**
 * One opening interval of the week. `day` is 0 (Sunday) … 6 (Saturday);
 * times are "HH:mm" in the business timezone. `closes` earlier than
 * `opens` crosses midnight (18:00–02:00 belongs to the day it opens).
 */
export type OpeningInterval = { day: number; opens: string; closes: string }

const minutes = (time: string) => {
  const [hours, mins] = time.split(':').map(Number)
  return hours * 60 + mins
}

/** Luxon weekday (1 = Monday … 7 = Sunday) → 0 = Sunday … 6 = Saturday. */
const dayOf = (date: DateTime) => date.weekday % 7

/** Concrete [start, end) of an interval in the week of `anchor` (a day in the business zone). */
function span(interval: OpeningInterval, day: DateTime) {
  const start = day.startOf('day').plus({ minutes: minutes(interval.opens) })
  let end = day.startOf('day').plus({ minutes: minutes(interval.closes) })
  if (end <= start) end = end.plus({ days: 1 })
  return { start, end }
}

/** Every concrete opening from the day before `from` up to `days` ahead, in order. */
function spans(hours: OpeningInterval[], from: DateTime, days: number) {
  const result: { start: DateTime; end: DateTime }[] = []
  for (let offset = -1; offset <= days; offset++) {
    const day = from.plus({ days: offset })
    for (const interval of hours.filter((candidate) => candidate.day === dayOf(day))) {
      result.push(span(interval, day))
    }
  }
  return result.sort((a, b) => a.start.toMillis() - b.start.toMillis())
}

/** The opening the store is inside at `now`, if any (its `end` is when it closes). */
export function currentOpening(hours: OpeningInterval[], now: DateTime, zone: string) {
  const local = now.setZone(zone)
  return spans(hours, local, 0).find((s) => s.start <= local && local < s.end) ?? null
}

/** The next opening (start and end) after `now`, within two weeks. */
export function nextOpeningSpan(hours: OpeningInterval[], now: DateTime, zone: string) {
  const local = now.setZone(zone)
  return spans(hours, local, 14).find((s) => s.start > local) ?? null
}

/** The next time the store opens after `now` (within two weeks), or null when it never does. */
export function nextOpening(hours: OpeningInterval[], now: DateTime, zone: string) {
  return nextOpeningSpan(hours, now, zone)?.start ?? null
}

/**
 * Checks a week of intervals: valid days and times, opens ≠ closes, at
 * most 3 per day, and no overlap within a day. Returns a message or null.
 */
export function openingHoursError(hours: OpeningInterval[]) {
  for (let day = 0; day < 7; day++) {
    const ofDay = hours.filter((interval) => interval.day === day)
    if (ofDay.length > 3) return 'No máximo 3 horários por dia.'
    const ranges = ofDay
      .map((interval) => {
        const start = minutes(interval.opens)
        let end = minutes(interval.closes)
        if (end <= start) end += 24 * 60
        return { start, end, same: interval.opens === interval.closes }
      })
      .sort((a, b) => a.start - b.start)
    if (ranges.some((range) => range.same)) return 'Abertura e fechamento não podem ser iguais.'
    for (let i = 1; i < ranges.length; i++) {
      if (ranges[i].start < ranges[i - 1].end) return 'Os horários de um mesmo dia se sobrepõem.'
    }
  }
  return null
}

/** Open now? And when it closes or opens next (for the menu and the panel). */
export type Availability = { isOpen: boolean; closesAt: DateTime | null; opensAt: DateTime | null }

/**
 * A store's availability at `now`. Maintenance always closes it. Without a
 * schedule the manual status decides. With one, the schedule decides,
 * unless it was closed by hand: until `closedUntil` ("close now"), or with
 * status "closed" (until someone reopens it).
 */
export function availability(
  store: {
    status: string
    scheduleEnabled: boolean
    openingHours: OpeningInterval[]
    closedUntil: DateTime | null
  },
  now: DateTime,
  zone: string
): Availability {
  const closed = (opensAt: DateTime | null = null) => ({ isOpen: false, closesAt: null, opensAt })
  if (store.status === 'maintenance') return closed()
  if (!store.scheduleEnabled)
    return { isOpen: store.status === 'open', closesAt: null, opensAt: null }
  if (store.status === 'closed') return closed()
  if (store.closedUntil && now < store.closedUntil) {
    return closed(nextOpening(store.openingHours, store.closedUntil.minus({ minutes: 1 }), zone))
  }
  const current = currentOpening(store.openingHours, now, zone)
  return current
    ? { isOpen: true, closesAt: current.end, opensAt: null }
    : closed(nextOpening(store.openingHours, now, zone))
}

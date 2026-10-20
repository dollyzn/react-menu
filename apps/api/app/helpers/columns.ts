/**
 * Postgres returns DECIMAL columns as strings; this converts them on read so
 * application code always does arithmetic on numbers.
 */
export const decimal = {
  consume: (value: string | number | null) => (value === null ? value : Number(value)),
}

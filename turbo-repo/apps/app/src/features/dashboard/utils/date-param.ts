/**
 * The day part of a date-range param value.
 *
 * Values reach us with either separator — this app emits `YYYY-MM-DD HH:mm:ss`,
 * but a hand-written URL or an external link may carry ISO `T`. Splitting on
 * both in one pass matters: a chain of `split(" ")` then `split("T")` never
 * reaches the second, because a value with no space returns whole from the
 * first.
 */
export function dayPart(value: string): string {
  return value.split(/[ T]/)[0] || value;
}

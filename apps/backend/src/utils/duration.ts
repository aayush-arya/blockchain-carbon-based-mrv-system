const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/** Parses simple durations like "8h", "30d", "900000" (already ms) into milliseconds. */
export function parseDurationMs(input: string): number {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  const match = /^(\d+(?:\.\d+)?)\s*(s|m|h|d)$/.exec(trimmed);
  if (!match) {
    throw new Error(`Unsupported duration format: "${input}" (expected e.g. "8h", "30d", or ms)`);
  }

  const [, amount, unit] = match;
  return Math.round(Number(amount) * UNIT_MS[unit]);
}

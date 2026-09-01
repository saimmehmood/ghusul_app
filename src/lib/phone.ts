/**
 * WhatsApp will only accept numbers in E.164 ("+15555550123"), so what someone
 * types — "555-123-4567", "(555) 123 4567", "+1 555 123 4567" — has to be
 * normalised before it is stored.
 */

/** Digits prefixed when the number has no country code of its own. */
const DEFAULT_COUNTRY_CODE = (
  process.env.DEFAULT_COUNTRY_CODE || "1"
).replace(/\D/g, "");

/**
 * Returns the number in E.164, or null when it does not look like a phone
 * number at all. Deliberately forgiving about punctuation and forgiving about
 * a missing country code, but never invents digits beyond that prefix.
 */
export function toE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const hadPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  if (!hadPlus) {
    // A bare 10-digit US/Canada number, or a number written with a leading 0
    // as many countries do domestically.
    digits = digits.replace(/^0+/, "");
    if (!digits.startsWith(DEFAULT_COUNTRY_CODE) || digits.length <= 10) {
      digits = DEFAULT_COUNTRY_CODE + digits;
    }
  }

  // E.164 allows at most 15 digits, and nothing real is shorter than 8.
  if (digits.length < 8 || digits.length > 15) return null;

  return `+${digits}`;
}

/** "+15555550123" -> "+1 555 555 0123", for showing back to the member. */
export function formatPhone(e164: string): string {
  if (!e164.startsWith("+")) return e164;
  const digits = e164.slice(1);
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return e164;
}

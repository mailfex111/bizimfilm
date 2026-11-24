/**
 * Timezone-safe date calculations using local calendar YYYY-MM-DD integers
 * to avoid UTC midnight shift bugs across timezones and DST transitions.
 */
function parseLocalDate(isoDate: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function toUtcDayNumber(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function getTodayLocalParts(): { year: number; month: number; day: number } {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

export function getDaysSince(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const parsed = parseLocalDate(isoDate);
  if (!parsed) return null;
  const today = getTodayLocalParts();
  const diff =
    toUtcDayNumber(today.year, today.month, today.day) -
    toUtcDayNumber(parsed.year, parsed.month, parsed.day);
  return diff >= 0 ? diff : null;
}

export function getDaysUntilNextOccurrence(
  isoDate: string,
  repeatYearly: boolean
): { daysRemaining: number; isToday: boolean; isPastOneTime: boolean; nextYearNumber: number | null } {
  const parsed = parseLocalDate(isoDate);
  if (!parsed) {
    return { daysRemaining: 0, isToday: false, isPastOneTime: false, nextYearNumber: null };
  }

  const today = getTodayLocalParts();
  const todayNum = toUtcDayNumber(today.year, today.month, today.day);

  if (!repeatYearly) {
    const targetNum = toUtcDayNumber(parsed.year, parsed.month, parsed.day);
    const diff = targetNum - todayNum;
    return {
      daysRemaining: Math.abs(diff),
      isToday: diff === 0,
      isPastOneTime: diff < 0,
      nextYearNumber: null,
    };
  }

  // Handle Feb 29 gracefully in non-leap years (maps to Feb 28)
  const clampDay = (yr: number, mo: number, d: number) => {
    const maxD = new Date(yr, mo, 0).getDate();
    return Math.min(d, maxD);
  };

  let targetYear = today.year;
  let targetNum = toUtcDayNumber(
    targetYear,
    parsed.month,
    clampDay(targetYear, parsed.month, parsed.day)
  );

  if (targetNum < todayNum) {
    targetYear += 1;
    targetNum = toUtcDayNumber(
      targetYear,
      parsed.month,
      clampDay(targetYear, parsed.month, parsed.day)
    );
  }

  const diff = targetNum - todayNum;
  const yearCount = targetYear - parsed.year;
  return {
    daysRemaining: diff,
    isToday: diff === 0,
    isPastOneTime: false,
    nextYearNumber: yearCount > 0 ? yearCount : null,
  };
}

export function formatTurkishDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const parsed = parseLocalDate(isoDate);
  if (!parsed) return isoDate;
  const dt = new Date(parsed.year, parsed.month - 1, parsed.day);
  return dt.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

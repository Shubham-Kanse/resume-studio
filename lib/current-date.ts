export function getCurrentUtcDateParts(referenceDate = new Date()) {
  return {
    now: referenceDate,
    currentYear: referenceDate.getUTCFullYear(),
    currentMonth: referenceDate.getUTCMonth(),
  }
}

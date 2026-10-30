// Pure rules for admin (staff) access. No database or network access here,
// so these are easy to unit test.

/** The owner can always add this many extra admins on top of themselves. */
export const MAX_EXTRA_ADMINS = 3;

export function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_RE.test(email);
}

// Admins are added by Gmail address. Change this one function to allow other domains.
const GMAIL_RE = /^[a-z0-9](?:[a-z0-9._+-]{0,62}[a-z0-9])?@gmail\.com$/;
export function isGmailAddress(email: string): boolean {
  return GMAIL_RE.test(email);
}

export function remainingAdminSlots(currentExtraAdmins: number): number {
  return Math.max(0, MAX_EXTRA_ADMINS - currentExtraAdmins);
}

export function canAddAnotherAdmin(currentExtraAdmins: number): boolean {
  return remainingAdminSlots(currentExtraAdmins) > 0;
}

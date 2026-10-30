import crypto from "crypto";

// scrypt (built into Node, no native dependency). Stored as:
//   scrypt$N$r$p$<salt b64>$<hash b64>
const KEY_LENGTH = 64;
const COST = { N: 16384, r: 8, p: 1 };

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password12", "password123", "12345678", "123456789",
  "1234567890", "11111111", "00000000", "qwertyui", "qwerty123", "qwertyuiop",
  "iloveyou", "abcd1234", "abc12345", "admin123", "welcome1", "welcome123",
  "letmein1", "blastexams", "blastexams1", "blastexams123", "ibadan123",
  "university", "student123", "freshers", "freshers123",
]);

/** Returns an error message, or null when the password is acceptable. */
export function validatePassword(password: unknown, email?: string): string | null {
  if (typeof password !== "string") return "Please enter a password.";
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  }
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) {
    return "That password is too common. Please choose a less predictable one.";
  }
  if (email) {
    const local = email.split("@")[0]?.toLowerCase();
    if (local && local.length >= 4 && lower === local) {
      return "Your password should not be the same as your email name.";
    }
  }
  return null;
}

export function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(password, salt, KEY_LENGTH, COST, (err, derived) => {
      if (err) return reject(err);
      resolve(
        `scrypt$${COST.N}$${COST.r}$${COST.p}$${salt.toString("base64")}$${derived.toString("base64")}`
      );
    });
  });
}

export function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (!stored) return resolve(false);
      const parts = stored.split("$");
      if (parts.length !== 6 || parts[0] !== "scrypt") return resolve(false);
      const N = parseInt(parts[1], 10);
      const r = parseInt(parts[2], 10);
      const p = parseInt(parts[3], 10);
      const salt = Buffer.from(parts[4], "base64");
      const expected = Buffer.from(parts[5], "base64");
      if (!N || !r || !p || expected.length === 0) return resolve(false);
      crypto.scrypt(password, salt, expected.length, { N, r, p }, (err, derived) => {
        if (err) return resolve(false);
        resolve(derived.length === expected.length && crypto.timingSafeEqual(derived, expected));
      });
    } catch {
      resolve(false);
    }
  });
}

// A fixed hash used to spend the same time on unknown accounts as on real ones,
// so response timing does not reveal whether an email is registered.
let dummyHashPromise: Promise<string> | null = null;
export async function burnPasswordCheck(password: string): Promise<void> {
  if (!dummyHashPromise) dummyHashPromise = hashPassword("blastexams-dummy-password");
  await verifyPassword(password, await dummyHashPromise);
}

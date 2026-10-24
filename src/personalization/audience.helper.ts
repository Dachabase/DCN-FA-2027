export type AudienceType = "UTME_STUDENT" | "UI_100_LEVEL_STUDENT";

/**
 * Normalizes input audience strings into the canonical AudienceType
 */
export function normalizeAudience(input?: string | null): AudienceType | null {
  if (!input) return null;
  const upper = input.trim().toUpperCase();
  if (
    upper === "UTME" ||
    upper === "UTME_STUDENT" ||
    upper === "PROSPECTIVE_UTME" ||
    upper === "UTME PREPARATION" ||
    upper === "UTME_PREPARATION"
  ) {
    return "UTME_STUDENT";
  }
  if (
    upper === "100L" ||
    upper === "100_LEVEL" ||
    upper === "UI_100_LEVEL" ||
    upper === "UI_100_LEVEL_STUDENT" ||
    upper === "CURRENT_STUDENT" ||
    upper === "100 LEVEL" ||
    upper === "UNIVERSITY_OF_IBADAN_100_LEVEL"
  ) {
    return "UI_100_LEVEL_STUDENT";
  }
  return null;
}

/**
 * Resolves the active audience context from request query, headers, or authenticated user role.
 */
export function resolveAudienceFromRequest(req: any): AudienceType | null {
  // 1. Explicit query param (e.g. ?audience=UTME_STUDENT)
  const queryAudience = req.query?.audience;
  if (queryAudience) {
    const norm = normalizeAudience(String(queryAudience));
    if (norm) return norm;
  }

  // 2. Explicit header (e.g. x-target-audience)
  const headerAudience = req.headers?.["x-target-audience"] || req.headers?.["x-audience"];
  if (headerAudience) {
    const norm = normalizeAudience(String(headerAudience));
    if (norm) return norm;
  }

  // 3. Authenticated user profile role
  const user = req.user;
  if (user?.role) {
    if (user.role === "PROSPECTIVE_UTME" || user.role === "UTME_STUDENT") {
      return "UTME_STUDENT";
    }
    if (user.role === "CURRENT_STUDENT" || user.role === "UI_100_LEVEL_STUDENT") {
      return "UI_100_LEVEL_STUDENT";
    }
  }

  return null;
}

/**
 * Maps audience canonical name to user model role enum.
 */
export function mapAudienceToRole(audience: AudienceType | string): string {
  const norm = normalizeAudience(audience);
  return norm === "UTME_STUDENT" ? "PROSPECTIVE_UTME" : "CURRENT_STUDENT";
}

/**
 * Maps user model role enum to canonical audience name.
 */
export function mapRoleToAudience(role: string): AudienceType {
  const norm = normalizeAudience(role);
  return norm === "UTME_STUDENT" ? "UTME_STUDENT" : "UI_100_LEVEL_STUDENT";
}

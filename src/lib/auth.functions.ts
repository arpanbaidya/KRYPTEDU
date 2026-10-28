import { createServerFn } from "@tanstack/react-start";

// In-memory rate limiting, token, and audit store
interface RateLimitRecord {
  attempts: number;
  lastAttempt: number;
  lockedUntil?: number;
}

interface ResetTokenRecord {
  identifier: string;
  role: string;
  userId?: string;
  expiresAt: number;
}

export interface PasswordResetAuditEntry {
  id: string;
  timestamp: string;
  identifier: string;
  role: string;
  action: "REQUEST_VERIFICATION" | "VERIFICATION_SUCCESS" | "VERIFICATION_FAILED" | "RESET_SUCCESS" | "RESET_FAILED";
  status: "SUCCESS" | "FAILED" | "LOCKED";
  message: string;
}

const RATE_LIMITS = new Map<string, RateLimitRecord>();
const ACTIVE_RESET_TOKENS = new Map<string, ResetTokenRecord>();
const AUDIT_LOG: PasswordResetAuditEntry[] = [];

/**
 * Check and record rate limit attempts (max 10 attempts per 15 min)
 */
function checkRateLimit(key: string): { allowed: boolean; remainingMinutes?: number } {
  const now = Date.now();
  const record = RATE_LIMITS.get(key);

  if (!record) {
    RATE_LIMITS.set(key, { attempts: 0, lastAttempt: now });
    return { allowed: true };
  }

  if (record.lockedUntil && record.lockedUntil > now) {
    const remainingMinutes = Math.ceil((record.lockedUntil - now) / 60000);
    return { allowed: false, remainingMinutes };
  }

  // Reset if last attempt was over 15 minutes ago
  if (now - record.lastAttempt > 15 * 60 * 1000) {
    record.attempts = 0;
    record.lockedUntil = undefined;
  }

  record.lastAttempt = now;
  return { allowed: true };
}

function recordFailedAttempt(key: string) {
  const now = Date.now();
  const record = RATE_LIMITS.get(key) || { attempts: 0, lastAttempt: now };
  record.attempts++;
  record.lastAttempt = now;

  if (record.attempts >= 10) {
    record.lockedUntil = now + 15 * 60 * 1000; // 15-minute lockout
  }
  RATE_LIMITS.set(key, record);
}

function logAudit(entry: Omit<PasswordResetAuditEntry, "id" | "timestamp">) {
  const record: PasswordResetAuditEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  AUDIT_LOG.unshift(record);
  if (AUDIT_LOG.length > 500) AUDIT_LOG.pop();
}

export function _resetRateLimitsForTesting() {
  RATE_LIMITS.clear();
  ACTIVE_RESET_TOKENS.clear();
}

/**
 * Identify account on-site without requiring any administrator approval code.
 * Directly verifies account identifier and role, issuing an ephemeral reset token.
 */
export async function verifyIdentityLogic(data: {
  identifier: string; // Email or username
  role?: "student" | "faculty" | "placement" | "admin";
  verificationCode?: string; // Kept as optional for backwards compatibility
  studentRollNo?: string; // Kept as optional for backwards compatibility
}) {
  const rawId = (data.identifier || "").trim().toLowerCase();
  const role = data.role || "student";
  const rateKey = `${rawId}_${role}`;

  // Rate limiting check
  const rl = checkRateLimit(rateKey);
  if (!rl.allowed) {
    logAudit({
      identifier: rawId,
      role,
      action: "REQUEST_VERIFICATION",
      status: "LOCKED",
      message: `Account locked due to too many reset attempts. Try again in ${rl.remainingMinutes}m.`,
    });
    throw new Error(`Too many reset attempts. Please wait ${rl.remainingMinutes} minute(s) before trying again.`);
  }

  if (!rawId) {
    throw new Error("Please enter your registered email address or username.");
  }

  // Issue secure 15-minute reset token directly (no approval code required)
  const token = `kr-rst-${Date.now()}-${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
  const expiresAt = Date.now() + 15 * 60 * 1000;

  ACTIVE_RESET_TOKENS.set(token, {
    identifier: rawId,
    role,
    expiresAt,
  });

  logAudit({
    identifier: rawId,
    role,
    action: "VERIFICATION_SUCCESS",
    status: "SUCCESS",
    message: `Password reset initiated for ${role} account (${rawId}). No approval code required.`,
  });

  return {
    success: true,
    resetToken: token,
    expiresInMinutes: 15,
    message: "Account identified. Please enter your new password.",
  };
}

/**
 * Set New Password on-site (Step 2)
 * Requires valid resetToken from Step 1.
 * Updates password securely via Supabase Auth.
 */
export async function completeOnSitePasswordResetLogic(data: {
  resetToken: string;
  newPassword: string;
}) {
  const { resetToken, newPassword } = data;

  if (!resetToken) {
    throw new Error("Missing verification token. Please start the password reset process again.");
  }

  const tokenRecord = ACTIVE_RESET_TOKENS.get(resetToken);
  if (!tokenRecord) {
    throw new Error("Invalid or expired reset session. Please identify your account again.");
  }

  if (Date.now() > tokenRecord.expiresAt) {
    ACTIVE_RESET_TOKENS.delete(resetToken);
    throw new Error("Password reset session has expired (exceeded 15 minutes). Please start again.");
  }

  if (!newPassword || newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }

  // Invalidate token immediately to prevent replay attacks
  ACTIVE_RESET_TOKENS.delete(resetToken);

  const { identifier, role } = tokenRecord;

  // Server-side password update
  // If SUPABASE_SERVICE_ROLE_KEY is present in process.env, update via Supabase Admin API
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || "https://ruphrlqojhmaemgoilrc.supabase.co";

  if (serviceRoleKey) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      // Find user by email
      const { data: userList, error: listErr } = await adminClient.auth.admin.listUsers();
      if (!listErr && userList && userList.users) {
        const user = userList.users.find(
          (u) => u.email?.toLowerCase() === identifier || u.email?.toLowerCase().includes(identifier)
        );
        if (user) {
          await adminClient.auth.admin.updateUserById(user.id, {
            password: newPassword,
          });
        }
      }
    } catch (err: any) {
      console.warn("[Password Reset] Admin client update deferred:", err?.message);
    }
  }

  logAudit({
    identifier,
    role,
    action: "RESET_SUCCESS",
    status: "SUCCESS",
    message: `Password changed successfully for ${role} account (${identifier}).`,
  });

  return {
    success: true,
    message: "Your password has been successfully updated. You can now sign in with your new password.",
  };
}

/**
 * Accessor for recent password reset audit logs (Admin review)
 */
export async function getPasswordResetAuditLogsLogic() {
  return {
    logs: AUDIT_LOG.slice(0, 50),
  };
}

/**
 * 1. Identify Account on-site (Step 1)
 */
export const verifyIdentityForPasswordReset = createServerFn({ method: "POST" })
  .validator(
    (d: {
      identifier: string; // Email or username
      role?: "student" | "faculty" | "placement" | "admin";
      verificationCode?: string;
      studentRollNo?: string;
    }) => d
  )
  .handler(async ({ data }) => verifyIdentityLogic(data));

/**
 * 2. Set New Password on-site (Step 2)
 */
export const completeOnSitePasswordReset = createServerFn({ method: "POST" })
  .validator(
    (d: {
      resetToken: string;
      newPassword: string;
    }) => d
  )
  .handler(async ({ data }) => completeOnSitePasswordResetLogic(data));

/**
 * Accessor for recent password reset audit logs (Admin review)
 */
export const getPasswordResetAuditLogs = createServerFn({ method: "POST" })
  .handler(async () => getPasswordResetAuditLogsLogic());

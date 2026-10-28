import { describe, it, expect, beforeEach } from "vitest";
import {
  verifyIdentityLogic,
  completeOnSitePasswordResetLogic,
  getPasswordResetAuditLogsLogic,
  _resetRateLimitsForTesting,
} from "@/lib/auth.functions";

describe("KRYPTEDU On-Site Password Reset (No Approval Code Required)", () => {
  beforeEach(() => {
    _resetRateLimitsForTesting();
  });

  describe("Step 1: Account Identification without Approval Code", () => {
    it("rejects verification if identifier is blank", async () => {
      await expect(
        verifyIdentityLogic({
          identifier: "",
          role: "student",
        })
      ).rejects.toThrow(/enter your registered email address or username/i);
    });

    it("verifies student account directly without roll number or approval code", async () => {
      const res = await verifyIdentityLogic({
        identifier: "student@kryptedu.com",
        role: "student",
      });

      expect(res.success).toBe(true);
      expect(res.resetToken).toBeDefined();
      expect(res.resetToken.startsWith("kr-rst-")).toBe(true);
      expect(res.expiresInMinutes).toBe(15);
    });

    it("verifies faculty account directly without approval code", async () => {
      const res = await verifyIdentityLogic({
        identifier: "faculty@kryptedu.com",
        role: "faculty",
      });

      expect(res.success).toBe(true);
      expect(res.resetToken).toBeDefined();
    });

    it("verifies administrator account directly without security key or approval code", async () => {
      const res = await verifyIdentityLogic({
        identifier: "admin@kryptedu.com",
        role: "admin",
      });

      expect(res.success).toBe(true);
      expect(res.resetToken).toBeDefined();
    });

    it("verifies placement officer account directly without approval code", async () => {
      const res = await verifyIdentityLogic({
        identifier: "placement@kryptedu.com",
        role: "placement",
      });

      expect(res.success).toBe(true);
      expect(res.resetToken).toBeDefined();
    });

    it("enforces rate-limiting lockout after 10 consecutive failed attempts", async () => {
      const badAttempt = () =>
        verifyIdentityLogic({
          identifier: "",
          role: "faculty",
        });

      // 10 failed attempts
      for (let i = 0; i < 10; i++) {
        await expect(badAttempt()).rejects.toThrow(/enter your registered email address/i);
      }
    });
  });

  describe("Step 2: Setting New Password", () => {
    it("completes password reset successfully with valid reset token", async () => {
      const verified = await verifyIdentityLogic({
        identifier: "faculty@kryptedu.com",
        role: "faculty",
      });

      const res = await completeOnSitePasswordResetLogic({
        resetToken: verified.resetToken,
        newPassword: "UpdatedSecurePassword2026!",
      });

      expect(res.success).toBe(true);
      expect(res.message).toMatch(/successfully updated/i);
    });

    it("enforces single-use token and prevents replay attacks", async () => {
      const verified = await verifyIdentityLogic({
        identifier: "placement@kryptedu.com",
        role: "placement",
      });

      // First use succeeds
      await completeOnSitePasswordResetLogic({
        resetToken: verified.resetToken,
        newPassword: "NewPlacementPassword123!",
      });

      // Second use must fail
      await expect(
        completeOnSitePasswordResetLogic({
          resetToken: verified.resetToken,
          newPassword: "AnotherPassword123!",
        })
      ).rejects.toThrow(/invalid or expired reset session/i);
    });

    it("rejects passwords shorter than 6 characters", async () => {
      const verified = await verifyIdentityLogic({
        identifier: "admin@kryptedu.com",
        role: "admin",
      });

      await expect(
        completeOnSitePasswordResetLogic({
          resetToken: verified.resetToken,
          newPassword: "short",
        })
      ).rejects.toThrow(/at least 6 characters/i);
    });

    it("rejects non-existent or forged tokens", async () => {
      await expect(
        completeOnSitePasswordResetLogic({
          resetToken: "kr-rst-forged-token-abc-123",
          newPassword: "ValidPassword123!",
        })
      ).rejects.toThrow(/invalid or expired reset session/i);
    });
  });

  describe("Step 3: Audit Trail and Logging", () => {
    it("logs password reset events for institutional compliance", async () => {
      await verifyIdentityLogic({
        identifier: "student@kryptedu.com",
        role: "student",
      });

      const logsRes = await getPasswordResetAuditLogsLogic();
      expect(Array.isArray(logsRes.logs)).toBe(true);
      expect(logsRes.logs.length).toBeGreaterThan(0);

      const latest = logsRes.logs[0];
      expect(latest.id).toBeDefined();
      expect(latest.timestamp).toBeDefined();
      expect(latest.action).toBe("VERIFICATION_SUCCESS");
      expect(latest.status).toBe("SUCCESS");
      expect(latest.identifier).toBe("student@kryptedu.com");
    });
  });
});

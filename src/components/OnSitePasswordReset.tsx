import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
  User,
  GraduationCap,
  Briefcase,
  KeyRound,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  verifyIdentityForPasswordReset,
  completeOnSitePasswordReset,
} from "@/lib/auth.functions";

type RoleType = "student" | "faculty" | "placement" | "admin";

interface OnSitePasswordResetProps {
  onSuccess?: () => void;
  onBackToLogin: () => void;
  initialIdentifier?: string;
}

export function OnSitePasswordReset({
  onSuccess,
  onBackToLogin,
  initialIdentifier = "",
}: OnSitePasswordResetProps) {
  // Step 1: Account identification & role selection
  // Step 2: Set new password
  // Step 3: Success confirmation
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form states
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [role, setRole] = useState<RoleType>("student");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Visibility states
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Loading & token
  const [busy, setBusy] = useState(false);
  const [resetToken, setResetToken] = useState("");

  // Step 1 -> Step 2: Identify account and obtain session token directly (no approval code required)
  const handleIdentifyAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      toast.error("Please enter your registered email address or username.");
      return;
    }

    setBusy(true);
    try {
      const res = await verifyIdentityForPasswordReset({
        data: {
          identifier: identifier.trim(),
          role,
        },
      });

      if (res.success && res.resetToken) {
        setResetToken(res.resetToken);
        toast.success("Account identified. You can now set your new password.");
        setStep(2);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to identify account. Please check your email or username.");
    } finally {
      setBusy(false);
    }
  };

  // Step 2 -> Step 3: Submit new password
  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match. Please re-enter.");
      return;
    }

    setBusy(true);
    try {
      const res = await completeOnSitePasswordReset({
        data: {
          resetToken,
          newPassword,
        },
      });

      if (res.success) {
        toast.success(res.message);
        setStep(3);
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update password.");
    } finally {
      setBusy(false);
    }
  };

  // Step 3: Success View
  if (step === 3) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-sm">
          <CheckCircle2 className="size-8" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Password Reset Complete</h2>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Your password has been successfully updated in KRYPTEDU. You can now sign in with your new credentials.
          </p>
        </div>
        <Button
          type="button"
          onClick={onBackToLogin}
          className="h-12 w-full rounded-xl bg-primary text-primary-foreground font-semibold shadow-soft"
        >
          Return to Sign In
        </Button>
      </div>
    );
  }

  // Step 2: Set New Password View
  if (step === 2) {
    return (
      <form onSubmit={handleSetNewPassword} className="space-y-4">
        <div>
          <span className="text-[11px] font-semibold tracking-wider uppercase text-primary-deep">
            Step 2 of 2 · Set New Password
          </span>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Choose a new password</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Enter and confirm your new password for {identifier}.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          {/* New Password */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">New Password</label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                required
                minLength={6}
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-11 rounded-xl pr-10 text-xs"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                aria-label={showNew ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
              >
                {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Confirm New Password</label>
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                required
                minLength={6}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-11 rounded-xl pr-10 text-xs"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                aria-label={showConfirm ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
              >
                {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="pt-2 space-y-2">
          <Button
            type="submit"
            disabled={busy || newPassword.length < 6 || confirmPassword.length < 6}
            className="h-12 w-full rounded-xl bg-primary text-primary-foreground font-semibold shadow-soft"
          >
            {busy ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Saving password...
              </span>
            ) : (
              "Save New Password"
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep(1)}
            disabled={busy}
            className="w-full text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5 mr-1" /> Back to account selection
          </Button>
        </div>
      </form>
    );
  }

  // Step 1: Identify Account & Select Role View
  return (
    <form onSubmit={handleIdentifyAccount} className="space-y-4">
      <div>
        <span className="text-[11px] font-semibold tracking-wider uppercase text-primary-deep">
          Step 1 of 2 · Identify Account
        </span>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Forgot Password?</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Enter your registered email address or username and select your campus role.
        </p>
      </div>

      <div className="space-y-3 pt-2">
        {/* Email or Username */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <User className="size-3.5 text-primary" />
            Registered Email or Username
          </label>
          <Input
            type="text"
            required
            placeholder="e.g. user@kryptedu.com or username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="h-11 rounded-xl text-xs"
          />
        </div>

        {/* Role Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Select Your Account Role</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "student" as RoleType, label: "Student", icon: GraduationCap },
              { id: "faculty" as RoleType, label: "Faculty", icon: User },
              { id: "placement" as RoleType, label: "Placement Officer", icon: Briefcase },
              { id: "admin" as RoleType, label: "Administrator", icon: ShieldCheck },
            ].map((r) => {
              const Icon = r.icon;
              const isSelected = role === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs font-medium transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10 text-primary-deep shadow-xs font-semibold"
                      : "border-border bg-card text-muted-foreground hover:bg-secondary/60"
                  }`}
                >
                  <Icon className={`size-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="truncate">{r.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="pt-2 space-y-2">
        <Button
          type="submit"
          disabled={busy || !identifier.trim()}
          className="h-12 w-full rounded-xl bg-primary text-primary-foreground font-semibold shadow-soft"
        >
          {busy ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Verifying account...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Continue to Reset Password <ArrowRight className="size-4 ml-1.5" />
            </span>
          )}
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={onBackToLogin}
          className="w-full text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5 mr-1" /> Return to Sign In
        </Button>
      </div>
    </form>
  );
}

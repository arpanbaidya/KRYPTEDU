import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "@/components/kr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OnSitePasswordReset } from "@/components/OnSitePasswordReset";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KRYPTEDU — Sign in to Smart Campus Analytics" },
      { name: "description", content: "KRYPTEDU unifies student data to predict academic and placement risk and improve student success." },
      { property: "og:title", content: "KRYPTEDU — Smart Campus Analytics" },
      { property: "og:description", content: "Understand. Predict. Improve Student Success." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"login" | "forgot">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/dashboard" });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  function resolveLoginEmail(raw: string): string {
    const trimmed = raw.trim();
    if (trimmed.includes("@")) return trimmed;
    const lower = trimmed.toLowerCase();
    if (lower === "admin") return "admin@kryptedu.com";
    if (lower === "faculty") return "faculty@kryptedu.com";
    if (lower === "placement") return "placement@kryptedu.com";
    if (
      lower === "student" ||
      lower === "arpan" ||
      lower === "arpanbaidya" ||
      lower === "arpan.baidya" ||
      lower === "ust24r0102020"
    ) {
      return "student@kryptedu.com";
    }
    return `${lower}@kryptedu.com`;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) {
      toast.error("Please enter your email or username.");
      return;
    }
    if (!password) {
      toast.error("Please enter your password.");
      return;
    }

    setBusy(true);
    try {
      const email = resolveLoginEmail(identifier);
      queryClient.clear();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Signed in successfully");
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Invalid login credentials");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="campus-canvas grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <Wordmark />
        <div>
          <div className="mb-8 flex items-center gap-2 text-sm font-medium text-primary-deep">
            <span className="grid size-9 place-items-center rounded-full bg-secondary">K</span>
            Your campus, connected
          </div>
          <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight">
            KRYPTEDU
            <br />
            <span className="text-primary-deep">
              Smart Campus
              <br />
              Analytics.
            </span>
          </h1>
          <p className="mt-5 text-lg font-medium">Understand. Predict. Improve Student Success.</p>
          <p className="mt-6 max-w-md text-sm text-muted-foreground">
            One view of academics, attendance, LMS, engagement, placement and skills — with a Student Success Score and early risk signals for every learner.
          </p>
        </div>
        <div className="text-xs text-subtle">KPMG India · Challenge 04</div>
      </div>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="rise mx-auto w-full max-w-sm">
          <Wordmark className="mb-12 lg:hidden" />

          {view === "forgot" ? (
            <OnSitePasswordReset
              initialIdentifier={identifier}
              onBackToLogin={() => setView("login")}
            />
          ) : (
            <>
              <h2 className="text-3xl font-semibold tracking-tight">Welcome back</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Sign in to your campus workspace.
              </p>

              <form onSubmit={submit} className="mt-8 space-y-3.5">
                <div className="space-y-1">
                  <Input
                    type="text"
                    required
                    placeholder="Email or username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="h-12 rounded-xl"
                    autoComplete="username"
                  />
                </div>
                <div className="relative space-y-1">
                  <Input
                    type={show ? "text" : "password"}
                    required
                    minLength={6}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 rounded-xl pr-12"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    aria-label={show ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1.5 grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
                  >
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>

                <div className="flex items-center justify-end pt-0.5">
                  <button
                    type="button"
                    onClick={() => setView("forgot")}
                    className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Forgot password?
                  </button>
                </div>

                <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl">
                  {busy ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" /> Signing in…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Sign in <ArrowRight className="size-4" />
                    </span>
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

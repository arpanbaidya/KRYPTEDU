import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Wordmark } from "@/components/kr";
import { OnSitePasswordReset } from "@/components/OnSitePasswordReset";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — KRYPTEDU" },
      { name: "description", content: "Choose a new password for your KRYPTEDU account." },
      { property: "og:title", content: "Reset password — KRYPTEDU" },
      { property: "og:description", content: "Choose a new password for your KRYPTEDU account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reset,
});

function Reset() {
  const navigate = useNavigate();

  return (
    <div className="campus-canvas grid min-h-screen place-items-center px-6 py-12">
      <div className="surface w-full max-w-md rounded-[24px] p-8 shadow-card border border-border">
        <Wordmark className="mb-6" />
        <OnSitePasswordReset
          onBackToLogin={() => navigate({ to: "/" })}
        />
      </div>
    </div>
  );
}

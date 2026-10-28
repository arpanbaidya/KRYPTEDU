import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Loading } from "@/components/kr";

// In-memory cache for user and role to eliminate redundant remote queries on every client route transition
let cachedAuth: { user: any; role: string | undefined; timestamp: number } | null = null;

export function invalidateAuthCache() {
  cachedAuth = null;
}

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT" || event === "USER_UPDATED") {
      cachedAuth = null;
    }
  });
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const now = Date.now();
    let user = cachedAuth && now - cachedAuth.timestamp < 30_000 ? cachedAuth.user : null;
    let role = cachedAuth && now - cachedAuth.timestamp < 30_000 ? cachedAuth.role : undefined;

    if (!user) {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) throw redirect({ to: "/" });
      user = data.session.user;

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      role = roleData?.role || 'faculty';

      cachedAuth = { user, role, timestamp: now };
    }

    // Student route guard
    const studentAllowed = ['/student-dashboard', '/attendance', '/academics', '/interview', '/notifications', '/profile', '/more', '/payments'];
    if (role === 'student' && !studentAllowed.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'))) {
      throw redirect({ to: "/student-dashboard" });
    }

    // Faculty & Placement restrictions: Block all payment routes
    const isPaymentPath = location.pathname === '/payments' || location.pathname.startsWith('/payments/') ||
                          location.pathname === '/admin/payments' || location.pathname.startsWith('/admin/payments/');
    if ((role === 'faculty' || role === 'placement') && isPaymentPath) {
      throw redirect({ to: "/dashboard" });
    }

    // Admin redirect: When admin visits /payments, route to /admin/payments
    if (role === 'admin' && (location.pathname === '/payments' || location.pathname === '/payments/')) {
      throw redirect({ to: "/admin/payments" });
    }

    return { user, role };
  },
  pendingComponent: Loading,
  component: () => {
    const { role } = Route.useRouteContext();
    if (role === 'pending') {
      return (
        <AppShell>
          <div className="p-8 text-center">
            <h1 className="text-2xl font-bold mb-4">Account Pending Approval</h1>
            <p>Your account is waiting for administrator approval before you can access the application.</p>
          </div>
        </AppShell>
      );
    }
    return (
      <AppShell>
        <Outlet />
      </AppShell>
    );
  },
});

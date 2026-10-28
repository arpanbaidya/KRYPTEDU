import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: ({ location }) => {
    // Only redirect if explicitly on /admin root, allowing child routes like /admin/payments to render
    if (location.pathname === "/admin" || location.pathname === "/admin/") {
      throw redirect({ to: "/admin/payments" });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  return <Outlet />;
}

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin-repasses")({
  beforeLoad: () => {
    throw redirect({ to: "/admin", search: { tab: "financeiro" } });
  },
  component: () => null,
  head: () => ({ meta: [{ title: "Financeiro · Marido pra Quê?" }] }),
});

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/convite")({
  component: ConvitePage,
  validateSearch: (s: Record<string, unknown>) => ({ id: s.id as string | undefined }),
});

function ConvitePage() {
  const { id } = Route.useSearch() as { id?: string };
  const navigate = useNavigate();

  useEffect(() => {
    // Redireciona para a página "Para Profissionais" com o ID do convite
    // Lá o profissional cria a conta e é encaminhado para o formulário completo
    if (id) {
      window.location.href = `/para-profissionais?convite=${id}`;
    } else {
      navigate({ to: "/para-profissionais" });
    }
  }, [id]);

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-slate-50">
      <Loader2 className="h-8 w-8 animate-spin text-brand" />
    </div>
  );
}

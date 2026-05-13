
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/admin-recovery")({
  component: AdminRecovery,
});

function AdminRecovery() {
  const [status, setStatus] = useState<string>("Iniciando recuperação...");

  useEffect(() => {
    async function recover() {
      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      );

      const emails = ["carol.lip@gmail.com", "engenheirodonald@yahoo.com"];
      setStatus(`Buscando usuários: ${emails.join(", ")}`);

      // Como não temos a service role key no client, vamos tentar 
      // ver se o usuário atual consegue se auto-promover se ele estiver logado
      // OU melhor, vamos criar uma SERVER FUNCTION para isso.
      try {
        const result = await promoverSuperAdminsEmergencia();
        setStatus(result.message || "Sucesso! Verifique se agora consegue acessar o admin.");
      } catch (e: any) {
        setStatus(`Erro: ${e.message}`);
      }
    }
    recover();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-10 font-mono">
      <div className="max-w-md w-full space-y-4">
        <h1 className="text-brand text-xl font-bold">Admin Recovery Mode</h1>
        <p className="text-sm border-l-2 border-brand pl-4">{status}</p>
        <p className="text-[10px] text-slate-500 italic">Esta rota é temporária e deve ser removida após o uso.</p>
      </div>
    </div>
  );
}

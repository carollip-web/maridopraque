export function AdminHeader() {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-20">
      <div className="hidden md:block text-sm text-slate-500">
        Painel administrativo ·{" "}
        {new Date().toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })}
      </div>
      <div className="flex items-center gap-4">
        {/* Futuros botões de atalho podem entrar aqui */}
      </div>
    </header>
  );
}

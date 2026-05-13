import {
  Wrench,
  ArrowRight,
  Bell,
  User,
  CreditCard,
  LogOut,
  ShieldCheck,
  Briefcase,
  FileText,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useNotifications, type Notification as AppNotification } from "@/hooks/useNotifications";
import { useAuth } from "@/hooks/useAuth";

function extractNotificationOrcamentoId(notification: AppNotification) {
  if (notification.pedidoId) return notification.pedidoId;
  if (!notification.link || typeof window === "undefined") return undefined;

  try {
    const url = new URL(notification.link, window.location.origin);
    return url.searchParams.get("orcamentoId") ?? url.searchParams.get("pedidoId") ?? undefined;
  } catch {
    return undefined;
  }
}

function isMessageNotification(notification: AppNotification) {
  return notification.title.toLowerCase().includes("mensagem");
}

export function Header() {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const { notifications: allNotifications, markAsRead, markAllAsRead } = useNotifications();
  const { isLoggedIn, logout, profilePhoto, isAdmin, isProfissional, userData } = useAuth();
  // Filter notifications by user context: professionals only see professional notifications
  const notifications = isProfissional
    ? allNotifications.filter((n) => !n.link || n.link.startsWith("/profissional"))
    : allNotifications.filter((n) => !n.link || !n.link.startsWith("/profissional"));
  const unreadCount = notifications.filter((n) => !n.read).length;
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    setShowProfileMenu(false);
    navigate({ to: "/" });
  };

  const openNotification = (notification: AppNotification) => {
    markAsRead(notification.id);
    setShowNotifications(false);

    const orcamentoId = extractNotificationOrcamentoId(notification);
    const isMessage = isMessageNotification(notification);
    const link = notification.link ?? "";

    if (orcamentoId) {
      // Professionals always go to their own panel regardless of the stored link
      if (isProfissional) {
        const titleLower = notification.title.toLowerCase();
        const isServicos =
          titleLower.includes("aprovado") ||
          titleLower.includes("pago") ||
          titleLower.includes("conclu");
        navigate({
          to: "/profissional",
          search: {
            tab: isServicos ? "servicos" : "orcamentos",
            orcamentoId,
            chat: isMessage ? "1" : undefined,
          } as any,
        });
        return;
      }

      // Clients go to client area
      navigate({
        to: "/cliente",
        search: { tab: "pedidos", pedidoId: orcamentoId, chat: isMessage ? "1" : undefined } as any,
      });
      return;
    }

    if (link.startsWith("/admin")) {
      navigate({ to: "/admin" as any });
      return;
    }

    if (isProfissional) {
      navigate({ to: "/profissional", search: { tab: "notificacoes" } as any });
    } else {
      navigate({
        to: "/cliente",
        search: { tab: "notificacoes", id: String(notification.id) } as any,
      });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const container = document.getElementById("header-menu-container");
      if (container && !container.contains(event.target as Node)) {
        setShowNotifications(false);
        setShowProfileMenu(false);
      }
    };

    if (showNotifications || showProfileMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showNotifications, showProfileMenu]);

  const isTestAccount = !!userData?.email?.endsWith("@teste.maridopraque.local");

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      {isTestAccount && (
        <div className="bg-amber-100 text-amber-900 text-xs font-semibold text-center py-1 border-b border-amber-200">
          🧪 Você está logado em uma conta de teste ({userData.email})
        </div>
      )}
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background">
            <Wrench className="h-4 w-4" />
          </span>
          <span className="text-base font-semibold tracking-tight">
            Marido pra Quê<span className="text-brand">?</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm md:flex">
          <Link
            to="/servicos"
            className="text-muted-foreground transition hover:text-foreground [&.active]:text-foreground [&.active]:font-semibold"
          >
            Serviços
          </Link>
          <Link
            to="/profissionais"
            className="text-muted-foreground transition hover:text-foreground [&.active]:text-foreground [&.active]:font-semibold"
          >
            Profissionais
          </Link>
          <Link
            to="/porque"
            className="text-muted-foreground transition hover:text-foreground [&.active]:text-foreground [&.active]:font-semibold"
          >
            Por que nós
          </Link>
          <Link
            to="/contato"
            className="text-muted-foreground transition hover:text-foreground [&.active]:text-foreground [&.active]:font-semibold"
          >
            Contato
          </Link>
          <Link
            to="/para-profissionais"
            className="text-muted-foreground transition hover:text-foreground [&.active]:text-foreground [&.active]:font-semibold"
          >
            Trabalhe conosco
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          {!isProfissional && !isAdmin && (
            <Button
              onClick={() => navigate({ to: "/servicos" })}
              size="sm"
              className="rounded-full bg-brand text-white hover:bg-brand/90 hidden lg:flex font-bold px-8 h-10 shadow-md"
            >
              Orçamento
            </Button>
          )}

          <div id="header-menu-container" className="flex items-center gap-4 relative">
            {isLoggedIn && (
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowProfileMenu(false);
                }}
                className="relative h-11 w-11 rounded-full border border-border bg-white flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
              >
                <Bell className="h-5 w-5 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute top-[10px] right-[10px] h-2.5 w-2.5 rounded-full bg-brand border-2 border-white box-content" />
                )}
              </button>
            )}

            <button
              onClick={() => {
                setShowProfileMenu(!showProfileMenu);
                setShowNotifications(false);
              }}
              className={`h-11 w-11 rounded-full border flex items-center justify-center font-bold text-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand/20 overflow-hidden ${isLoggedIn && !profilePhoto ? "bg-brand/10 border-brand/20 text-brand hover:bg-brand/20" : "bg-white border-border text-muted-foreground hover:bg-slate-50"}`}
            >
              {isLoggedIn ? (
                profilePhoto ? (
                  <img src={profilePhoto} className="h-full w-full object-cover" alt="Perfil" />
                ) : (
                  userData?.name?.charAt(0).toUpperCase() || "U"
                )
              ) : (
                <User className="h-5 w-5" />
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && isLoggedIn && (
              <div className="absolute top-14 right-14 w-80 bg-white rounded-2xl border border-border shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                <div className="p-4 border-b border-border flex justify-between items-center bg-slate-50">
                  <h4 className="font-bold">Notificações</h4>
                  {unreadCount > 0 && (
                    <button
                      className="text-[10px] text-brand font-bold uppercase hover:underline"
                      onClick={markAllAsRead}
                    >
                      Marcar como lidas
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      Nenhuma notificação.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-4 border-b border-border transition-colors cursor-pointer group ${n.read ? "bg-white opacity-60 hover:opacity-100" : "bg-brand/5 hover:bg-brand/10"}`}
                        onClick={() => openNotification(n)}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <p
                            className={`text-sm font-bold group-hover:text-brand transition-colors ${!n.read ? "text-brand" : "text-foreground"}`}
                          >
                            {n.title}
                          </p>
                          {!n.read && <div className="h-2 w-2 rounded-full bg-brand mt-1.5" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                          {n.desc}
                        </p>
                        <div className="flex justify-between items-center mt-3">
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                            {n.time}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-2 border-t border-border bg-slate-50">
                  <button
                    className="block w-full text-center text-xs font-bold text-[#b85c45] uppercase hover:underline py-2"
                    onClick={() => {
                      setShowNotifications(false);
                      if (isAdmin && !isProfissional) {
                        navigate({ to: "/admin" });
                      } else if (isProfissional) {
                        navigate({ to: "/profissional", search: { tab: "notificacoes" } as any });
                      } else {
                        navigate({ to: "/cliente", search: { tab: "notificacoes" } as any });
                      }
                    }}
                  >
                    Ver todas as notificações
                  </button>
                </div>
              </div>
            )}

            {/* Profile Dropdown */}
            {showProfileMenu && (
              <div className="absolute top-14 right-0 w-56 bg-white rounded-2xl border border-border shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                {isLoggedIn ? (
                  <>
                    <div className="p-4 border-b border-border bg-slate-50">
                      <p className="font-bold text-sm truncate">{userData.name || "Minha conta"}</p>
                      <p className="text-xs text-muted-foreground truncate">{userData.email}</p>
                    </div>
                    <div className="p-2">
                      {isAdmin && (
                        <Link
                          to="/admin"
                          className="w-full text-left px-4 py-2.5 text-sm font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-2 mb-1"
                          onClick={() => setShowProfileMenu(false)}
                        >
                          <ShieldCheck className="h-4 w-4 text-slate-600" /> Painel Administrativo
                        </Link>
                      )}
                      {isProfissional && (
                        <Link
                          to="/profissional"
                          className="w-full text-left px-4 py-2.5 text-sm font-bold text-brand bg-brand/5 hover:bg-brand/10 rounded-xl transition-colors flex items-center gap-2 mb-1"
                          onClick={() => setShowProfileMenu(false)}
                        >
                          <Briefcase className="h-4 w-4" /> Painel Profissional
                        </Link>
                      )}

                      {/* Para Admins (que não são profissionais), mostramos o atalho de Configurações para a rota /cliente */}
                      {isAdmin && !isProfissional ? (
                        <Link
                          to="/cliente"
                          search={{ tab: "dados" } as any}
                          className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-2"
                          onClick={() => setShowProfileMenu(false)}
                        >
                          <Settings className="h-4 w-4" /> Configurações do Perfil
                        </Link>
                      ) : !isProfissional ? (
                        /* Se for apenas um cliente normal, mostramos as opções de cliente */
                        <>
                          <Link
                            to="/cliente"
                            search={{ tab: "inicio" } as any}
                            className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-2"
                            onClick={() => setShowProfileMenu(false)}
                          >
                            <User className="h-4 w-4" /> Minha Conta
                          </Link>
                          <Link
                            to="/cliente"
                            search={{ tab: "pedidos" } as any}
                            className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-2"
                            onClick={() => setShowProfileMenu(false)}
                          >
                            <FileText className="h-4 w-4" /> Meus pedidos
                          </Link>
                        </>
                      ) : null}
                    </div>
                    <div className="p-2 border-t border-border">
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-2"
                      >
                        <LogOut className="h-4 w-4" /> Sair da conta
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="p-2">
                    <Link
                      to="/login"
                      className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-2"
                      onClick={() => setShowProfileMenu(false)}
                    >
                      Entrar
                    </Link>
                    <Link
                      to="/login"
                      className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-2"
                      onClick={() => setShowProfileMenu(false)}
                    >
                      Cadastre-se
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

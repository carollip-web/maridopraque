import { useState } from "react";
import { Mail, FileText, MessageCircle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { AdminEmails } from "./AdminEmails";
import { AdminEmailTemplates } from "./AdminEmailTemplates";
import { AdminPlataformaConfig } from "./AdminPlataformaConfig";

type SubSection = "emails" | "templates" | "whatsapp";

export function AdminComunicacao() {
  const { adminLevel } = useAuth();
  const [tab, setTab] = useState<SubSection>("emails");
  const isSuper = adminLevel === "super_admin";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h2 className="text-2xl font-bold text-slate-900">Comunicação</h2>
        <p className="text-sm text-slate-500">
          Centralize tudo que sai da plataforma: e-mails enviados, modelos e mensagens padrão de WhatsApp.
        </p>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as SubSection)} className="space-y-6">
        <TabsList className="bg-white border border-border h-auto p-1.5 rounded-2xl shadow-sm">
          <TabsTrigger value="emails" className="rounded-xl px-4 py-2 gap-2 data-[state=active]:bg-slate-900 data-[state=active]:text-white">
            <Mail className="h-4 w-4" /> E-mails enviados
          </TabsTrigger>
          <TabsTrigger value="templates" className="rounded-xl px-4 py-2 gap-2 data-[state=active]:bg-slate-900 data-[state=active]:text-white">
            <FileText className="h-4 w-4" /> Templates de e-mail
          </TabsTrigger>
          {isSuper && (
            <TabsTrigger value="whatsapp" className="rounded-xl px-4 py-2 gap-2 data-[state=active]:bg-slate-900 data-[state=active]:text-white">
              <MessageCircle className="h-4 w-4" /> WhatsApp & Marca
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="emails" className="mt-0">
          <AdminEmails />
        </TabsContent>
        <TabsContent value="templates" className="mt-0">
          <AdminEmailTemplates />
        </TabsContent>
        {isSuper && (
          <TabsContent value="whatsapp" className="mt-0">
            <AdminPlataformaConfig />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

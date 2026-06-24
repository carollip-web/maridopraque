import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { editarOrcamento } from "@/lib/orcamentos.functions";
import {
  OrcamentoDraft,
  OrcamentoRow,
  OrcMaterial,
  Servico,
  WizardStep,
} from "./types";

const novoSchema = z.object({
  serviceId: z.string().uuid({ message: "Selecione um serviço válido." }),
  descricao: z.string().trim().max(2000, "Descrição muito longa.").optional(),
  tipoAtendimento: z.string().min(1, "Selecione o tipo de atendimento."),
  dataPreferida: z.string().min(1, "Selecione a data desejada."),
  periodoPreferido: z.string().min(1, "Selecione o período."),
  horarioPreferido: z.string().optional(),
  flexibilidadeAgenda: z.string().optional(),
  materiais: z
    .array(
      z.object({
        materialId: z.string().uuid(),
        quantidade: z.number().int().min(1).max(1000),
      }),
    )
    .max(50, "Máximo de 50 itens de material."),
});

interface UseOrcamentoFormArgs {
  user: User | null;
  servicos: Servico[];
  orcMats: Record<string, OrcMaterial[]>;
  search: {
    new?: number;
    serviceName?: string;
    serviceId?: string;
    categoria?: string;
  };
  refresh: () => void;
  onClearStoredDraft: () => void;
}

export function useOrcamentoForm({
  user,
  servicos,
  orcMats,
  search,
  refresh,
  onClearStoredDraft,
}: UseOrcamentoFormArgs) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const editar = useServerFn(editarOrcamento);

  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<WizardStep>(1);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields
  const [selServiceId, setSelServiceId] = useState<string>("");
  const [descricao, setDescricao] = useState("");
  const [tipoAtendimento, setTipoAtendimento] = useState<string>("");
  const [dataPreferida, setDataPreferida] = useState<string>("");
  const [periodoPreferido, setPeriodoPreferido] = useState<string>("manha");
  const [horarioPreferido, setHorarioPreferido] = useState<string>("");
  const [flexibilidadeAgenda, setFlexibilidadeAgenda] =
    useState<string>("flexivel");
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [metragemM2, setMetragemM2] = useState<string>("");

  const [fotos, setFotos] = useState<string[]>([]);
  const [guestFiles, setGuestFiles] = useState<
    { file: File; previewUrl: string }[]
  >([]);

  // Guest signup fields
  const [guestEmail, setGuestEmail] = useState("");
  const [guestSenha, setGuestSenha] = useState("");
  const [guestNome, setGuestNome] = useState("");

  const selServico = servicos.find((s) => s.id === selServiceId);

  const togglePick = useCallback((id: string, defaultQty: number) => {
    setPicked((prev) => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else next[id] = defaultQty;
      return next;
    });
  }, []);

  const resetForm = useCallback(() => {
    setSelServiceId("");
    setDescricao("");
    setTipoAtendimento("");
    setDataPreferida("");
    setPeriodoPreferido("manha");
    setHorarioPreferido("");
    setFlexibilidadeAgenda("flexivel");
    setPicked({});
    setMetragemM2("");
    setFotos([]);
    setStep(1);
    setShowNew(false);
    setEditingId(null);
  }, []);


  const applyDraft = useCallback((d: OrcamentoDraft) => {
    setSelServiceId(d.selServiceId ?? "");
    setDescricao(d.descricao ?? "");
    setTipoAtendimento(d.tipoAtendimento ?? "");
    setDataPreferida(d.dataPreferida ?? "");
    setPeriodoPreferido(d.periodoPreferido ?? "manha");
    setHorarioPreferido(d.horarioPreferido ?? "");
    setFlexibilidadeAgenda(d.flexibilidadeAgenda ?? "flexivel");
    setPicked(d.picked ?? {});
    setMetragemM2(d.metragemM2 ?? "");
    setStep(d.step ?? 1);
    setEditingId(null);
    setShowNew(true);
  }, []);

  const goToStep2 = useCallback(() => {
    if (!selServico) {
      toast.error("Selecione um serviço para continuar.");
      return;
    }
    if (selServico.preco_min == null || selServico.preco_max == null) {
      toast.error("Este serviço ainda não tem preço tabelado. Escolha outro.");
      return;
    }
    if (Number(selServico.preco_min) > Number(selServico.preco_max)) {
      toast.error("Range de preço inválido para este serviço.");
      return;
    }
    const isM2 = /\(m²?\)|\bm2\b|metro quadrado/i.test(selServico.nome);
    if (isM2) {
      const m = parseFloat(metragemM2.replace(",", "."));
      if (!Number.isFinite(m) || m <= 0) {
        toast.error("Informe a metragem em m² para este serviço.");
        return;
      }
    }
    setStep(2);
  }, [selServico, metragemM2]);

  const startEdit = useCallback(
    (o: OrcamentoRow) => {
      if (o.status !== "customizado_pendente") {
        toast.error("Não é mais possível editar este orçamento.");
        return;
      }
      setEditingId(o.id);
      setSelServiceId(o.service_id ?? "");
      setDescricao(o.descricao ?? "");
      setMetragemM2(o.metragem_m2 != null ? String(o.metragem_m2).replace(".", ",") : "");
      const mats = orcMats[o.id] ?? [];
      const p: Record<string, number> = {};
      mats.forEach((m) => {
        if (m.material_id) p[m.material_id] = Number(m.quantidade);
      });
      setPicked(p);
      setFotos(((o as unknown as Record<string, unknown>).fotos_problema as string[]) ?? []);
      setStep(1);
      setShowNew(true);
    },

    [orcMats],
  );

  // ---------- Auto-match: serviço vindo do catálogo via querystring ----------
  const [autoMatched, setAutoMatched] = useState<string | null>(null);
  useEffect(() => {
    if (!search.new && !search.serviceId && !search.serviceName) return;
    setShowNew(true);
    if (!servicos.length) return;

    const key = `${search.serviceId ?? ""}|${search.serviceName ?? ""}|${search.new ?? ""}`;
    if (autoMatched === key) return;
    setAutoMatched(key);

    const norm = (t: string) =>
      t
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    let matched: Servico | undefined;
    if (search.serviceId) {
      matched = servicos.find((x) => x.id === search.serviceId);
      if (matched && search.categoria) {
        if (norm(matched.categoria) !== norm(search.categoria)) {
          toast.error(
            `O serviço selecionado não pertence à categoria "${search.categoria}".`,
          );
          matched = undefined;
        }
      }
      if (!matched && !search.serviceName) {
        toast.info(
          "O serviço escolhido não está mais disponível. Selecione outro abaixo.",
        );
      }
    }
    if (!matched && search.serviceName) {
      const target = norm(search.serviceName);
      const targetTokens = target.split(/\s+/).filter((t) => t.length >= 3);
      const pool = search.categoria
        ? servicos.filter((x) => norm(x.categoria) === norm(search.categoria!))
        : servicos;
      matched =
        pool.find((x) => norm(x.nome) === target) ||
        pool.find(
          (x) => norm(x.nome).includes(target) || target.includes(norm(x.nome)),
        ) ||
        (targetTokens.length
          ? pool.find((x) => {
              const n = norm(x.nome);
              return targetTokens.some((t) => n.includes(t));
            })
          : undefined);
    }

    if (matched) {
      setSelServiceId(matched.id);
      setStep(1);
    } else if (search.serviceId || search.serviceName) {
      const label = search.serviceName ?? "selecionado";
      toast.info(
        `"${label}" não está no catálogo. Escolha o serviço mais próximo abaixo.`,
      );
      setStep(1);
    }
  }, [
    servicos,
    search.new,
    search.serviceId,
    search.serviceName,
    search.categoria,
    autoMatched,
  ]);

  // Re-sincroniza dropdown se usuário voltar para step 1 sem seleção
  useEffect(() => {
    if (step !== 1 || selServiceId || !showNew || editingId) return;
    if (!servicos.length) return;
    if (!search.serviceId && !search.serviceName) return;
    const norm = (t: string) =>
      t
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    let m: Servico | undefined;
    if (search.serviceId) m = servicos.find((x) => x.id === search.serviceId);
    if (!m && search.serviceName) {
      const target = norm(search.serviceName);
      const pool = search.categoria
        ? servicos.filter((x) => norm(x.categoria) === norm(search.categoria!))
        : servicos;
      m =
        pool.find((x) => norm(x.nome) === target) ||
        pool.find(
          (x) => norm(x.nome).includes(target) || target.includes(norm(x.nome)),
        );
    }
    if (m) setSelServiceId(m.id);
  }, [
    step,
    selServiceId,
    showNew,
    editingId,
    servicos,
    search.serviceId,
    search.serviceName,
    search.categoria,
  ]);

  // ---------- Envio / atualização ----------
  const handleNew = useCallback(async () => {
    if (!selServico) return;

    let userId = user?.id;
    let novoIdCriado: string | null = null;

    // Visitante: criar conta antes
    if (!user) {
      if (!guestEmail.trim() || !guestSenha.trim() || !guestNome.trim()) {
        toast.error(
          "Preencha nome, e-mail e senha para enviar a solicitação.",
        );
        return;
      }
      setSaving(true);
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: guestEmail.trim(),
        password: guestSenha,
        options: { data: { nome: guestNome.trim() } },
      });
      const erroJaExiste =
        signUpError?.message?.toLowerCase().includes("registered") ||
        signUpError?.message?.toLowerCase().includes("already");
      const usuarioFantasma =
        !signUpError &&
        signUpData?.user &&
        Array.isArray(signUpData.user.identities) &&
        signUpData.user.identities.length === 0;

      if (signUpError && !erroJaExiste) {
        setSaving(false);
        toast.error(`Não foi possível criar a conta: ${signUpError.message}`);
        return;
      }

      if (erroJaExiste || usuarioFantasma) {
        const { data: loginData, error: loginErr } =
          await supabase.auth.signInWithPassword({
            email: guestEmail.trim(),
            password: guestSenha,
          });
        if (loginErr) {
          setSaving(false);
          toast.error(
            "Esse e-mail já tem conta, mas a senha não confere. Digite a senha correta da sua conta.",
          );
          return;
        }
        userId = loginData.user?.id;
      } else {
        userId = signUpData.user?.id;
      }
      if (!userId) {
        setSaving(false);
        toast.error(
          "Conta criada, mas sessão não iniciada. Faça login para continuar.",
        );
        return;
      }

      let sessaoOk = false;
      for (let i = 0; i < 10; i++) {
        const { data: sess } = await supabase.auth.getSession();
        if (sess?.session?.user?.id === userId) {
          sessaoOk = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 200));
      }
      if (!sessaoOk) {
        setSaving(false);
        toast.error(
          "Sua conta foi criada. Recarregue a página e tente enviar o pedido novamente.",
        );
        return;
      }

      // Upload de arquivos do visitante
      if (guestFiles.length > 0 && userId) {
        const uploadedUrls: string[] = [];
        for (const { file } of guestFiles) {
          const isVideo = file.type.startsWith("video/");
          const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
          const key = `${userId}/problema/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("orcamento-fotos")
            .upload(key, file, {
              cacheControl: "3600",
              upsert: false,
              contentType: file.type || undefined,
            });
          if (upErr) {
            console.error("[useOrcamentoForm] upload guest falhou", upErr);
            toast.error(`Falha ao enviar ${file.name}: ${upErr.message}`);
            continue;
          }
          const { data: pub } = supabase.storage
            .from("orcamento-fotos")
            .getPublicUrl(key);
          uploadedUrls.push(pub.publicUrl);
        }
        if (uploadedUrls.length > 0) {
          setFotos((prev) => [...prev, ...uploadedUrls]);
          fotos.push(...uploadedUrls);
        }
        guestFiles.forEach((g) => {
          try {
            URL.revokeObjectURL(g.previewUrl);
          } catch {}
        });
        setGuestFiles([]);
      }
    }

    const payload = {
      serviceId: selServico.id,
      serviceName: selServico.nome,
      descricao: descricao.trim() || undefined,
      tipoAtendimento,
      dataPreferida,
      periodoPreferido,
      horarioPreferido: horarioPreferido || undefined,
      flexibilidadeAgenda,
      materiais: Object.entries(picked).map(([materialId, quantidade]) => ({
        materialId,
        quantidade,
      })),
    };

    const parsed = novoSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await editar({
          data: {
            orcamentoId: editingId,
            descricao: payload.descricao,
            materiais: payload.materiais,
          },
        });
        const metragemEdit = (() => {
          const v = parseFloat(metragemM2.replace(",", "."));
          return Number.isFinite(v) && v > 0 ? v : null;
        })();
        await supabase
          .from("orcamentos")
          .update({ fotos_problema: fotos, metragem_m2: metragemEdit } as never)
          .eq("id", editingId);
        toast.success("Orçamento atualizado.");

      } else {
        const metragemNum = (() => {
          const v = parseFloat(metragemM2.replace(",", "."));
          return Number.isFinite(v) && v > 0 ? v : null;
        })();
        const insertPayload = {
          cliente_id: user?.id as string,
          service_id: payload.serviceId,
          service_name: payload.serviceName,
          descricao: payload.descricao ?? null,
          fotos_problema: Array.isArray(fotos) ? fotos : [],
          tipo_atendimento: payload.tipoAtendimento || null,
          data_preferida: payload.dataPreferida || null,
          periodo_preferido: payload.periodoPreferido || null,
          horario_preferido: payload.horarioPreferido || null,
          flexibilidade_agenda: payload.flexibilidadeAgenda || "flexivel",
          metragem_m2: metragemNum,
          status: "customizado_pendente",
        };


        const { data: novoOrcamento, error: orcamentoError } = await supabase
          .from("orcamentos")
          .insert(insertPayload as never)
          .select("*")
          .single();

        if (orcamentoError) {
          toast.error(
            `Erro ao criar pedido: ${orcamentoError.code || ""} ${orcamentoError.message}`,
          );
          console.error("[useOrcamentoForm.handleNew] erro detalhado", {
            code: orcamentoError.code,
            message: orcamentoError.message,
            details: orcamentoError.details,
            hint: orcamentoError.hint,
            payload: insertPayload,
          });
          throw orcamentoError;
        }

        const novoId = novoOrcamento?.id;
        if (!novoId) throw new Error("Pedido criado sem ID retornado.");
        novoIdCriado = novoId;

        const { data: confirmacao, error: confirmacaoError } = await supabase
          .from("orcamentos")
          .select(
            "id,service_name,status,cliente_id,tipo_atendimento,data_preferida,periodo_preferido,horario_preferido,created_at",
          )
          .eq("id", novoId)
          .maybeSingle();
        if (confirmacaoError || !confirmacao) {
          console.error(
            "[useOrcamentoForm.handleNew] confirmação falhou",
            confirmacaoError,
          );
          toast.error("Pedido não foi confirmado no banco.", {
            description: confirmacaoError?.message,
          });
          throw new Error("Confirmação do pedido falhou.");
        }

        if (payload.materiais.length > 0) {
          const materialIds = payload.materiais.map((m) => m.materialId);
          const { data: materiaisRows, error: materiaisError } = await supabase
            .from("materiais")
            .select("id, nome, unidade, preco_atual")
            .in("id", materialIds);
          if (materiaisError) throw materiaisError;

          const materialItems = payload.materiais
            .map((m) => {
              const material = materiaisRows?.find(
                (row) => row.id === m.materialId,
              );
              if (!material) return null;
              return {
                orcamento_id: novoId,
                material_id: material.id,
                nome_snapshot: material.nome,
                unidade_snapshot: material.unidade,
                quantidade: m.quantidade,
                preco_unitario: Number(material.preco_atual),
              };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);

          if (materialItems.length > 0) {
            const { error: itensError } = await supabase
              .from("orcamento_materiais")
              .insert(materialItems);
            if (itensError) throw itensError;
          }
        }

        toast.success(
          "Solicitação enviada! Aguarde a confirmação do profissional.",
        );
        queryClient.invalidateQueries({ queryKey: ["cliente"] });
        onClearStoredDraft();
      }

      resetForm();
      setShowNew(false);

      if (!editingId && novoIdCriado) {
        try {
          window.sessionStorage.setItem(
            "abrir_pedido_apos_login",
            novoIdCriado,
          );
        } catch {}
        navigate({
          to: "/cliente",
          search: { tab: "pedidos", pedidoId: novoIdCriado },
        });
      } else {
        refresh();
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }, [
    user,
    selServico,
    descricao,
    tipoAtendimento,
    dataPreferida,
    periodoPreferido,
    horarioPreferido,
    flexibilidadeAgenda,
    picked,
    fotos,
    guestFiles,
    guestEmail,
    guestSenha,
    guestNome,
    editingId,
    editar,
    queryClient,
    navigate,
    refresh,
    resetForm,
    onClearStoredDraft,
  ]);

  return {
    // wizard mode
    showNew,
    setShowNew,
    saving,
    step,
    setStep,
    editingId,
    setEditingId,

    // form fields
    selServiceId,
    setSelServiceId,
    descricao,
    setDescricao,
    tipoAtendimento,
    setTipoAtendimento,
    dataPreferida,
    setDataPreferida,
    periodoPreferido,
    setPeriodoPreferido,
    horarioPreferido,
    setHorarioPreferido,
    flexibilidadeAgenda,
    setFlexibilidadeAgenda,
    picked,
    setPicked,
    fotos,
    setFotos,
    guestFiles,
    setGuestFiles,

    // guest
    guestEmail,
    setGuestEmail,
    guestSenha,
    setGuestSenha,
    guestNome,
    setGuestNome,

    // actions
    togglePick,
    resetForm,
    applyDraft,
    goToStep2,
    startEdit,
    handleNew,
  };
}

export type OrcamentoFormState = ReturnType<typeof useOrcamentoForm>;

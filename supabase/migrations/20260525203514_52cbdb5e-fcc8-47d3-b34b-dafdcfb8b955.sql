
-- ============================================================
-- DELTA: Anexar todos os triggers ausentes no banco
-- (Funções já existem; faltam apenas os CREATE TRIGGER)
-- BTG é pulado.
-- ============================================================

-- profiles
DROP TRIGGER IF EXISTS profiles_updated ON public.profiles;
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- orcamentos: updated_at
DROP TRIGGER IF EXISTS orcamentos_updated ON public.orcamentos;
CREATE TRIGGER orcamentos_updated BEFORE UPDATE ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- orcamentos: process new (auto-aprovacao, valor sugerido)
DROP TRIGGER IF EXISTS orcamentos_process_new ON public.orcamentos;
CREATE TRIGGER orcamentos_process_new BEFORE INSERT ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.process_new_orcamento();

-- orcamentos: notificações de mudança de status
DROP TRIGGER IF EXISTS orcamentos_notify ON public.orcamentos;
CREATE TRIGGER orcamentos_notify AFTER INSERT OR UPDATE ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.notify_orcamento_change();

-- orcamentos: notificação de conclusão (avaliação)
DROP TRIGGER IF EXISTS trg_notify_orcamento_concluido ON public.orcamentos;
CREATE TRIGGER trg_notify_orcamento_concluido AFTER UPDATE ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.notify_orcamento_concluido();

-- orcamentos: recalcular valor (valor_servico + taxa_material)
DROP TRIGGER IF EXISTS trg_orc_valor ON public.orcamentos;
CREATE TRIGGER trg_orc_valor BEFORE INSERT OR UPDATE ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.recalcular_orcamento_total_self();

-- orcamentos: notificar profissionais sobre novo pedido na área
DROP TRIGGER IF EXISTS tr_notify_professionals_new_order ON public.orcamentos;
CREATE TRIGGER tr_notify_professionals_new_order AFTER INSERT ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.notify_professionals_new_order();

-- orcamento_materiais: recalcular total ao alterar materiais
DROP TRIGGER IF EXISTS trg_om_recalc ON public.orcamento_materiais;
CREATE TRIGGER trg_om_recalc AFTER INSERT OR UPDATE OR DELETE ON public.orcamento_materiais
  FOR EACH ROW EXECUTE FUNCTION public.recalcular_orcamento_total();

-- materiais: updated_at
DROP TRIGGER IF EXISTS trg_materiais_updated ON public.materiais;
CREATE TRIGGER trg_materiais_updated BEFORE UPDATE ON public.materiais
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- profissional_perfil: updated_at + notificação aprovação
DROP TRIGGER IF EXISTS set_perfil_updated_at ON public.profissional_perfil;
CREATE TRIGGER set_perfil_updated_at BEFORE UPDATE ON public.profissional_perfil
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_notify_profissional_approval ON public.profissional_perfil;
CREATE TRIGGER tr_notify_profissional_approval AFTER UPDATE ON public.profissional_perfil
  FOR EACH ROW EXECUTE FUNCTION public.notify_profissional_approval();

-- cliente_enderecos: updated_at
DROP TRIGGER IF EXISTS cliente_enderecos_updated_at ON public.cliente_enderecos;
CREATE TRIGGER cliente_enderecos_updated_at BEFORE UPDATE ON public.cliente_enderecos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- mensagens: notificar destinatário
DROP TRIGGER IF EXISTS trg_nova_mensagem ON public.mensagens;
CREATE TRIGGER trg_nova_mensagem AFTER INSERT ON public.mensagens
  FOR EACH ROW EXECUTE FUNCTION public.notify_nova_mensagem();

-- panico_eventos: notificar admins
DROP TRIGGER IF EXISTS trg_notify_panico ON public.panico_eventos;
CREATE TRIGGER trg_notify_panico AFTER INSERT ON public.panico_eventos
  FOR EACH ROW EXECUTE FUNCTION public.notify_panico();

-- propostas: updated_at + notificar cliente
DROP TRIGGER IF EXISTS trg_propostas_updated ON public.propostas;
CREATE TRIGGER trg_propostas_updated BEFORE UPDATE ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_proposta_created ON public.propostas;
CREATE TRIGGER trg_proposta_created AFTER INSERT ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.notify_proposta_created();

-- profissional_bloqueios_agenda: updated_at
DROP TRIGGER IF EXISTS tr_profissional_bloqueios_agenda_updated_at ON public.profissional_bloqueios_agenda;
CREATE TRIGGER tr_profissional_bloqueios_agenda_updated_at BEFORE UPDATE ON public.profissional_bloqueios_agenda
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- repasses_profissionais: updated_at
DROP TRIGGER IF EXISTS repasses_updated_at ON public.repasses_profissionais;
CREATE TRIGGER repasses_updated_at BEFORE UPDATE ON public.repasses_profissionais
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- marketplace_integracoes: updated_at
DROP TRIGGER IF EXISTS tr_marketplace_integracoes_updated_at ON public.marketplace_integracoes;
CREATE TRIGGER tr_marketplace_integracoes_updated_at BEFORE UPDATE ON public.marketplace_integracoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- avaliacoes: notificar resposta do profissional
DROP TRIGGER IF EXISTS tr_avaliacao_resposta_notificacao ON public.avaliacoes;
CREATE TRIGGER tr_avaliacao_resposta_notificacao AFTER UPDATE ON public.avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.handle_avaliacao_resposta_notificacao();

-- suporte_tickets: updated_at
DROP TRIGGER IF EXISTS trg_suporte_tickets_updated_at ON public.suporte_tickets;
CREATE TRIGGER trg_suporte_tickets_updated_at BEFORE UPDATE ON public.suporte_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- CRÍTICO: trigger no auth.users para criar profile + role no signup
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

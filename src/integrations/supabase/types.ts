export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          details: Json
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          details?: Json
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          details?: Json
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      avaliacoes: {
        Row: {
          cliente_id: string
          comentario: string | null
          created_at: string
          id: string
          nota: number
          orcamento_id: string
          profissional_id: string | null
          resposta_em: string | null
          resposta_profissional: string | null
        }
        Insert: {
          cliente_id: string
          comentario?: string | null
          created_at?: string
          id?: string
          nota: number
          orcamento_id: string
          profissional_id?: string | null
          resposta_em?: string | null
          resposta_profissional?: string | null
        }
        Update: {
          cliente_id?: string
          comentario?: string | null
          created_at?: string
          id?: string
          nota?: number
          orcamento_id?: string
          profissional_id?: string | null
          resposta_em?: string | null
          resposta_profissional?: string | null
        }
        Relationships: []
      }
      btg_cobrancas: {
        Row: {
          amount: number
          btg_request: Json | null
          btg_response: Json | null
          cliente_id: string
          created_at: string
          emv: string | null
          expires_at: string | null
          id: string
          orcamento_id: string
          pagamento_id: string | null
          paid_amount: number | null
          paid_at: string | null
          payer_name: string | null
          payer_tax_id: string | null
          qrcode_url: string | null
          status: string
          tx_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          btg_request?: Json | null
          btg_response?: Json | null
          cliente_id: string
          created_at?: string
          emv?: string | null
          expires_at?: string | null
          id?: string
          orcamento_id: string
          pagamento_id?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payer_name?: string | null
          payer_tax_id?: string | null
          qrcode_url?: string | null
          status?: string
          tx_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          btg_request?: Json | null
          btg_response?: Json | null
          cliente_id?: string
          created_at?: string
          emv?: string | null
          expires_at?: string | null
          id?: string
          orcamento_id?: string
          pagamento_id?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payer_name?: string | null
          payer_tax_id?: string | null
          qrcode_url?: string | null
          status?: string
          tx_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      cliente_enderecos: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          created_at: string
          id: string
          is_padrao: boolean
          lat: number | null
          lng: number | null
          logradouro: string
          numero: string | null
          rotulo: string
          uf: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          created_at?: string
          id?: string
          is_padrao?: boolean
          lat?: number | null
          lng?: number | null
          logradouro: string
          numero?: string | null
          rotulo?: string
          uf?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          created_at?: string
          id?: string
          is_padrao?: boolean
          lat?: number | null
          lng?: number | null
          logradouro?: string
          numero?: string | null
          rotulo?: string
          uf?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cliente_favoritos: {
        Row: {
          cliente_id: string
          created_at: string | null
          id: string
          profissional_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          id?: string
          profissional_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          id?: string
          profissional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_favoritos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_favoritos_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      indicacoes: {
        Row: {
          codigo: string
          created_at: string
          desconto_percent: number
          id: string
          user_id: string
          usos: number
        }
        Insert: {
          codigo: string
          created_at?: string
          desconto_percent?: number
          id?: string
          user_id: string
          usos?: number
        }
        Update: {
          codigo?: string
          created_at?: string
          desconto_percent?: number
          id?: string
          user_id?: string
          usos?: number
        }
        Relationships: []
      }
      marketplace_integracoes: {
        Row: {
          access_token: string | null
          account_id: string | null
          company_id: string | null
          connected_at: string | null
          connected_by: string | null
          created_at: string
          extra: Json | null
          id: string
          provider: string
          refresh_token: string | null
          scope: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          account_id?: string | null
          company_id?: string | null
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          extra?: Json | null
          id?: string
          provider: string
          refresh_token?: string | null
          scope?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          account_id?: string | null
          company_id?: string | null
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          extra?: Json | null
          id?: string
          provider?: string
          refresh_token?: string | null
          scope?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      materiais: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          marketplace_url: string | null
          nome: string
          preco_atual: number
          preco_atualizado_em: string
          preco_base: number
          preco_fonte: string
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          marketplace_url?: string | null
          nome: string
          preco_atual?: number
          preco_atualizado_em?: string
          preco_base?: number
          preco_fonte?: string
          unidade?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          marketplace_url?: string | null
          nome?: string
          preco_atual?: number
          preco_atualizado_em?: string
          preco_base?: number
          preco_fonte?: string
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
      mensagens: {
        Row: {
          created_at: string
          destinatario_id: string
          id: string
          lida: boolean
          orcamento_id: string
          remetente_id: string
          texto: string
        }
        Insert: {
          created_at?: string
          destinatario_id: string
          id?: string
          lida?: boolean
          orcamento_id: string
          remetente_id: string
          texto: string
        }
        Update: {
          created_at?: string
          destinatario_id?: string
          id?: string
          lida?: boolean
          orcamento_id?: string
          remetente_id?: string
          texto?: string
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          link: string | null
          mensagem: string
          orcamento_id: string | null
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem: string
          orcamento_id?: string | null
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string
          orcamento_id?: string | null
          titulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_materiais: {
        Row: {
          created_at: string
          id: string
          material_id: string
          nome_snapshot: string
          orcamento_id: string
          preco_unitario: number
          quantidade: number
          subtotal: number | null
          unidade_snapshot: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          nome_snapshot: string
          orcamento_id: string
          preco_unitario?: number
          quantidade?: number
          subtotal?: number | null
          unidade_snapshot?: string
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          nome_snapshot?: string
          orcamento_id?: string
          preco_unitario?: number
          quantidade?: number
          subtotal?: number | null
          unidade_snapshot?: string
        }
        Relationships: []
      }
      orcamento_recusas: {
        Row: {
          created_at: string
          id: string
          motivo: string | null
          orcamento_id: string
          profissional_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          motivo?: string | null
          orcamento_id: string
          profissional_id: string
        }
        Update: {
          created_at?: string
          id?: string
          motivo?: string | null
          orcamento_id?: string
          profissional_id?: string
        }
        Relationships: []
      }
      orcamentos: {
        Row: {
          auto_aprovado: boolean
          checkin_em: string | null
          checkin_lat: number | null
          checkin_lng: number | null
          checkout_em: string | null
          checkout_lat: number | null
          checkout_lng: number | null
          cliente_id: string
          created_at: string
          data_agendada: string | null
          data_aprovacao: string | null
          data_pagamento: string | null
          data_preferida: string | null
          descricao: string | null
          flexibilidade_agenda: string | null
          fotos_concluido: string[]
          fotos_problema: string[]
          horario_preferido: string | null
          id: string
          is_test: boolean
          observacoes_profissional: string | null
          periodo_preferido: string | null
          profissional_id: string | null
          reagendamento_solicitado: string | null
          service_id: string | null
          service_name: string
          status: Database["public"]["Enums"]["orcamento_status"]
          taxa_material: number
          tipo_atendimento: string | null
          updated_at: string
          valor: number | null
          valor_servico: number | null
        }
        Insert: {
          auto_aprovado?: boolean
          checkin_em?: string | null
          checkin_lat?: number | null
          checkin_lng?: number | null
          checkout_em?: string | null
          checkout_lat?: number | null
          checkout_lng?: number | null
          cliente_id: string
          created_at?: string
          data_agendada?: string | null
          data_aprovacao?: string | null
          data_pagamento?: string | null
          data_preferida?: string | null
          descricao?: string | null
          flexibilidade_agenda?: string | null
          fotos_concluido?: string[]
          fotos_problema?: string[]
          horario_preferido?: string | null
          id?: string
          is_test?: boolean
          observacoes_profissional?: string | null
          periodo_preferido?: string | null
          profissional_id?: string | null
          reagendamento_solicitado?: string | null
          service_id?: string | null
          service_name: string
          status?: Database["public"]["Enums"]["orcamento_status"]
          taxa_material?: number
          tipo_atendimento?: string | null
          updated_at?: string
          valor?: number | null
          valor_servico?: number | null
        }
        Update: {
          auto_aprovado?: boolean
          checkin_em?: string | null
          checkin_lat?: number | null
          checkin_lng?: number | null
          checkout_em?: string | null
          checkout_lat?: number | null
          checkout_lng?: number | null
          cliente_id?: string
          created_at?: string
          data_agendada?: string | null
          data_aprovacao?: string | null
          data_pagamento?: string | null
          data_preferida?: string | null
          descricao?: string | null
          flexibilidade_agenda?: string | null
          fotos_concluido?: string[]
          fotos_problema?: string[]
          horario_preferido?: string | null
          id?: string
          is_test?: boolean
          observacoes_profissional?: string | null
          periodo_preferido?: string | null
          profissional_id?: string | null
          reagendamento_solicitado?: string | null
          service_id?: string | null
          service_name?: string
          status?: Database["public"]["Enums"]["orcamento_status"]
          taxa_material?: number
          tipo_atendimento?: string | null
          updated_at?: string
          valor?: number | null
          valor_servico?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          checkout_url: string | null
          cliente_id: string
          created_at: string | null
          gateway: string | null
          gateway_payment_id: string | null
          gateway_preference_id: string | null
          gateway_status: string | null
          id: string
          metadata: Json | null
          metodo: string | null
          orcamento_id: string
          paid_at: string | null
          profissional_id: string | null
          status: string
          updated_at: string | null
          valor_restante: number | null
          valor_sinal: number | null
          valor_total: number
          webhook_last_received_at: string | null
        }
        Insert: {
          checkout_url?: string | null
          cliente_id: string
          created_at?: string | null
          gateway?: string | null
          gateway_payment_id?: string | null
          gateway_preference_id?: string | null
          gateway_status?: string | null
          id?: string
          metadata?: Json | null
          metodo?: string | null
          orcamento_id: string
          paid_at?: string | null
          profissional_id?: string | null
          status?: string
          updated_at?: string | null
          valor_restante?: number | null
          valor_sinal?: number | null
          valor_total: number
          webhook_last_received_at?: string | null
        }
        Update: {
          checkout_url?: string | null
          cliente_id?: string
          created_at?: string | null
          gateway?: string | null
          gateway_payment_id?: string | null
          gateway_preference_id?: string | null
          gateway_status?: string | null
          id?: string
          metadata?: Json | null
          metodo?: string | null
          orcamento_id?: string
          paid_at?: string | null
          profissional_id?: string | null
          status?: string
          updated_at?: string | null
          valor_restante?: number | null
          valor_sinal?: number | null
          valor_total?: number
          webhook_last_received_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      panico_eventos: {
        Row: {
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          observacao: string | null
          orcamento_id: string | null
          resolvido: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          observacao?: string | null
          orcamento_id?: string | null
          resolvido?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          observacao?: string | null
          orcamento_id?: string | null
          resolvido?: boolean
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_test: boolean
          nome: string
          total_servicos_pagos: number
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          is_test?: boolean
          nome?: string
          total_servicos_pagos?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_test?: boolean
          nome?: string
          total_servicos_pagos?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      profissionais_pre_cadastro: {
        Row: {
          cidade: string
          created_at: string
          especialidade_principal: string
          id: string
          nome: string
          status: string
          telefone: string
        }
        Insert: {
          cidade: string
          created_at?: string
          especialidade_principal: string
          id?: string
          nome: string
          status?: string
          telefone: string
        }
        Update: {
          cidade?: string
          created_at?: string
          especialidade_principal?: string
          id?: string
          nome?: string
          status?: string
          telefone?: string
        }
        Relationships: []
      }
      profissional_bloqueios: {
        Row: {
          created_at: string
          data_fim: string
          data_inicio: string
          id: string
          motivo: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          data_fim: string
          data_inicio: string
          id?: string
          motivo?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          data_fim?: string
          data_inicio?: string
          id?: string
          motivo?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profissional_bloqueios_agenda: {
        Row: {
          created_at: string
          expires_at: string | null
          fim: string
          id: string
          inicio: string
          motivo: string | null
          orcamento_id: string | null
          profissional_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          fim: string
          id?: string
          inicio: string
          motivo?: string | null
          orcamento_id?: string | null
          profissional_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          fim?: string
          id?: string
          inicio?: string
          motivo?: string | null
          orcamento_id?: string | null
          profissional_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profissional_bloqueios_agenda_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      profissional_disponibilidade: {
        Row: {
          created_at: string
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dia_semana?: number
          hora_fim?: string
          hora_inicio?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      profissional_perfil: {
        Row: {
          anos_experiencia: number | null
          aprovacao_status: string
          aprovado_em: string | null
          aprovado_por: string | null
          atende_emergencias: boolean | null
          ativo: boolean
          bairro: string | null
          bio: string | null
          cadastro_completo: boolean
          cadastro_submetido_em: string | null
          cep: string | null
          chave_pix: string | null
          cidade: string | null
          como_conheceu: string | null
          complemento: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          duracao_padrao_min: number
          endereco: string | null
          especialidades: string[] | null
          estado: string | null
          experiencia_anos: number | null
          foto_documento_frente: string | null
          foto_documento_verso: string | null
          foto_selfie: string | null
          foto_url: string | null
          genero: string | null
          lat: number | null
          lng: number | null
          motivo_rejeicao: string | null
          mp_access_token: string | null
          mp_connected_at: string | null
          mp_refresh_token: string | null
          mp_token_expires_at: string | null
          mp_user_id: string | null
          numero: string | null
          observacoes_cadastro: string | null
          oferece_apoio_feminino: boolean
          onboarding_completo: boolean
          pix_dados_confirmados: boolean
          pix_holder_document: string | null
          pix_holder_name: string | null
          pix_key: string | null
          pix_key_type: string | null
          raio_atendimento_km: number
          repasse_automatico: boolean
          slug: string | null
          telefone: string | null
          termo_aceito_em: string | null
          termo_versao: string | null
          updated_at: string
          user_id: string
          veiculo_proprio: boolean | null
        }
        Insert: {
          anos_experiencia?: number | null
          aprovacao_status?: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          atende_emergencias?: boolean | null
          ativo?: boolean
          bairro?: string | null
          bio?: string | null
          cadastro_completo?: boolean
          cadastro_submetido_em?: string | null
          cep?: string | null
          chave_pix?: string | null
          cidade?: string | null
          como_conheceu?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          duracao_padrao_min?: number
          endereco?: string | null
          especialidades?: string[] | null
          estado?: string | null
          experiencia_anos?: number | null
          foto_documento_frente?: string | null
          foto_documento_verso?: string | null
          foto_selfie?: string | null
          foto_url?: string | null
          genero?: string | null
          lat?: number | null
          lng?: number | null
          motivo_rejeicao?: string | null
          mp_access_token?: string | null
          mp_connected_at?: string | null
          mp_refresh_token?: string | null
          mp_token_expires_at?: string | null
          mp_user_id?: string | null
          numero?: string | null
          observacoes_cadastro?: string | null
          oferece_apoio_feminino?: boolean
          onboarding_completo?: boolean
          pix_dados_confirmados?: boolean
          pix_holder_document?: string | null
          pix_holder_name?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          raio_atendimento_km?: number
          repasse_automatico?: boolean
          slug?: string | null
          telefone?: string | null
          termo_aceito_em?: string | null
          termo_versao?: string | null
          updated_at?: string
          user_id: string
          veiculo_proprio?: boolean | null
        }
        Update: {
          anos_experiencia?: number | null
          aprovacao_status?: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          atende_emergencias?: boolean | null
          ativo?: boolean
          bairro?: string | null
          bio?: string | null
          cadastro_completo?: boolean
          cadastro_submetido_em?: string | null
          cep?: string | null
          chave_pix?: string | null
          cidade?: string | null
          como_conheceu?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          duracao_padrao_min?: number
          endereco?: string | null
          especialidades?: string[] | null
          estado?: string | null
          experiencia_anos?: number | null
          foto_documento_frente?: string | null
          foto_documento_verso?: string | null
          foto_selfie?: string | null
          foto_url?: string | null
          genero?: string | null
          lat?: number | null
          lng?: number | null
          motivo_rejeicao?: string | null
          mp_access_token?: string | null
          mp_connected_at?: string | null
          mp_refresh_token?: string | null
          mp_token_expires_at?: string | null
          mp_user_id?: string | null
          numero?: string | null
          observacoes_cadastro?: string | null
          oferece_apoio_feminino?: boolean
          onboarding_completo?: boolean
          pix_dados_confirmados?: boolean
          pix_holder_document?: string | null
          pix_holder_name?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          raio_atendimento_km?: number
          repasse_automatico?: boolean
          slug?: string | null
          telefone?: string | null
          termo_aceito_em?: string | null
          termo_versao?: string | null
          updated_at?: string
          user_id?: string
          veiculo_proprio?: boolean | null
        }
        Relationships: []
      }
      proposta_materiais: {
        Row: {
          created_at: string
          id: string
          material_id: string
          nome_snapshot: string
          preco_unitario: number
          proposta_id: string
          quantidade: number
          subtotal: number | null
          unidade_snapshot: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          nome_snapshot: string
          preco_unitario?: number
          proposta_id: string
          quantidade?: number
          subtotal?: number | null
          unidade_snapshot?: string
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          nome_snapshot?: string
          preco_unitario?: number
          proposta_id?: string
          quantidade?: number
          subtotal?: number | null
          unidade_snapshot?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_materiais_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_materiais_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      propostas: {
        Row: {
          created_at: string
          id: string
          observacoes: string | null
          orcamento_id: string
          profissional_id: string
          status: string
          updated_at: string
          valor_servico: number
        }
        Insert: {
          created_at?: string
          id?: string
          observacoes?: string | null
          orcamento_id: string
          profissional_id: string
          status?: string
          updated_at?: string
          valor_servico: number
        }
        Update: {
          created_at?: string
          id?: string
          observacoes?: string | null
          orcamento_id?: string
          profissional_id?: string
          status?: string
          updated_at?: string
          valor_servico?: number
        }
        Relationships: [
          {
            foreignKeyName: "propostas_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      repasses_profissionais: {
        Row: {
          approved_at: string | null
          btg_contract_guid: string | null
          btg_response: Json | null
          btg_transfer_id: string | null
          cancelled_at: string | null
          cliente_id: string | null
          created_at: string
          erro: string | null
          failed_at: string | null
          id: string
          operation_needs_approval: boolean
          orcamento_id: string | null
          pagamento_id: string | null
          paid_at: string | null
          pix_holder_document: string | null
          pix_holder_name: string | null
          pix_key: string | null
          pix_key_type: string | null
          processing_at: string | null
          profissional_id: string
          status: string
          updated_at: string
          valor_bruto: number
          valor_comissao_marketplace: number
          valor_liquido: number
        }
        Insert: {
          approved_at?: string | null
          btg_contract_guid?: string | null
          btg_response?: Json | null
          btg_transfer_id?: string | null
          cancelled_at?: string | null
          cliente_id?: string | null
          created_at?: string
          erro?: string | null
          failed_at?: string | null
          id?: string
          operation_needs_approval?: boolean
          orcamento_id?: string | null
          pagamento_id?: string | null
          paid_at?: string | null
          pix_holder_document?: string | null
          pix_holder_name?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          processing_at?: string | null
          profissional_id: string
          status?: string
          updated_at?: string
          valor_bruto?: number
          valor_comissao_marketplace?: number
          valor_liquido?: number
        }
        Update: {
          approved_at?: string | null
          btg_contract_guid?: string | null
          btg_response?: Json | null
          btg_transfer_id?: string | null
          cancelled_at?: string | null
          cliente_id?: string | null
          created_at?: string
          erro?: string | null
          failed_at?: string | null
          id?: string
          operation_needs_approval?: boolean
          orcamento_id?: string | null
          pagamento_id?: string | null
          paid_at?: string | null
          pix_holder_document?: string | null
          pix_holder_name?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          processing_at?: string | null
          profissional_id?: string
          status?: string
          updated_at?: string
          valor_bruto?: number
          valor_comissao_marketplace?: number
          valor_liquido?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_repasses_orcamento"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      service_materiais: {
        Row: {
          created_at: string
          id: string
          material_id: string
          quantidade_sugerida: number
          service_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          quantidade_sugerida?: number
          service_id: string
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          quantidade_sugerida?: number
          service_id?: string
        }
        Relationships: []
      }
      services_catalog: {
        Row: {
          apoio_feminino_valor: number | null
          ativo: boolean
          categoria: string
          comissao_marketplace_pct: number
          complexidade: string | null
          created_at: string
          custo_base_real: number | null
          custo_profissional: number | null
          descricao: string | null
          domingo_feriado_factor: number | null
          fator_precificacao_maxima: number | null
          id: string
          is_fixed_price: boolean
          markup_margem_empresa: number | null
          mpq_tabela_rev: string | null
          nome: string
          operacao_plataforma_factor: number | null
          preco_fixo: number | null
          preco_max: number | null
          preco_max_prestador: number | null
          preco_min: number | null
          preco_min_prestador: number | null
          risco_garantia_factor: number | null
          slug: string | null
          urgencia_noturno_factor: number | null
        }
        Insert: {
          apoio_feminino_valor?: number | null
          ativo?: boolean
          categoria: string
          comissao_marketplace_pct?: number
          complexidade?: string | null
          created_at?: string
          custo_base_real?: number | null
          custo_profissional?: number | null
          descricao?: string | null
          domingo_feriado_factor?: number | null
          fator_precificacao_maxima?: number | null
          id?: string
          is_fixed_price?: boolean
          markup_margem_empresa?: number | null
          mpq_tabela_rev?: string | null
          nome: string
          operacao_plataforma_factor?: number | null
          preco_fixo?: number | null
          preco_max?: number | null
          preco_max_prestador?: number | null
          preco_min?: number | null
          preco_min_prestador?: number | null
          risco_garantia_factor?: number | null
          slug?: string | null
          urgencia_noturno_factor?: number | null
        }
        Update: {
          apoio_feminino_valor?: number | null
          ativo?: boolean
          categoria?: string
          comissao_marketplace_pct?: number
          complexidade?: string | null
          created_at?: string
          custo_base_real?: number | null
          custo_profissional?: number | null
          descricao?: string | null
          domingo_feriado_factor?: number | null
          fator_precificacao_maxima?: number | null
          id?: string
          is_fixed_price?: boolean
          markup_margem_empresa?: number | null
          mpq_tabela_rev?: string | null
          nome?: string
          operacao_plataforma_factor?: number | null
          preco_fixo?: number | null
          preco_max?: number | null
          preco_max_prestador?: number | null
          preco_min?: number | null
          preco_min_prestador?: number | null
          risco_garantia_factor?: number | null
          slug?: string | null
          urgencia_noturno_factor?: number | null
        }
        Relationships: []
      }
      suporte_tickets: {
        Row: {
          assunto: string
          created_at: string | null
          id: string
          mensagem: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assunto: string
          created_at?: string | null
          id?: string
          mensagem: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assunto?: string
          created_at?: string | null
          id?: string
          mensagem?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suporte_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          admin_level: Database["public"]["Enums"]["admin_level"] | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          admin_level?: Database["public"]["Enums"]["admin_level"] | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          admin_level?: Database["public"]["Enums"]["admin_level"] | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      confirmar_convite: { Args: { p_convite_id: string }; Returns: undefined }
      criar_repasse_profissional_pendente: {
        Args: { p_pagamento_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      limpar_reservas_temporarias_expiradas: { Args: never; Returns: undefined }
      marcar_orcamento_enviado: {
        Args: { _orcamento_id: string }
        Returns: Json
      }
      validar_codigo_indicacao: {
        Args: { _codigo: string }
        Returns: {
          desconto_percent: number
          owner_id: string
          valido: boolean
        }[]
      }
      verificar_convite: { Args: { p_convite_id: string }; Returns: Json }
    }
    Enums: {
      admin_level: "super_admin" | "admin" | "financeiro" | "suporte"
      app_role: "cliente" | "profissional" | "admin"
      orcamento_status:
        | "fixo_auto"
        | "customizado_pendente"
        | "enviado"
        | "aprovado"
        | "recusado"
        | "pago"
        | "cancelado"
        | "concluido"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      admin_level: ["super_admin", "admin", "financeiro", "suporte"],
      app_role: ["cliente", "profissional", "admin"],
      orcamento_status: [
        "fixo_auto",
        "customizado_pendente",
        "enviado",
        "aprovado",
        "recusado",
        "pago",
        "cancelado",
        "concluido",
      ],
    },
  },
} as const

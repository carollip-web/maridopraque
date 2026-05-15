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
          atende_emergencias: boolean | null
          ativo: boolean
          bio: string | null
          chave_pix: string | null
          cidade: string | null
          created_at: string
          duracao_padrao_min: number
          especialidades: string[] | null
          foto_url: string | null
          genero: string | null
          lat: number | null
          lng: number | null
          oferece_apoio_feminino: boolean
          onboarding_completo: boolean
          raio_atendimento_km: number
          slug: string | null
          termo_aceito_em: string | null
          termo_versao: string | null
          updated_at: string
          user_id: string
          veiculo_proprio: boolean | null
        }
        Insert: {
          anos_experiencia?: number | null
          atende_emergencias?: boolean | null
          ativo?: boolean
          bio?: string | null
          chave_pix?: string | null
          cidade?: string | null
          created_at?: string
          duracao_padrao_min?: number
          especialidades?: string[] | null
          foto_url?: string | null
          genero?: string | null
          lat?: number | null
          lng?: number | null
          oferece_apoio_feminino?: boolean
          onboarding_completo?: boolean
          raio_atendimento_km?: number
          slug?: string | null
          termo_aceito_em?: string | null
          termo_versao?: string | null
          updated_at?: string
          user_id: string
          veiculo_proprio?: boolean | null
        }
        Update: {
          anos_experiencia?: number | null
          atende_emergencias?: boolean | null
          ativo?: boolean
          bio?: string | null
          chave_pix?: string | null
          cidade?: string | null
          created_at?: string
          duracao_padrao_min?: number
          especialidades?: string[] | null
          foto_url?: string | null
          genero?: string | null
          lat?: number | null
          lng?: number | null
          oferece_apoio_feminino?: boolean
          onboarding_completo?: boolean
          raio_atendimento_km?: number
          slug?: string | null
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
          ativo: boolean
          categoria: string
          created_at: string
          descricao: string | null
          id: string
          is_fixed_price: boolean
          nome: string
          preco_fixo: number | null
          preco_max: number | null
          preco_min: number | null
        }
        Insert: {
          ativo?: boolean
          categoria: string
          created_at?: string
          descricao?: string | null
          id?: string
          is_fixed_price?: boolean
          nome: string
          preco_fixo?: number | null
          preco_max?: number | null
          preco_min?: number | null
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          descricao?: string | null
          id?: string
          is_fixed_price?: boolean
          nome?: string
          preco_fixo?: number | null
          preco_max?: number | null
          preco_min?: number | null
        }
        Relationships: []
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      validar_codigo_indicacao: {
        Args: { _codigo: string }
        Returns: {
          desconto_percent: number
          owner_id: string
          valido: boolean
        }[]
      }
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

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
      orcamentos: {
        Row: {
          auto_aprovado: boolean
          cliente_id: string
          created_at: string
          data_aprovacao: string | null
          data_pagamento: string | null
          descricao: string | null
          id: string
          observacoes_profissional: string | null
          profissional_id: string | null
          service_id: string | null
          service_name: string
          status: Database["public"]["Enums"]["orcamento_status"]
          taxa_material: number
          updated_at: string
          valor: number | null
          valor_servico: number | null
        }
        Insert: {
          auto_aprovado?: boolean
          cliente_id: string
          created_at?: string
          data_aprovacao?: string | null
          data_pagamento?: string | null
          descricao?: string | null
          id?: string
          observacoes_profissional?: string | null
          profissional_id?: string | null
          service_id?: string | null
          service_name: string
          status?: Database["public"]["Enums"]["orcamento_status"]
          taxa_material?: number
          updated_at?: string
          valor?: number | null
          valor_servico?: number | null
        }
        Update: {
          auto_aprovado?: boolean
          cliente_id?: string
          created_at?: string
          data_aprovacao?: string | null
          data_pagamento?: string | null
          descricao?: string | null
          id?: string
          observacoes_profissional?: string | null
          profissional_id?: string | null
          service_id?: string | null
          service_name?: string
          status?: Database["public"]["Enums"]["orcamento_status"]
          taxa_material?: number
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
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string
          total_servicos_pagos: number
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nome?: string
          total_servicos_pagos?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          total_servicos_pagos?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
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
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
    }
    Enums: {
      app_role: "cliente" | "profissional" | "admin"
      orcamento_status:
        | "fixo_auto"
        | "customizado_pendente"
        | "enviado"
        | "aprovado"
        | "recusado"
        | "pago"
        | "cancelado"
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
      app_role: ["cliente", "profissional", "admin"],
      orcamento_status: [
        "fixo_auto",
        "customizado_pendente",
        "enviado",
        "aprovado",
        "recusado",
        "pago",
        "cancelado",
      ],
    },
  },
} as const

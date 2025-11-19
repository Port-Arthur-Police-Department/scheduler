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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      minimum_staffing: {
        Row: {
          created_at: string | null
          day_of_week: number
          id: string
          minimum_officers: number
          minimum_supervisors: number
          shift_type_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          id?: string
          minimum_officers: number
          minimum_supervisors?: number
          shift_type_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          id?: string
          minimum_officers?: number
          minimum_supervisors?: number
          shift_type_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "minimum_staffing_shift_type_id_fkey"
            columns: ["shift_type_id"]
            isOneToOne: false
            referencedRelation: "shift_types"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          badge_number: string | null
          comp_hours: number | null
          created_at: string | null
          email: string
          full_name: string
          hire_date: string | null
          holiday_hours: number | null
          id: string
          last_sick_accrual_date: string | null
          phone: string | null
          pto_hours_accrued_yearly: number | null
          pto_hours_balance: number | null
          rank: Database["public"]["Enums"]["officer_rank"] | null
          service_credit_override: number | null
          sick_hours: number | null
          updated_at: string | null
          vacation_hours: number | null
        }
        Insert: {
          badge_number?: string | null
          comp_hours?: number | null
          created_at?: string | null
          email: string
          full_name: string
          hire_date?: string | null
          holiday_hours?: number | null
          id: string
          last_sick_accrual_date?: string | null
          phone?: string | null
          pto_hours_accrued_yearly?: number | null
          pto_hours_balance?: number | null
          rank?: Database["public"]["Enums"]["officer_rank"] | null
          service_credit_override?: number | null
          sick_hours?: number | null
          updated_at?: string | null
          vacation_hours?: number | null
        }
        Update: {
          badge_number?: string | null
          comp_hours?: number | null
          created_at?: string | null
          email?: string
          full_name?: string
          hire_date?: string | null
          holiday_hours?: number | null
          id?: string
          last_sick_accrual_date?: string | null
          phone?: string | null
          pto_hours_accrued_yearly?: number | null
          pto_hours_balance?: number | null
          rank?: Database["public"]["Enums"]["officer_rank"] | null
          service_credit_override?: number | null
          sick_hours?: number | null
          updated_at?: string | null
          vacation_hours?: number | null
        }
        Relationships: []
      }
      pto_accrual_rules: {
        Row: {
          created_at: string | null
          hours_to_accrue: number
          id: string
          rule_type: string
          service_credit_max: number | null
          service_credit_min: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          hours_to_accrue?: number
          id?: string
          rule_type: string
          service_credit_max?: number | null
          service_credit_min?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          hours_to_accrue?: number
          id?: string
          rule_type?: string
          service_credit_max?: number | null
          service_credit_min?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      recurring_schedules: {
        Row: {
          created_at: string | null
          day_of_week: number
          end_date: string | null
          id: string
          officer_id: string
          position_id: string | null
          position_name: string | null
          shift_type_id: string
          start_date: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          end_date?: string | null
          id?: string
          officer_id: string
          position_id?: string | null
          position_name?: string | null
          shift_type_id: string
          start_date: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          end_date?: string | null
          id?: string
          officer_id?: string
          position_id?: string | null
          position_name?: string | null
          shift_type_id?: string
          start_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_schedules_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_schedules_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "shift_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_schedules_shift_type_id_fkey"
            columns: ["shift_type_id"]
            isOneToOne: false
            referencedRelation: "shift_types"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_exceptions: {
        Row: {
          created_at: string | null
          custom_end_time: string | null
          custom_start_time: string | null
          date: string
          id: string
          is_off: boolean | null
          officer_id: string
          position_id: string | null
          position_name: string | null
          reason: string | null
          shift_type_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custom_end_time?: string | null
          custom_start_time?: string | null
          date: string
          id?: string
          is_off?: boolean | null
          officer_id: string
          position_id?: string | null
          position_name?: string | null
          reason?: string | null
          shift_type_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custom_end_time?: string | null
          custom_start_time?: string | null
          date?: string
          id?: string
          is_off?: boolean | null
          officer_id?: string
          position_id?: string | null
          position_name?: string | null
          reason?: string | null
          shift_type_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_exceptions_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_exceptions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "shift_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_exceptions_shift_type_id_fkey"
            columns: ["shift_type_id"]
            isOneToOne: false
            referencedRelation: "shift_types"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_positions: {
        Row: {
          allowed_roles: string[]
          created_at: string | null
          id: string
          is_overflow: boolean | null
          position_name: string
          position_order: number
          shift_type_id: string
          updated_at: string | null
        }
        Insert: {
          allowed_roles: string[]
          created_at?: string | null
          id?: string
          is_overflow?: boolean | null
          position_name: string
          position_order: number
          shift_type_id: string
          updated_at?: string | null
        }
        Update: {
          allowed_roles?: string[]
          created_at?: string | null
          id?: string
          is_overflow?: boolean | null
          position_name?: string
          position_order?: number
          shift_type_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_positions_shift_type_id_fkey"
            columns: ["shift_type_id"]
            isOneToOne: false
            referencedRelation: "shift_types"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_types: {
        Row: {
          created_at: string | null
          end_time: string
          id: string
          name: string
          start_time: string
        }
        Insert: {
          created_at?: string | null
          end_time: string
          id?: string
          name: string
          start_time: string
        }
        Update: {
          created_at?: string | null
          end_time?: string
          id?: string
          name?: string
          start_time?: string
        }
        Relationships: []
      }
      time_off_requests: {
        Row: {
          created_at: string | null
          end_date: string
          hours_used: number | null
          id: string
          officer_id: string
          pto_type: string | null
          reason: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_date: string
          hours_used?: number | null
          id?: string
          officer_id: string
          pto_type?: string | null
          reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string
          hours_used?: number | null
          id?: string
          officer_id?: string
          pto_type?: string | null
          reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_off_requests_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vacancy_alerts: {
        Row: {
          created_at: string | null
          current_staffing: number
          date: string
          id: string
          minimum_required: number
          shift_type_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_staffing: number
          date: string
          id?: string
          minimum_required: number
          shift_type_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_staffing?: number
          date?: string
          id?: string
          minimum_required?: number
          shift_type_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vacancy_alerts_shift_type_id_fkey"
            columns: ["shift_type_id"]
            isOneToOne: false
            referencedRelation: "shift_types"
            referencedColumns: ["id"]
          },
        ]
      }
      vacancy_responses: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          officer_id: string
          status: string | null
          vacancy_alert_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          officer_id: string
          status?: string | null
          vacancy_alert_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          officer_id?: string
          status?: string | null
          vacancy_alert_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacancy_responses_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacancy_responses_vacancy_alert_id_fkey"
            columns: ["vacancy_alert_id"]
            isOneToOne: false
            referencedRelation: "vacancy_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      // NEW: website_settings table
      website_settings: {
        Row: {
          id: string
          enable_notifications: boolean | null
          show_pto_balances: boolean | null
          pto_balances_visible: boolean | null
          color_settings: Json | null
          pto_type_visibility: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          enable_notifications?: boolean | null
          show_pto_balances?: boolean | null
          pto_balances_visible?: boolean | null
          color_settings?: Json | null
          pto_type_visibility?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          enable_notifications?: boolean | null
          show_pto_balances?: boolean | null
          pto_balances_visible?: boolean | null
          color_settings?: Json | null
          pto_type_visibility?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accrue_annual_pto: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      accrue_sick_time: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_service_credit: {
        Args: { profile_id: string }
        Returns: number
      }
      has_admin_or_supervisor_role: {
        Args: { _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "supervisor" | "officer"
      officer_rank:
        | "Officer"
        | "Sergeant"
        | "Lieutenant"
        | "Deputy Chief"
        | "Chief"
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
      app_role: ["admin", "supervisor", "officer"],
      officer_rank: [
        "Officer",
        "Sergeant",
        "Lieutenant",
        "Deputy Chief",
        "Chief",
      ],
    },
  },
} as const

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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          absence_type: string | null
          ayah_from: number | null
          ayah_to: number | null
          class_date: string
          class_time: string
          created_at: string
          duration_minutes: number
          homework: string | null
          id: string
          lesson_covered: string | null
          lines_completed: number | null
          reason: string | null
          reason_category: string | null
          reason_text: string | null
          reschedule_date: string | null
          reschedule_time: string | null
          status: string
          student_id: string
          surah_name: string | null
          teacher_id: string
          updated_at: string
          variance_reason: string | null
        }
        Insert: {
          absence_type?: string | null
          ayah_from?: number | null
          ayah_to?: number | null
          class_date?: string
          class_time: string
          created_at?: string
          duration_minutes?: number
          homework?: string | null
          id?: string
          lesson_covered?: string | null
          lines_completed?: number | null
          reason?: string | null
          reason_category?: string | null
          reason_text?: string | null
          reschedule_date?: string | null
          reschedule_time?: string | null
          status: string
          student_id: string
          surah_name?: string | null
          teacher_id: string
          updated_at?: string
          variance_reason?: string | null
        }
        Update: {
          absence_type?: string | null
          ayah_from?: number | null
          ayah_to?: number | null
          class_date?: string
          class_time?: string
          created_at?: string
          duration_minutes?: number
          homework?: string | null
          id?: string
          lesson_covered?: string | null
          lines_completed?: number | null
          reason?: string | null
          reason_category?: string | null
          reason_text?: string | null
          reschedule_date?: string | null
          reschedule_time?: string | null
          status?: string
          student_id?: string
          surah_name?: string | null
          teacher_id?: string
          updated_at?: string
          variance_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_field_results: {
        Row: {
          created_at: string
          exam_id: string
          field_id: string
          id: string
          marks: number
        }
        Insert: {
          created_at?: string
          exam_id: string
          field_id: string
          id?: string
          marks: number
        }
        Update: {
          created_at?: string
          exam_id?: string
          field_id?: string
          id?: string
          marks?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_field_results_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_field_results_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "exam_template_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_template_fields: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          label: string
          max_marks: number
          sort_order: number
          template_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          label: string
          max_marks: number
          sort_order?: number
          template_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          label?: string
          max_marks?: number
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_template_fields_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "exam_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          subject_id: string | null
          tenure: Database["public"]["Enums"]["exam_tenure"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          subject_id?: string | null
          tenure: Database["public"]["Enums"]["exam_tenure"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          subject_id?: string | null
          tenure?: Database["public"]["Enums"]["exam_tenure"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_templates_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          created_at: string
          exam_date: string
          examiner_id: string | null
          examiner_remarks: string | null
          id: string
          max_total_marks: number
          percentage: number
          public_remarks: string | null
          student_id: string
          template_id: string
          total_marks: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          exam_date: string
          examiner_id?: string | null
          examiner_remarks?: string | null
          id?: string
          max_total_marks?: number
          percentage?: number
          public_remarks?: string | null
          student_id: string
          template_id: string
          total_marks?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          exam_date?: string
          examiner_id?: string | null
          examiner_remarks?: string | null
          id?: string
          max_total_marks?: number
          percentage?: number
          public_remarks?: string | null
          student_id?: string
          template_id?: string
          total_marks?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_examiner_id_fkey"
            columns: ["examiner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "exam_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_exceptions: {
        Row: {
          created_at: string
          expires_at: string | null
          granted_by: string | null
          id: string
          is_granted: boolean
          permission: string
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          is_granted?: boolean
          permission: string
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          is_granted?: boolean
          permission?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          daily_target_lines: number
          email: string | null
          full_name: string
          id: string
          mushaf_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_target_lines?: number
          email?: string | null
          full_name: string
          id: string
          mushaf_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_target_lines?: number
          email?: string | null
          full_name?: string
          id?: string
          mushaf_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      resources: {
        Row: {
          created_at: string
          folder: string
          folder_id: string | null
          id: string
          sub_folder: string | null
          tags: string | null
          title: string
          type: string
          updated_at: string
          uploaded_by: string | null
          url: string
        }
        Insert: {
          created_at?: string
          folder: string
          folder_id?: string | null
          id?: string
          sub_folder?: string | null
          tags?: string | null
          title: string
          type: string
          updated_at?: string
          uploaded_by?: string | null
          url: string
        }
        Update: {
          created_at?: string
          folder?: string
          folder_id?: string | null
          id?: string
          sub_folder?: string | null
          tags?: string | null
          title?: string
          type?: string
          updated_at?: string
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      role_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          permissions: string[]
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          permissions?: string[]
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          permissions?: string[]
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      student_fees: {
        Row: {
          amount_paid: number | null
          created_at: string
          id: string
          month: string
          monthly_fee: number
          payment_method: string | null
          receipt_url: string | null
          remark: string | null
          status: string
          student_id: string
          updated_at: string
          year: string
        }
        Insert: {
          amount_paid?: number | null
          created_at?: string
          id?: string
          month: string
          monthly_fee?: number
          payment_method?: string | null
          receipt_url?: string | null
          remark?: string | null
          status?: string
          student_id: string
          updated_at?: string
          year: string
        }
        Update: {
          amount_paid?: number | null
          created_at?: string
          id?: string
          month?: string
          monthly_fee?: number
          payment_method?: string | null
          receipt_url?: string | null
          remark?: string | null
          status?: string
          student_id?: string
          updated_at?: string
          year?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_fees_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_parent_links: {
        Row: {
          created_at: string
          id: string
          parent_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_parent_links_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_parent_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_teacher_assignments: {
        Row: {
          created_at: string
          id: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          student_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_teacher_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_teacher_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
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
      get_parent_children_ids: {
        Args: { _parent_id: string }
        Returns: string[]
      }
      get_teacher_student_ids: {
        Args: { _teacher_id: string }
        Returns: string[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "teacher"
        | "student"
        | "parent"
        | "examiner"
        | "super_admin"
        | "admin_admissions"
        | "admin_fees"
        | "admin_academic"
      exam_tenure: "weekly" | "monthly" | "quarterly"
      permission_type:
        | "users.view"
        | "users.create"
        | "users.edit"
        | "users.delete"
        | "users.assign_roles"
        | "students.view"
        | "students.create"
        | "students.edit"
        | "students.delete"
        | "teachers.view"
        | "teachers.create"
        | "teachers.edit"
        | "teachers.delete"
        | "exams.view"
        | "exams.create"
        | "exams.edit"
        | "exams.delete"
        | "exams.grade"
        | "attendance.view"
        | "attendance.mark"
        | "attendance.edit"
        | "schedules.view"
        | "schedules.create"
        | "schedules.edit"
        | "schedules.delete"
        | "reports.view"
        | "reports.generate"
        | "payments.view"
        | "payments.create"
        | "payments.edit"
        | "settings.view"
        | "settings.edit"
        | "dashboard.admin"
        | "dashboard.teacher"
        | "dashboard.student"
        | "dashboard.parent"
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
      app_role: [
        "admin",
        "teacher",
        "student",
        "parent",
        "examiner",
        "super_admin",
        "admin_admissions",
        "admin_fees",
        "admin_academic",
      ],
      exam_tenure: ["weekly", "monthly", "quarterly"],
      permission_type: [
        "users.view",
        "users.create",
        "users.edit",
        "users.delete",
        "users.assign_roles",
        "students.view",
        "students.create",
        "students.edit",
        "students.delete",
        "teachers.view",
        "teachers.create",
        "teachers.edit",
        "teachers.delete",
        "exams.view",
        "exams.create",
        "exams.edit",
        "exams.delete",
        "exams.grade",
        "attendance.view",
        "attendance.mark",
        "attendance.edit",
        "schedules.view",
        "schedules.create",
        "schedules.edit",
        "schedules.delete",
        "reports.view",
        "reports.generate",
        "payments.view",
        "payments.create",
        "payments.edit",
        "settings.view",
        "settings.edit",
        "dashboard.admin",
        "dashboard.teacher",
        "dashboard.student",
        "dashboard.parent",
      ],
    },
  },
} as const

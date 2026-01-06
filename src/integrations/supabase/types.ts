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
      app_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
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
          input_unit: string | null
          lesson_covered: string | null
          lesson_number: number | null
          lesson_type: string | null
          lines_completed: number | null
          manzil_completed: boolean | null
          manzil_done: boolean | null
          manzil_notes: string | null
          page_number: number | null
          progress_marker: string | null
          raw_input_amount: number | null
          reason: string | null
          reason_category: string | null
          reason_text: string | null
          reschedule_date: string | null
          reschedule_time: string | null
          revision_done: boolean | null
          revision_notes: string | null
          sabaq: string | null
          sabaq_ayah_from: number | null
          sabaq_ayah_to: number | null
          sabaq_pages: string | null
          sabaq_surah_from: string | null
          sabaq_surah_to: string | null
          sabqi_done: boolean | null
          sabqi_notes: string | null
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
          input_unit?: string | null
          lesson_covered?: string | null
          lesson_number?: number | null
          lesson_type?: string | null
          lines_completed?: number | null
          manzil_completed?: boolean | null
          manzil_done?: boolean | null
          manzil_notes?: string | null
          page_number?: number | null
          progress_marker?: string | null
          raw_input_amount?: number | null
          reason?: string | null
          reason_category?: string | null
          reason_text?: string | null
          reschedule_date?: string | null
          reschedule_time?: string | null
          revision_done?: boolean | null
          revision_notes?: string | null
          sabaq?: string | null
          sabaq_ayah_from?: number | null
          sabaq_ayah_to?: number | null
          sabaq_pages?: string | null
          sabaq_surah_from?: string | null
          sabaq_surah_to?: string | null
          sabqi_done?: boolean | null
          sabqi_notes?: string | null
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
          input_unit?: string | null
          lesson_covered?: string | null
          lesson_number?: number | null
          lesson_type?: string | null
          lines_completed?: number | null
          manzil_completed?: boolean | null
          manzil_done?: boolean | null
          manzil_notes?: string | null
          page_number?: number | null
          progress_marker?: string | null
          raw_input_amount?: number | null
          reason?: string | null
          reason_category?: string | null
          reason_text?: string | null
          reschedule_date?: string | null
          reschedule_time?: string | null
          revision_done?: boolean | null
          revision_notes?: string | null
          sabaq?: string | null
          sabaq_ayah_from?: number | null
          sabaq_ayah_to?: number | null
          sabaq_pages?: string | null
          sabaq_surah_from?: string | null
          sabaq_surah_to?: string | null
          sabqi_done?: boolean | null
          sabqi_notes?: string | null
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
      enrollments: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          status: string
          student_id: string
          subject_id: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          student_id: string
          subject_id?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          student_id?: string
          subject_id?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_teacher_id_fkey"
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
          grading_style: Database["public"]["Enums"]["grading_style"]
          id: string
          is_active: boolean
          name: string
          structure_json: Json | null
          subject_id: string | null
          tenure: Database["public"]["Enums"]["exam_tenure"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          grading_style?: Database["public"]["Enums"]["grading_style"]
          id?: string
          is_active?: boolean
          name: string
          structure_json?: Json | null
          subject_id?: string | null
          tenure: Database["public"]["Enums"]["exam_tenure"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          grading_style?: Database["public"]["Enums"]["grading_style"]
          id?: string
          is_active?: boolean
          name?: string
          structure_json?: Json | null
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
          criteria_values_json: Json | null
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
          criteria_values_json?: Json | null
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
          criteria_values_json?: Json | null
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
      export_audit_logs: {
        Row: {
          admin_id: string
          export_format: string
          export_type: string
          exported_at: string
          fields_included: string[]
          id: string
          included_passwords: boolean
          user_count: number
        }
        Insert: {
          admin_id: string
          export_format: string
          export_type: string
          exported_at?: string
          fields_included: string[]
          id?: string
          included_passwords?: boolean
          user_count: number
        }
        Update: {
          admin_id?: string
          export_format?: string
          export_type?: string
          exported_at?: string
          fields_included?: string[]
          id?: string
          included_passwords?: boolean
          user_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "export_audit_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      live_sessions: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          created_at: string
          group_id: string | null
          id: string
          license_id: string | null
          recording_link: string | null
          scheduled_start: string | null
          status: Database["public"]["Enums"]["session_status"]
          stream_url: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          license_id?: string | null
          recording_link?: string | null
          scheduled_start?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          stream_url?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          license_id?: string | null
          recording_link?: string | null
          scheduled_start?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          stream_url?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "zoom_licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_queue: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message: string
          metadata: Json | null
          notification_type: string
          recipient_id: string
          recipient_type: string
          sent_at: string | null
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message: string
          metadata?: Json | null
          notification_type: string
          recipient_id: string
          recipient_type?: string
          sent_at?: string | null
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          notification_type?: string
          recipient_id?: string
          recipient_type?: string
          sent_at?: string | null
          status?: string
          title?: string
        }
        Relationships: []
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
          age: number | null
          city: string | null
          country: string | null
          created_at: string
          daily_target_amount: number
          daily_target_lines: number
          email: string | null
          full_name: string
          gender: string | null
          id: string
          meeting_link: string | null
          mushaf_type: string
          preferred_language: string | null
          preferred_unit: string
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          age?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          daily_target_amount?: number
          daily_target_lines?: number
          email?: string | null
          full_name: string
          gender?: string | null
          id?: string
          meeting_link?: string | null
          mushaf_type?: string
          preferred_language?: string | null
          preferred_unit?: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          age?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          daily_target_amount?: number
          daily_target_lines?: number
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          meeting_link?: string | null
          mushaf_type?: string
          preferred_language?: string | null
          preferred_unit?: string
          updated_at?: string
          whatsapp_number?: string | null
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
      schedules: {
        Row: {
          assignment_id: string
          created_at: string
          day_of_week: string
          duration_minutes: number
          id: string
          is_active: boolean
          student_local_time: string
          teacher_local_time: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          day_of_week: string
          duration_minutes?: number
          id?: string
          is_active?: boolean
          student_local_time: string
          teacher_local_time: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          day_of_week?: string
          duration_minutes?: number
          id?: string
          is_active?: boolean
          student_local_time?: string
          teacher_local_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "student_teacher_assignments"
            referencedColumns: ["id"]
          },
        ]
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
      student_monthly_plans: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assignment_id: string | null
          ayah_from: number | null
          ayah_to: number | null
          calculated_daily_target: number | null
          created_at: string
          daily_target: number
          goals: string | null
          id: string
          lesson_number_from: number | null
          lesson_number_to: number | null
          month: string
          monthly_target: number
          notes: string | null
          page_from: number | null
          page_to: number | null
          primary_marker: Database["public"]["Enums"]["primary_marker"]
          resource_name: string | null
          status: Database["public"]["Enums"]["plan_status"]
          student_id: string
          subject_id: string | null
          surah_from: string | null
          surah_name: string | null
          surah_to: string | null
          teacher_id: string
          teaching_strategy: string | null
          topics_to_cover: string | null
          total_teaching_days: number | null
          updated_at: string
          year: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assignment_id?: string | null
          ayah_from?: number | null
          ayah_to?: number | null
          calculated_daily_target?: number | null
          created_at?: string
          daily_target?: number
          goals?: string | null
          id?: string
          lesson_number_from?: number | null
          lesson_number_to?: number | null
          month: string
          monthly_target?: number
          notes?: string | null
          page_from?: number | null
          page_to?: number | null
          primary_marker?: Database["public"]["Enums"]["primary_marker"]
          resource_name?: string | null
          status?: Database["public"]["Enums"]["plan_status"]
          student_id: string
          subject_id?: string | null
          surah_from?: string | null
          surah_name?: string | null
          surah_to?: string | null
          teacher_id: string
          teaching_strategy?: string | null
          topics_to_cover?: string | null
          total_teaching_days?: number | null
          updated_at?: string
          year: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assignment_id?: string | null
          ayah_from?: number | null
          ayah_to?: number | null
          calculated_daily_target?: number | null
          created_at?: string
          daily_target?: number
          goals?: string | null
          id?: string
          lesson_number_from?: number | null
          lesson_number_to?: number | null
          month?: string
          monthly_target?: number
          notes?: string | null
          page_from?: number | null
          page_to?: number | null
          primary_marker?: Database["public"]["Enums"]["primary_marker"]
          resource_name?: string | null
          status?: Database["public"]["Enums"]["plan_status"]
          student_id?: string
          subject_id?: string | null
          surah_from?: string | null
          surah_name?: string | null
          surah_to?: string | null
          teacher_id?: string
          teaching_strategy?: string | null
          topics_to_cover?: string | null
          total_teaching_days?: number | null
          updated_at?: string
          year?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_monthly_plans_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_monthly_plans_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "student_teacher_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_monthly_plans_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_monthly_plans_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_monthly_plans_teacher_id_fkey"
            columns: ["teacher_id"]
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
          status: Database["public"]["Enums"]["assignment_status"]
          student_id: string
          student_timezone: string | null
          subject_id: string | null
          teacher_id: string
          teacher_timezone: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          student_id: string
          student_timezone?: string | null
          subject_id?: string | null
          teacher_id: string
          teacher_timezone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          student_id?: string
          student_timezone?: string | null
          subject_id?: string | null
          teacher_id?: string
          teacher_timezone?: string | null
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
            foreignKeyName: "student_teacher_assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
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
      timezone_mappings: {
        Row: {
          city: string
          country: string
          created_at: string | null
          id: string
          timezone: string
        }
        Insert: {
          city: string
          country: string
          created_at?: string | null
          id?: string
          timezone: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string | null
          id?: string
          timezone?: string
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
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      zoom_attendance_logs: {
        Row: {
          action: Database["public"]["Enums"]["attendance_action"]
          id: string
          join_time: string | null
          leave_time: string | null
          session_id: string
          timestamp: string
          total_duration_minutes: number | null
          user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["attendance_action"]
          id?: string
          join_time?: string | null
          leave_time?: string | null
          session_id: string
          timestamp?: string
          total_duration_minutes?: number | null
          user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["attendance_action"]
          id?: string
          join_time?: string | null
          leave_time?: string | null
          session_id?: string
          timestamp?: string
          total_duration_minutes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zoom_attendance_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      zoom_licenses: {
        Row: {
          created_at: string
          host_id: string | null
          id: string
          last_used_at: string | null
          meeting_link: string
          status: Database["public"]["Enums"]["zoom_license_status"]
          updated_at: string
          zoom_email: string
        }
        Insert: {
          created_at?: string
          host_id?: string | null
          id?: string
          last_used_at?: string | null
          meeting_link: string
          status?: Database["public"]["Enums"]["zoom_license_status"]
          updated_at?: string
          zoom_email: string
        }
        Update: {
          created_at?: string
          host_id?: string | null
          id?: string
          last_used_at?: string | null
          meeting_link?: string
          status?: Database["public"]["Enums"]["zoom_license_status"]
          updated_at?: string
          zoom_email?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_attendance_metrics: {
        Args: {
          _join_time: string
          _leave_time: string
          _scheduled_duration?: number
          _session_start: string
        }
        Returns: Json
      }
      get_and_reserve_license: {
        Args: { _session_id: string; _teacher_id: string }
        Returns: {
          license_id: string
          meeting_link: string
          zoom_email: string
        }[]
      }
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
      release_license: {
        Args: { _session_id: string; _teacher_id: string }
        Returns: boolean
      }
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
      assignment_status: "active" | "paused" | "completed"
      attendance_action: "join_intent" | "leave"
      exam_tenure: "weekly" | "monthly" | "quarterly" | "yearly"
      grading_style: "numeric" | "rubric"
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
      plan_status: "pending" | "approved"
      primary_marker: "rukus" | "pages" | "lines"
      session_status: "scheduled" | "live" | "frozen" | "completed"
      zoom_license_status: "available" | "busy"
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
      assignment_status: ["active", "paused", "completed"],
      attendance_action: ["join_intent", "leave"],
      exam_tenure: ["weekly", "monthly", "quarterly", "yearly"],
      grading_style: ["numeric", "rubric"],
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
      plan_status: ["pending", "approved"],
      primary_marker: ["rukus", "pages", "lines"],
      session_status: ["scheduled", "live", "frozen", "completed"],
      zoom_license_status: ["available", "busy"],
    },
  },
} as const

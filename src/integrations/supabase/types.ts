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
      academy_reports: {
        Row: {
          academy_id: string | null
          created_at: string
          generated_by: string | null
          id: string
          pdf_url: string | null
          period_end: string
          period_start: string
          report_json: Json
        }
        Insert: {
          academy_id?: string | null
          created_at?: string
          generated_by?: string | null
          id?: string
          pdf_url?: string | null
          period_end: string
          period_start: string
          report_json?: Json
        }
        Update: {
          academy_id?: string | null
          created_at?: string
          generated_by?: string | null
          id?: string
          pdf_url?: string | null
          period_end?: string
          period_start?: string
          report_json?: Json
        }
        Relationships: []
      }
      ai_assists: {
        Row: {
          activity_index: number
          assist_type: string
          created_at: string
          id: string
          prompt: string | null
          response: string | null
          session_plan_id: string
        }
        Insert: {
          activity_index?: number
          assist_type?: string
          created_at?: string
          id?: string
          prompt?: string | null
          response?: string | null
          session_plan_id: string
        }
        Update: {
          activity_index?: number
          assist_type?: string
          created_at?: string
          id?: string
          prompt?: string | null
          response?: string | null
          session_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_assists_session_plan_id_fkey"
            columns: ["session_plan_id"]
            isOneToOne: false
            referencedRelation: "session_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_insights: {
        Row: {
          created_at: string
          id: string
          insight_text: string
          is_dismissed: boolean
          metadata: Json | null
          risk_level: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          insight_text: string
          is_dismissed?: boolean
          metadata?: Json | null
          risk_level?: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          insight_text?: string
          is_dismissed?: boolean
          metadata?: Json | null
          risk_level?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      analytics_snapshots: {
        Row: {
          assessment_avg: number | null
          assignment_completion_rate: number | null
          attendance_rate: number | null
          course_id: string | null
          created_at: string
          flashcard_usage_rate: number | null
          growth_delta: number | null
          id: string
          phase_usage: Json | null
          snapshot_date: string
          speaking_avg: number | null
          student_id: string
          video_completion_rate: number | null
        }
        Insert: {
          assessment_avg?: number | null
          assignment_completion_rate?: number | null
          attendance_rate?: number | null
          course_id?: string | null
          created_at?: string
          flashcard_usage_rate?: number | null
          growth_delta?: number | null
          id?: string
          phase_usage?: Json | null
          snapshot_date?: string
          speaking_avg?: number | null
          student_id: string
          video_completion_rate?: number | null
        }
        Update: {
          assessment_avg?: number | null
          assignment_completion_rate?: number | null
          attendance_rate?: number | null
          course_id?: string | null
          created_at?: string
          flashcard_usage_rate?: number | null
          growth_delta?: number | null
          id?: string
          phase_usage?: Json | null
          snapshot_date?: string
          speaking_avg?: number | null
          student_id?: string
          video_completion_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_snapshots_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
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
      assessment_insights: {
        Row: {
          affected_percent: number | null
          affected_students: number | null
          applied_to_plan: boolean | null
          created_at: string
          description: string
          dismissed: boolean | null
          exam_id: string
          id: string
          suggested_actions: Json | null
          title: string
          type: string
        }
        Insert: {
          affected_percent?: number | null
          affected_students?: number | null
          applied_to_plan?: boolean | null
          created_at?: string
          description: string
          dismissed?: boolean | null
          exam_id: string
          id?: string
          suggested_actions?: Json | null
          title: string
          type?: string
        }
        Update: {
          affected_percent?: number | null
          affected_students?: number | null
          applied_to_plan?: boolean | null
          created_at?: string
          description?: string
          dismissed?: boolean | null
          exam_id?: string
          id?: string
          suggested_actions?: Json | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_insights_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "teaching_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_history: {
        Row: {
          assignment_id: string
          created_at: string
          ended_at: string | null
          id: string
          reason: string | null
          started_at: string
          student_id: string
          subject_id: string | null
          teacher_id: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          reason?: string | null
          started_at?: string
          student_id: string
          subject_id?: string | null
          teacher_id: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          reason?: string | null
          started_at?: string
          student_id?: string
          subject_id?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_history_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "student_teacher_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      at_risk_flags: {
        Row: {
          ai_summary: string | null
          course_id: string | null
          created_at: string
          flagged_at: string
          id: string
          intervention_plan: Json | null
          resolved_at: string | null
          resolved_by: string | null
          risk_reasons: Json | null
          student_id: string
        }
        Insert: {
          ai_summary?: string | null
          course_id?: string | null
          created_at?: string
          flagged_at?: string
          id?: string
          intervention_plan?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          risk_reasons?: Json | null
          student_id: string
        }
        Update: {
          ai_summary?: string | null
          course_id?: string | null
          created_at?: string
          flagged_at?: string
          id?: string
          intervention_plan?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          risk_reasons?: Json | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "at_risk_flags_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          absence_type: string | null
          ayah_from: number | null
          ayah_to: number | null
          branch_id: string | null
          class_date: string
          class_time: string
          course_id: string | null
          created_at: string
          division_id: string | null
          duration_minutes: number
          homework: string | null
          id: string
          input_unit: string | null
          lesson_covered: string | null
          lesson_notes: string | null
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
          student_join_time: string | null
          surah_name: string | null
          teacher_id: string
          teacher_join_time: string | null
          updated_at: string
          variance_reason: string | null
          voice_note_url: string | null
        }
        Insert: {
          absence_type?: string | null
          ayah_from?: number | null
          ayah_to?: number | null
          branch_id?: string | null
          class_date?: string
          class_time: string
          course_id?: string | null
          created_at?: string
          division_id?: string | null
          duration_minutes?: number
          homework?: string | null
          id?: string
          input_unit?: string | null
          lesson_covered?: string | null
          lesson_notes?: string | null
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
          student_join_time?: string | null
          surah_name?: string | null
          teacher_id: string
          teacher_join_time?: string | null
          updated_at?: string
          variance_reason?: string | null
          voice_note_url?: string | null
        }
        Update: {
          absence_type?: string | null
          ayah_from?: number | null
          ayah_to?: number | null
          branch_id?: string | null
          class_date?: string
          class_time?: string
          course_id?: string | null
          created_at?: string
          division_id?: string | null
          duration_minutes?: number
          homework?: string | null
          id?: string
          input_unit?: string | null
          lesson_covered?: string | null
          lesson_notes?: string | null
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
          student_join_time?: string | null
          surah_name?: string | null
          teacher_id?: string
          teacher_join_time?: string | null
          updated_at?: string
          variance_reason?: string | null
          voice_note_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
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
      attendance_comments: {
        Row: {
          attendance_id: string
          comment: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          attendance_id: string
          comment: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          attendance_id?: string
          comment?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_comments_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_plan_history: {
        Row: {
          changed_by: string | null
          created_at: string
          effective_from: string
          id: string
          new_values: Json
          plan_id: string
          previous_values: Json
          reason: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          effective_from: string
          id?: string
          new_values?: Json
          plan_id: string
          previous_values?: Json
          reason?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          effective_from?: string
          id?: string
          new_values?: Json
          plan_id?: string
          previous_values?: Json
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_plan_history_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "student_billing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          org_id: string
          timezone: string | null
          type: Database["public"]["Enums"]["branch_type"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          timezone?: string | null
          type?: Database["public"]["Enums"]["branch_type"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          timezone?: string | null
          type?: Database["public"]["Enums"]["branch_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_advance_transactions: {
        Row: {
          advance_id: string
          amount: number
          created_at: string
          created_by: string | null
          description: string
          expense_id: string | null
          id: string
          transaction_date: string
          transaction_type: string
        }
        Insert: {
          advance_id: string
          amount?: number
          created_at?: string
          created_by?: string | null
          description: string
          expense_id?: string | null
          id?: string
          transaction_date?: string
          transaction_type: string
        }
        Update: {
          advance_id?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string
          expense_id?: string | null
          id?: string
          transaction_date?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_advance_transactions_advance_id_fkey"
            columns: ["advance_id"]
            isOneToOne: false
            referencedRelation: "cash_advances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_advance_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_advance_transactions_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_advances: {
        Row: {
          amount: number
          branch_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          disbursement_method: string
          division_id: string | null
          id: string
          issue_date: string
          issued_to: string
          notes: string | null
          purpose: string
          remaining_balance: number
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          disbursement_method?: string
          division_id?: string | null
          id?: string
          issue_date?: string
          issued_to: string
          notes?: string | null
          purpose: string
          remaining_balance?: number
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          disbursement_method?: string
          division_id?: string | null
          id?: string
          issue_date?: string
          issued_to?: string
          notes?: string | null
          purpose?: string
          remaining_balance?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_advances_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_advances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_advances_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_advances_issued_to_fkey"
            columns: ["issued_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_groups: {
        Row: {
          channel_mode: string
          class_id: string | null
          course_id: string | null
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          is_dm: boolean
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          channel_mode?: string
          class_id?: string | null
          course_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          is_dm?: boolean
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          channel_mode?: string
          class_id?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          is_dm?: boolean
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_groups_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "course_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_groups_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachment_url: string | null
          content: string | null
          created_at: string
          forwarded_from: string | null
          forwarded_source_group: string | null
          group_id: string
          id: string
          is_deleted: boolean
          is_flagged: boolean | null
          is_forwarded: boolean
          linked_task_id: string | null
          reply_to: string | null
          sender_id: string
        }
        Insert: {
          attachment_url?: string | null
          content?: string | null
          created_at?: string
          forwarded_from?: string | null
          forwarded_source_group?: string | null
          group_id: string
          id?: string
          is_deleted?: boolean
          is_flagged?: boolean | null
          is_forwarded?: boolean
          linked_task_id?: string | null
          reply_to?: string | null
          sender_id: string
        }
        Update: {
          attachment_url?: string | null
          content?: string | null
          created_at?: string
          forwarded_from?: string | null
          forwarded_source_group?: string | null
          group_id?: string
          id?: string
          is_deleted?: boolean
          is_flagged?: boolean | null
          is_forwarded?: boolean
          linked_task_id?: string | null
          reply_to?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_linked_task_id_fkey"
            columns: ["linked_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      content_kits: {
        Row: {
          course_id: string | null
          created_at: string
          generated_at: string | null
          id: string
          language: string
          pushed_at: string | null
          pushed_to_class: boolean
          session_plan_id: string
          status: string
          updated_at: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          generated_at?: string | null
          id?: string
          language?: string
          pushed_at?: string | null
          pushed_to_class?: boolean
          session_plan_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          generated_at?: string | null
          id?: string
          language?: string
          pushed_at?: string | null
          pushed_to_class?: boolean
          session_plan_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_kits_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_kits_session_plan_id_fkey"
            columns: ["session_plan_id"]
            isOneToOne: false
            referencedRelation: "session_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      country_dial_codes: {
        Row: {
          country: string
          dial_code: string
        }
        Insert: {
          country: string
          dial_code: string
        }
        Update: {
          country?: string
          dial_code?: string
        }
        Relationships: []
      }
      course_assets: {
        Row: {
          ad_creative: Json
          created_at: string
          id: string
          level: string
          linked_course_id: string | null
          name: string
          runs: Json
          subject: string
          support_messages: Json
          syllabus: string | null
          updated_at: string
        }
        Insert: {
          ad_creative?: Json
          created_at?: string
          id?: string
          level?: string
          linked_course_id?: string | null
          name: string
          runs?: Json
          subject?: string
          support_messages?: Json
          syllabus?: string | null
          updated_at?: string
        }
        Update: {
          ad_creative?: Json
          created_at?: string
          id?: string
          level?: string
          linked_course_id?: string | null
          name?: string
          runs?: Json
          subject?: string
          support_messages?: Json
          syllabus?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_assets_linked_course_id_fkey"
            columns: ["linked_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_assignment_submissions: {
        Row: {
          assignment_id: string
          created_at: string
          feedback: string | null
          file_name: string | null
          file_url: string | null
          graded_at: string | null
          graded_by: string | null
          id: string
          response_text: string | null
          score: number | null
          status: string
          student_id: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          feedback?: string | null
          file_name?: string | null
          file_url?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          response_text?: string | null
          score?: number | null
          status?: string
          student_id: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          feedback?: string | null
          file_name?: string | null
          file_url?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          response_text?: string | null
          score?: number | null
          status?: string
          student_id?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "course_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      course_assignments: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          due_date: string | null
          file_name: string | null
          file_url: string | null
          id: string
          instructions: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          instructions?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          instructions?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_badges: {
        Row: {
          course_id: string
          created_at: string
          criteria: string | null
          icon_key: string
          id: string
          name: string
        }
        Insert: {
          course_id: string
          created_at?: string
          criteria?: string | null
          icon_key?: string
          id?: string
          name: string
        }
        Update: {
          course_id?: string
          created_at?: string
          criteria?: string | null
          icon_key?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_badges_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_certificate_awards: {
        Row: {
          certificate_id: string
          certificate_number: string | null
          course_id: string
          created_at: string
          custom_text: string | null
          grade: string | null
          id: string
          issued_at: string
          issued_by: string | null
          student_id: string
        }
        Insert: {
          certificate_id: string
          certificate_number?: string | null
          course_id: string
          created_at?: string
          custom_text?: string | null
          grade?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          student_id: string
        }
        Update: {
          certificate_id?: string
          certificate_number?: string | null
          course_id?: string
          created_at?: string
          custom_text?: string | null
          grade?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_certificate_awards_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "course_certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_certificate_awards_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_certificate_awards_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_certificates: {
        Row: {
          background_image_url: string | null
          course_id: string
          created_at: string
          created_by: string | null
          fields: Json | null
          id: string
          is_default: boolean | null
          template_html: string | null
          template_name: string
          updated_at: string
        }
        Insert: {
          background_image_url?: string | null
          course_id: string
          created_at?: string
          created_by?: string | null
          fields?: Json | null
          id?: string
          is_default?: boolean | null
          template_html?: string | null
          template_name: string
          updated_at?: string
        }
        Update: {
          background_image_url?: string | null
          course_id?: string
          created_at?: string
          created_by?: string | null
          fields?: Json | null
          id?: string
          is_default?: boolean | null
          template_html?: string | null
          template_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_certificates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_class_staff: {
        Row: {
          class_id: string
          created_at: string
          id: string
          payout_type: string
          staff_role: string
          subject_area: string | null
          subjects: string[]
          user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          payout_type?: string
          staff_role?: string
          subject_area?: string | null
          subjects?: string[]
          user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          payout_type?: string
          staff_role?: string
          subject_area?: string | null
          subjects?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_class_staff_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "course_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_class_staff_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_class_students: {
        Row: {
          class_id: string
          enrolled_at: string
          enrollment_ref: string | null
          id: string
          status: string
          student_id: string
        }
        Insert: {
          class_id: string
          enrolled_at?: string
          enrollment_ref?: string | null
          id?: string
          status?: string
          student_id: string
        }
        Update: {
          class_id?: string
          enrolled_at?: string
          enrollment_ref?: string | null
          id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_class_students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "course_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_class_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_classes: {
        Row: {
          class_type: string
          course_id: string
          created_at: string
          fee_amount: number
          fee_currency: string
          id: string
          is_volunteer: boolean
          max_seats: number
          meeting_link: string | null
          name: string
          schedule_days: string[]
          schedule_time: string | null
          session_duration: number
          status: string
          timezone: string | null
          updated_at: string
          zoom_license_id: string | null
        }
        Insert: {
          class_type?: string
          course_id: string
          created_at?: string
          fee_amount?: number
          fee_currency?: string
          id?: string
          is_volunteer?: boolean
          max_seats?: number
          meeting_link?: string | null
          name: string
          schedule_days?: string[]
          schedule_time?: string | null
          session_duration?: number
          status?: string
          timezone?: string | null
          updated_at?: string
          zoom_license_id?: string | null
        }
        Update: {
          class_type?: string
          course_id?: string
          created_at?: string
          fee_amount?: number
          fee_currency?: string
          id?: string
          is_volunteer?: boolean
          max_seats?: number
          meeting_link?: string | null
          name?: string
          schedule_days?: string[]
          schedule_time?: string | null
          session_duration?: number
          status?: string
          timezone?: string | null
          updated_at?: string
          zoom_license_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_classes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_classes_zoom_license_id_fkey"
            columns: ["zoom_license_id"]
            isOneToOne: false
            referencedRelation: "zoom_licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_eligibility_rules: {
        Row: {
          course_id: string
          created_at: string
          id: string
          is_active: boolean
          rule_type: Database["public"]["Enums"]["eligibility_rule_type"]
          rule_value: Json
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          rule_type: Database["public"]["Enums"]["eligibility_rule_type"]
          rule_value?: Json
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          rule_type?: Database["public"]["Enums"]["eligibility_rule_type"]
          rule_value?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_eligibility_rules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_enrollments: {
        Row: {
          course_id: string
          created_at: string
          enrolled_at: string
          id: string
          status: string
          student_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          enrolled_at?: string
          id?: string
          status?: string
          student_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          enrolled_at?: string
          id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_fee_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          payment_date: string
          payment_link: string | null
          payment_method: string | null
          recorded_by: string | null
          reference: string | null
          student_fee_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_link?: string | null
          payment_method?: string | null
          recorded_by?: string | null
          reference?: string | null
          student_fee_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_link?: string | null
          payment_method?: string | null
          recorded_by?: string | null
          reference?: string | null
          student_fee_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_fee_payments_student_fee_id_fkey"
            columns: ["student_fee_id"]
            isOneToOne: false
            referencedRelation: "course_student_fees"
            referencedColumns: ["id"]
          },
        ]
      }
      course_fee_plans: {
        Row: {
          course_id: string
          created_at: string
          currency: string
          id: string
          installment_schedule: Json
          installments: number
          notes: string | null
          plan_name: string
          status: string
          tax_percent: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          currency?: string
          id?: string
          installment_schedule?: Json
          installments?: number
          notes?: string | null
          plan_name: string
          status?: string
          tax_percent?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          currency?: string
          id?: string
          installment_schedule?: Json
          installments?: number
          notes?: string | null
          plan_name?: string
          status?: string
          tax_percent?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_fee_plans_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_lesson_plans: {
        Row: {
          course_id: string
          created_at: string
          id: string
          lesson_date: string | null
          material_title: string | null
          material_url: string | null
          notes: string | null
          objectives: string | null
          status: string
          topic: string
          updated_at: string
          week_number: number
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          lesson_date?: string | null
          material_title?: string | null
          material_url?: string | null
          notes?: string | null
          objectives?: string | null
          status?: string
          topic?: string
          updated_at?: string
          week_number?: number
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          lesson_date?: string | null
          material_title?: string | null
          material_url?: string | null
          notes?: string | null
          objectives?: string | null
          status?: string
          topic?: string
          updated_at?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_lesson_plans_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_lessons: {
        Row: {
          content_html: string | null
          content_type: string
          course_id: string
          created_at: string
          file_url: string | null
          id: string
          module_id: string
          sort_order: number
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          content_html?: string | null
          content_type?: string
          course_id: string
          created_at?: string
          file_url?: string | null
          id?: string
          module_id: string
          sort_order?: number
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          content_html?: string | null
          content_type?: string
          course_id?: string
          created_at?: string
          file_url?: string | null
          id?: string
          module_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      course_library_assets: {
        Row: {
          asset_type: string
          branch_id: string | null
          content_html: string | null
          content_url: string | null
          course_id: string | null
          created_at: string | null
          division_id: string | null
          id: string
          metadata: Json | null
          owner_id: string | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          version: number | null
          visibility: string | null
        }
        Insert: {
          asset_type?: string
          branch_id?: string | null
          content_html?: string | null
          content_url?: string | null
          course_id?: string | null
          created_at?: string | null
          division_id?: string | null
          id?: string
          metadata?: Json | null
          owner_id?: string | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          version?: number | null
          visibility?: string | null
        }
        Update: {
          asset_type?: string
          branch_id?: string | null
          content_html?: string | null
          content_url?: string | null
          course_id?: string | null
          created_at?: string | null
          division_id?: string | null
          id?: string
          metadata?: Json | null
          owner_id?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          version?: number | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_library_assets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_library_assets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_library_assets_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_library_assets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_message_sequences: {
        Row: {
          attachment_url: string | null
          body: string
          channels: string[]
          course_id: string
          created_at: string
          delay_days: number
          delay_rule: string
          id: string
          is_enabled: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          attachment_url?: string | null
          body?: string
          channels?: string[]
          course_id: string
          created_at?: string
          delay_days?: number
          delay_rule?: string
          id?: string
          is_enabled?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          attachment_url?: string | null
          body?: string
          channels?: string[]
          course_id?: string
          created_at?: string
          delay_days?: number
          delay_rule?: string
          id?: string
          is_enabled?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_message_sequences_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          course_id: string
          created_at: string
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_notifications: {
        Row: {
          attachment_url: string | null
          body: string
          channels: string[]
          course_id: string
          created_at: string
          id: string
          recipient_count: number
          sent_by: string | null
          title: string
        }
        Insert: {
          attachment_url?: string | null
          body?: string
          channels?: string[]
          course_id: string
          created_at?: string
          id?: string
          recipient_count?: number
          sent_by?: string | null
          title: string
        }
        Update: {
          attachment_url?: string | null
          body?: string
          channels?: string[]
          course_id?: string
          created_at?: string
          id?: string
          recipient_count?: number
          sent_by?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_notifications_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_outlines: {
        Row: {
          approved: boolean | null
          chapter_number: number | null
          chapter_title: string | null
          course_id: string | null
          created_at: string
          day_name: string | null
          day_number: number
          duration_minutes: number | null
          id: string
          notes: string | null
          page_end: number | null
          page_start: number | null
          session_date: string | null
          source_filename: string | null
          topic: string | null
        }
        Insert: {
          approved?: boolean | null
          chapter_number?: number | null
          chapter_title?: string | null
          course_id?: string | null
          created_at?: string
          day_name?: string | null
          day_number: number
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          page_end?: number | null
          page_start?: number | null
          session_date?: string | null
          source_filename?: string | null
          topic?: string | null
        }
        Update: {
          approved?: boolean | null
          chapter_number?: number | null
          chapter_title?: string | null
          course_id?: string | null
          created_at?: string
          day_name?: string | null
          day_number?: number
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          page_end?: number | null
          page_start?: number | null
          session_date?: string | null
          source_filename?: string | null
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_outlines_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_post_replies: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          flag_reason: string | null
          id: string
          is_approved: boolean | null
          is_flagged: boolean | null
          post_id: string
          updated_at: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          flag_reason?: string | null
          id?: string
          is_approved?: boolean | null
          is_flagged?: boolean | null
          post_id: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          flag_reason?: string | null
          id?: string
          is_approved?: boolean | null
          is_flagged?: boolean | null
          post_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_post_replies_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_post_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "course_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      course_posts: {
        Row: {
          author_id: string
          content: string | null
          course_id: string
          created_at: string | null
          flag_reason: string | null
          id: string
          is_approved: boolean | null
          is_flagged: boolean | null
          is_pinned: boolean | null
          metadata: Json | null
          post_type: string
          title: string
          updated_at: string | null
        }
        Insert: {
          author_id: string
          content?: string | null
          course_id: string
          created_at?: string | null
          flag_reason?: string | null
          id?: string
          is_approved?: boolean | null
          is_flagged?: boolean | null
          is_pinned?: boolean | null
          metadata?: Json | null
          post_type?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          content?: string | null
          course_id?: string
          created_at?: string | null
          flag_reason?: string | null
          id?: string
          is_approved?: boolean | null
          is_flagged?: boolean | null
          is_pinned?: boolean | null
          metadata?: Json | null
          post_type?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_posts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_quiz_attempts: {
        Row: {
          answers: Json | null
          completed_at: string | null
          created_at: string
          id: string
          max_score: number | null
          percentage: number | null
          quiz_id: string
          score: number | null
          started_at: string
          status: string
          student_id: string
        }
        Insert: {
          answers?: Json | null
          completed_at?: string | null
          created_at?: string
          id?: string
          max_score?: number | null
          percentage?: number | null
          quiz_id: string
          score?: number | null
          started_at?: string
          status?: string
          student_id: string
        }
        Update: {
          answers?: Json | null
          completed_at?: string | null
          created_at?: string
          id?: string
          max_score?: number | null
          percentage?: number | null
          quiz_id?: string
          score?: number | null
          started_at?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "course_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      course_quiz_questions: {
        Row: {
          correct_answer: string | null
          created_at: string
          id: string
          options: Json | null
          points: number
          question_text: string
          question_type: string
          quiz_id: string
          sort_order: number
        }
        Insert: {
          correct_answer?: string | null
          created_at?: string
          id?: string
          options?: Json | null
          points?: number
          question_text: string
          question_type?: string
          quiz_id: string
          sort_order?: number
        }
        Update: {
          correct_answer?: string | null
          created_at?: string
          id?: string
          options?: Json | null
          points?: number
          question_text?: string
          question_type?: string
          quiz_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "course_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      course_quizzes: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          passing_percentage: number | null
          status: string
          time_limit_minutes: number | null
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          passing_percentage?: number | null
          status?: string
          time_limit_minutes?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          passing_percentage?: number | null
          status?: string
          time_limit_minutes?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_quizzes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_quizzes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_student_badges: {
        Row: {
          awarded_at: string
          awarded_by: string | null
          badge_id: string
          id: string
          student_id: string
        }
        Insert: {
          awarded_at?: string
          awarded_by?: string | null
          badge_id: string
          id?: string
          student_id: string
        }
        Update: {
          awarded_at?: string
          awarded_by?: string | null
          badge_id?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_student_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "course_badges"
            referencedColumns: ["id"]
          },
        ]
      }
      course_student_fees: {
        Row: {
          course_id: string
          created_at: string
          custom_installment_schedule: Json | null
          discount_type: string
          discount_value: number
          id: string
          is_scholarship: boolean
          notes: string | null
          plan_id: string | null
          status: string
          student_id: string
          total_due: number
          total_paid: number
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          custom_installment_schedule?: Json | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_scholarship?: boolean
          notes?: string | null
          plan_id?: string | null
          status?: string
          student_id: string
          total_due?: number
          total_paid?: number
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          custom_installment_schedule?: Json | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_scholarship?: boolean
          notes?: string | null
          plan_id?: string | null
          status?: string
          student_id?: string
          total_due?: number
          total_paid?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_student_fees_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_student_fees_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "course_fee_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      course_teacher_guide_versions: {
        Row: {
          content_html: string
          created_at: string
          edited_by: string | null
          guide_id: string
          id: string
          version: number
        }
        Insert: {
          content_html: string
          created_at?: string
          edited_by?: string | null
          guide_id: string
          id?: string
          version: number
        }
        Update: {
          content_html?: string
          created_at?: string
          edited_by?: string | null
          guide_id?: string
          id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_teacher_guide_versions_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "course_teacher_guides"
            referencedColumns: ["id"]
          },
        ]
      }
      course_teacher_guides: {
        Row: {
          content_html: string
          course_id: string
          created_at: string
          id: string
          last_edited_by: string | null
          updated_at: string
          version: number
        }
        Insert: {
          content_html?: string
          course_id: string
          created_at?: string
          id?: string
          last_edited_by?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          content_html?: string
          course_id?: string
          created_at?: string
          id?: string
          last_edited_by?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_teacher_guides_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: true
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          ad_creative: Json | null
          auto_enroll_enabled: boolean
          branch_id: string | null
          community_chat_enabled: boolean
          contact_info: Json | null
          created_at: string
          description: string | null
          division_id: string | null
          end_date: string | null
          enrollment_type: string | null
          faqs: Json | null
          hero_image_url: string | null
          id: string
          is_group_class: boolean
          level: string | null
          max_students: number
          name: string
          outcomes: Json | null
          pricing: Json | null
          seo_slug: string | null
          start_date: string
          status: string
          student_dm_mode: string
          subject_id: string | null
          support_messages: Json | null
          syllabus_text: string | null
          tags: string[] | null
          teacher_id: string
          updated_at: string
          webhook_secret: string | null
          website_enabled: boolean | null
          whatsapp_channel_link: string | null
        }
        Insert: {
          ad_creative?: Json | null
          auto_enroll_enabled?: boolean
          branch_id?: string | null
          community_chat_enabled?: boolean
          contact_info?: Json | null
          created_at?: string
          description?: string | null
          division_id?: string | null
          end_date?: string | null
          enrollment_type?: string | null
          faqs?: Json | null
          hero_image_url?: string | null
          id?: string
          is_group_class?: boolean
          level?: string | null
          max_students?: number
          name: string
          outcomes?: Json | null
          pricing?: Json | null
          seo_slug?: string | null
          start_date: string
          status?: string
          student_dm_mode?: string
          subject_id?: string | null
          support_messages?: Json | null
          syllabus_text?: string | null
          tags?: string[] | null
          teacher_id: string
          updated_at?: string
          webhook_secret?: string | null
          website_enabled?: boolean | null
          whatsapp_channel_link?: string | null
        }
        Update: {
          ad_creative?: Json | null
          auto_enroll_enabled?: boolean
          branch_id?: string | null
          community_chat_enabled?: boolean
          contact_info?: Json | null
          created_at?: string
          description?: string | null
          division_id?: string | null
          end_date?: string | null
          enrollment_type?: string | null
          faqs?: Json | null
          hero_image_url?: string | null
          id?: string
          is_group_class?: boolean
          level?: string | null
          max_students?: number
          name?: string
          outcomes?: Json | null
          pricing?: Json | null
          seo_slug?: string | null
          start_date?: string
          status?: string
          student_dm_mode?: string
          subject_id?: string | null
          support_messages?: Json | null
          syllabus_text?: string | null
          tags?: string[] | null
          teacher_id?: string
          updated_at?: string
          webhook_secret?: string | null
          website_enabled?: boolean | null
          whatsapp_channel_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_sessions: {
        Row: {
          created_at: string
          duration_min: number
          feedback_comment: string | null
          feedback_rating: number | null
          feedback_response: string | null
          feedback_token: string | null
          id: string
          lead_id: string
          meeting_link: string | null
          org_id: string | null
          platform: string | null
          scheduled_date: string
          scheduled_time: string
          status: string
          teacher_id: string | null
          teacher_note: string | null
          teacher_notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_min?: number
          feedback_comment?: string | null
          feedback_rating?: number | null
          feedback_response?: string | null
          feedback_token?: string | null
          id?: string
          lead_id: string
          meeting_link?: string | null
          org_id?: string | null
          platform?: string | null
          scheduled_date: string
          scheduled_time: string
          status?: string
          teacher_id?: string | null
          teacher_note?: string | null
          teacher_notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_min?: number
          feedback_comment?: string | null
          feedback_rating?: number | null
          feedback_response?: string | null
          feedback_token?: string | null
          id?: string
          lead_id?: string
          meeting_link?: string | null
          org_id?: string | null
          platform?: string | null
          scheduled_date?: string
          scheduled_time?: string
          status?: string
          teacher_id?: string | null
          teacher_note?: string | null
          teacher_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_sessions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_sessions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_rules: {
        Row: {
          branch_id: string | null
          created_at: string
          division_id: string | null
          id: string
          is_active: boolean
          name: string
          type: Database["public"]["Enums"]["discount_type"]
          updated_at: string
          value: number
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          division_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          type?: Database["public"]["Enums"]["discount_type"]
          updated_at?: string
          value?: number
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          division_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          type?: Database["public"]["Enums"]["discount_type"]
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "discount_rules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_rules_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      divisions: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          is_active: boolean
          model_type: Database["public"]["Enums"]["division_model"]
          name: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          model_type: Database["public"]["Enums"]["division_model"]
          name: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          model_type?: Database["public"]["Enums"]["division_model"]
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "divisions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_requests: {
        Row: {
          course_id: string
          created_at: string
          id: string
          recipient_id: string
          requester_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          recipient_id: string
          requester_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          recipient_id?: string
          requester_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_requests_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      drill_phrases: {
        Row: {
          audio_url: string | null
          created_at: string
          difficulty: number | null
          drill_id: string
          english: string | null
          id: string
          phrase_arabic: string
          position: number | null
          romanised: string | null
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          difficulty?: number | null
          drill_id: string
          english?: string | null
          id?: string
          phrase_arabic: string
          position?: number | null
          romanised?: string | null
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          difficulty?: number | null
          drill_id?: string
          english?: string | null
          id?: string
          phrase_arabic?: string
          position?: number | null
          romanised?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drill_phrases_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "speaking_drills"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_ref_sequences: {
        Row: {
          next_val: number
          profile_id: string
        }
        Insert: {
          next_val?: number
          profile_id: string
        }
        Update: {
          next_val?: number
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_ref_sequences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
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
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
      expenses: {
        Row: {
          advance_id: string | null
          amount: number
          approved_by: string | null
          branch_id: string | null
          category: string
          created_at: string
          created_by: string | null
          currency: string
          description: string
          division_id: string | null
          expense_date: string
          id: string
          invoice_number: string | null
          notes: string | null
          payment_method: string | null
          receipt_url: string | null
          status: string
          student_id: string | null
          teacher_id: string | null
          updated_at: string
        }
        Insert: {
          advance_id?: string | null
          amount?: number
          approved_by?: string | null
          branch_id?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description: string
          division_id?: string | null
          expense_date?: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          status?: string
          student_id?: string | null
          teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          advance_id?: string | null
          amount?: number
          approved_by?: string | null
          branch_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          division_id?: string | null
          expense_date?: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          status?: string
          student_id?: string | null
          teacher_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_advance_id_fkey"
            columns: ["advance_id"]
            isOneToOne: false
            referencedRelation: "cash_advances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      extra_classes: {
        Row: {
          approved_by: string | null
          assignment_id: string | null
          class_date: string
          created_at: string
          duration_minutes: number
          id: string
          rate: number
          reason: string | null
          status: string
          student_id: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          assignment_id?: string | null
          class_date: string
          created_at?: string
          duration_minutes?: number
          id?: string
          rate?: number
          reason?: string | null
          status?: string
          student_id?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          assignment_id?: string | null
          class_date?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          rate?: number
          reason?: string | null
          status?: string
          student_id?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "extra_classes_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extra_classes_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "student_teacher_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extra_classes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extra_classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_invoices: {
        Row: {
          amount: number
          amount_paid: number
          assignment_id: string | null
          billing_month: string
          branch_id: string | null
          created_at: string
          currency: string
          division_id: string | null
          due_date: string | null
          forgiven_amount: number
          id: string
          paid_at: string | null
          payment_method: string | null
          period_from: string | null
          period_to: string | null
          plan_id: string | null
          remark: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          amount_paid?: number
          assignment_id?: string | null
          billing_month: string
          branch_id?: string | null
          created_at?: string
          currency?: string
          division_id?: string | null
          due_date?: string | null
          forgiven_amount?: number
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          period_from?: string | null
          period_to?: string | null
          plan_id?: string | null
          remark?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_paid?: number
          assignment_id?: string | null
          billing_month?: string
          branch_id?: string | null
          created_at?: string
          currency?: string
          division_id?: string | null
          due_date?: string | null
          forgiven_amount?: number
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          period_from?: string | null
          period_to?: string | null
          plan_id?: string | null
          remark?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_invoices_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "student_teacher_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_invoices_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_invoices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "student_billing_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_packages: {
        Row: {
          amount: number
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          branch_id: string | null
          created_at: string
          currency: string
          days_per_week: number
          division_id: string | null
          id: string
          is_active: boolean
          name: string
          subject_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          branch_id?: string | null
          created_at?: string
          currency?: string
          days_per_week?: number
          division_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          subject_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          branch_id?: string | null
          created_at?: string
          currency?: string
          days_per_week?: number
          division_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          subject_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_packages_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_packages_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_packages_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_progress: {
        Row: {
          attempts: number | null
          flashcard_id: string
          id: string
          last_seen: string | null
          status: string
          student_id: string
        }
        Insert: {
          attempts?: number | null
          flashcard_id: string
          id?: string
          last_seen?: string | null
          status?: string
          student_id: string
        }
        Update: {
          attempts?: number | null
          flashcard_id?: string
          id?: string
          last_seen?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_progress_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          arabic: string
          card_index: number
          created_at: string
          english: string
          example_sentence: string | null
          example_translation: string | null
          id: string
          kit_id: string
          part_of_speech: string | null
          transliteration: string | null
        }
        Insert: {
          arabic: string
          card_index?: number
          created_at?: string
          english: string
          example_sentence?: string | null
          example_translation?: string | null
          id?: string
          kit_id: string
          part_of_speech?: string | null
          transliteration?: string | null
        }
        Update: {
          arabic?: string
          card_index?: number
          created_at?: string
          english?: string
          example_sentence?: string | null
          example_translation?: string | null
          id?: string
          kit_id?: string
          part_of_speech?: string | null
          transliteration?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "content_kits"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string
          visibility: string
          visible_to_roles: string[] | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
          visibility?: string
          visible_to_roles?: string[] | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
          visibility?: string
          visible_to_roles?: string[] | null
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
      holidays: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string
          division_id: string | null
          holiday_date: string
          id: string
          is_recurring: boolean
          name: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by: string
          division_id?: string | null
          holiday_date: string
          id?: string
          is_recurring?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string
          division_id?: string | null
          holiday_date?: string
          id?: string
          is_recurring?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "holidays_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holidays_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_adjustments: {
        Row: {
          action_type: string
          admin_email: string | null
          admin_id: string | null
          admin_name: string
          created_at: string
          id: string
          invoice_id: string
          new_values: Json
          previous_values: Json
          reason: string | null
        }
        Insert: {
          action_type: string
          admin_email?: string | null
          admin_id?: string | null
          admin_name: string
          created_at?: string
          id?: string
          invoice_id: string
          new_values?: Json
          previous_values?: Json
          reason?: string | null
        }
        Update: {
          action_type?: string
          admin_email?: string | null
          admin_id?: string | null
          admin_name?: string
          created_at?: string
          id?: string
          invoice_id?: string
          new_values?: Json
          previous_values?: Json
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_adjustments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "fee_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      kit_shares: {
        Row: {
          content_types: Json | null
          created_at: string
          delivery_channels: Json | null
          id: string
          kit_id: string
          message: string | null
          scheduled_for: string | null
          sent_at: string | null
          shared_by: string
          shared_with: Json | null
        }
        Insert: {
          content_types?: Json | null
          created_at?: string
          delivery_channels?: Json | null
          id?: string
          kit_id: string
          message?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          shared_by: string
          shared_with?: Json | null
        }
        Update: {
          content_types?: Json | null
          created_at?: string
          delivery_channels?: Json | null
          id?: string
          kit_id?: string
          message?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          shared_by?: string
          shared_with?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "kit_shares_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "content_kits"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          lead_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string
          file_url: string
          id?: string
          lead_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          lead_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_attachments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_screenings: {
        Row: {
          channel: string
          confidence_rating: number | null
          created_at: string
          duration_minutes: number | null
          estimated_level: string | null
          id: string
          is_skipped: boolean
          lead_id: string
          material_tested: string | null
          observations: string | null
          proceed_decision: string | null
          quick_tags: string[] | null
          screened_at: string
          screened_by: string | null
          suggested_teacher_id: string | null
          updated_at: string
        }
        Insert: {
          channel?: string
          confidence_rating?: number | null
          created_at?: string
          duration_minutes?: number | null
          estimated_level?: string | null
          id?: string
          is_skipped?: boolean
          lead_id: string
          material_tested?: string | null
          observations?: string | null
          proceed_decision?: string | null
          quick_tags?: string[] | null
          screened_at?: string
          screened_by?: string | null
          suggested_teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          channel?: string
          confidence_rating?: number | null
          created_at?: string
          duration_minutes?: number | null
          estimated_level?: string | null
          id?: string
          is_skipped?: boolean
          lead_id?: string
          material_tested?: string | null
          observations?: string | null
          proceed_decision?: string | null
          quick_tags?: string[] | null
          screened_at?: string
          screened_by?: string | null
          suggested_teacher_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_screenings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_screenings_screened_by_fkey"
            columns: ["screened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_screenings_suggested_teacher_id_fkey"
            columns: ["suggested_teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          branch_id: string | null
          child_age: number | null
          child_gender: string | null
          child_name: string | null
          city: string | null
          converted_person_ids: string[] | null
          country: string | null
          created_at: string
          current_level_specimen: string | null
          date_of_birth: string | null
          division_id: string | null
          email: string | null
          enrollment_form_data: Json | null
          enrollment_form_opened_at: string | null
          enrollment_form_sent_at: string | null
          enrollment_form_token: string | null
          for_whom: string
          gender: string | null
          guardian_name: string | null
          guardian_relationship: string | null
          id: string
          learning_goals: string | null
          lost_reason: string | null
          match_status: string | null
          matched_person_id: string | null
          message: string | null
          name: string
          notes: Json | null
          org_id: string | null
          phone_whatsapp: string | null
          preferred_time: string | null
          source_url: string | null
          status: string
          subject_interest: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          branch_id?: string | null
          child_age?: number | null
          child_gender?: string | null
          child_name?: string | null
          city?: string | null
          converted_person_ids?: string[] | null
          country?: string | null
          created_at?: string
          current_level_specimen?: string | null
          date_of_birth?: string | null
          division_id?: string | null
          email?: string | null
          enrollment_form_data?: Json | null
          enrollment_form_opened_at?: string | null
          enrollment_form_sent_at?: string | null
          enrollment_form_token?: string | null
          for_whom?: string
          gender?: string | null
          guardian_name?: string | null
          guardian_relationship?: string | null
          id?: string
          learning_goals?: string | null
          lost_reason?: string | null
          match_status?: string | null
          matched_person_id?: string | null
          message?: string | null
          name: string
          notes?: Json | null
          org_id?: string | null
          phone_whatsapp?: string | null
          preferred_time?: string | null
          source_url?: string | null
          status?: string
          subject_interest?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          branch_id?: string | null
          child_age?: number | null
          child_gender?: string | null
          child_name?: string | null
          city?: string | null
          converted_person_ids?: string[] | null
          country?: string | null
          created_at?: string
          current_level_specimen?: string | null
          date_of_birth?: string | null
          division_id?: string | null
          email?: string | null
          enrollment_form_data?: Json | null
          enrollment_form_opened_at?: string | null
          enrollment_form_sent_at?: string | null
          enrollment_form_token?: string | null
          for_whom?: string
          gender?: string | null
          guardian_name?: string | null
          guardian_relationship?: string | null
          id?: string
          learning_goals?: string | null
          lost_reason?: string | null
          match_status?: string | null
          matched_person_id?: string | null
          message?: string | null
          name?: string
          notes?: Json | null
          org_id?: string | null
          phone_whatsapp?: string | null
          preferred_time?: string | null
          source_url?: string | null
          status?: string
          subject_interest?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_matched_person_id_fkey"
            columns: ["matched_person_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_events: {
        Row: {
          approved_by: string | null
          created_at: string
          end_date: string
          id: string
          leave_type: string
          reason: string | null
          replacement_teacher_id: string | null
          start_date: string
          status: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          end_date: string
          id?: string
          leave_type?: string
          reason?: string | null
          replacement_teacher_id?: string | null
          start_date: string
          status?: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          replacement_teacher_id?: string | null
          start_date?: string
          status?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_events_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_events_replacement_teacher_id_fkey"
            columns: ["replacement_teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_events_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_sessions: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          assignment_id: string | null
          created_at: string
          group_id: string | null
          id: string
          license_id: string | null
          recording_fetched_at: string | null
          recording_link: string | null
          recording_password: string | null
          recording_status: string | null
          schedule_id: string | null
          scheduled_start: string | null
          status: Database["public"]["Enums"]["session_status"]
          stream_url: string | null
          student_id: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          assignment_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          license_id?: string | null
          recording_fetched_at?: string | null
          recording_link?: string | null
          recording_password?: string | null
          recording_status?: string | null
          schedule_id?: string | null
          scheduled_start?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          stream_url?: string | null
          student_id?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          assignment_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          license_id?: string | null
          recording_fetched_at?: string | null
          recording_link?: string | null
          recording_password?: string | null
          recording_status?: string | null
          schedule_id?: string | null
          scheduled_start?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          stream_url?: string | null
          student_id?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "student_teacher_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "zoom_licenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      minor_credentials: {
        Row: {
          created_at: string
          created_by: string | null
          failed_attempts: number
          id: string
          locked_until: string | null
          pin_hash: string
          profile_id: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          failed_attempts?: number
          id?: string
          locked_until?: string | null
          pin_hash: string
          profile_id: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          failed_attempts?: number
          id?: string
          locked_until?: string | null
          pin_hash?: string
          profile_id?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "minor_credentials_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minor_credentials_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: {
          channel: string
          created_at: string
          error_message: string | null
          id: string
          payload: Json | null
          recipient_email: string | null
          recipient_id: string | null
          recipient_phone: string | null
          rendered_text: string | null
          sent_at: string | null
          status: string
          template_id: string | null
          triggered_by: string | null
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json | null
          recipient_email?: string | null
          recipient_id?: string | null
          recipient_phone?: string | null
          rendered_text?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
          triggered_by?: string | null
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json | null
          recipient_email?: string | null
          recipient_id?: string | null
          recipient_phone?: string | null
          rendered_text?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
          triggered_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "notification_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      notification_templates: {
        Row: {
          branch_id: string | null
          channel: string
          created_at: string
          division_id: string | null
          event_trigger: string
          id: string
          is_active: boolean
          name: string
          template_text: string
          updated_at: string
          variables: string[] | null
        }
        Insert: {
          branch_id?: string | null
          channel?: string
          created_at?: string
          division_id?: string | null
          event_trigger: string
          id?: string
          is_active?: boolean
          name: string
          template_text: string
          updated_at?: string
          variables?: string[] | null
        }
        Update: {
          branch_id?: string | null
          channel?: string
          created_at?: string
          division_id?: string | null
          event_trigger?: string
          id?: string
          is_active?: boolean
          name?: string
          template_text?: string
          updated_at?: string
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_templates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_templates_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          code: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          settings?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      parent_messages: {
        Row: {
          attachment_url: string | null
          content: string
          created_at: string
          id: string
          parent_id: string
          read_at: string | null
          sender_role: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          attachment_url?: string | null
          content: string
          created_at?: string
          id?: string
          parent_id: string
          read_at?: string | null
          sender_role?: string
          student_id: string
          teacher_id: string
        }
        Update: {
          attachment_url?: string | null
          content?: string
          created_at?: string
          id?: string
          parent_id?: string
          read_at?: string | null
          sender_role?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          parent_id: string
          read_at: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          parent_id: string
          read_at?: string | null
          title: string
          type?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          parent_id?: string
          read_at?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_notifications_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_profiles: {
        Row: {
          created_at: string
          id: string
          phone: string | null
          preferred_language: string
          relationship: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          phone?: string | null
          preferred_language?: string
          relationship?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          phone?: string | null
          preferred_language?: string
          relationship?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      parent_reports: {
        Row: {
          course_id: string | null
          created_at: string
          generated_at: string
          id: string
          language: string
          pdf_url: string | null
          period_end: string
          period_start: string
          read_at: string | null
          report_json: Json
          student_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          generated_at?: string
          id?: string
          language?: string
          pdf_url?: string | null
          period_end: string
          period_start: string
          read_at?: string | null
          report_json?: Json
          student_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          generated_at?: string
          id?: string
          language?: string
          pdf_url?: string | null
          period_end?: string
          period_start?: string
          read_at?: string | null
          report_json?: Json
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_reports_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_student_links: {
        Row: {
          id: string
          linked_at: string
          linked_by: string | null
          messaging_on: boolean
          notifications_on: boolean
          parent_id: string
          reports_on: boolean
          student_id: string
        }
        Insert: {
          id?: string
          linked_at?: string
          linked_by?: string | null
          messaging_on?: boolean
          notifications_on?: boolean
          parent_id: string
          reports_on?: boolean
          student_id: string
        }
        Update: {
          id?: string
          linked_at?: string
          linked_by?: string | null
          messaging_on?: boolean
          notifications_on?: boolean
          parent_id?: string
          reports_on?: boolean
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_student_links_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount_foreign: number
          amount_local: number
          branch_id: string | null
          created_at: string
          currency_foreign: string
          currency_local: string
          division_id: string | null
          effective_rate: number | null
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          period_from: string | null
          period_to: string | null
          receipt_url: string | null
          recorded_by: string | null
          resolution_type: string
          shortfall_amount: number
          student_id: string
        }
        Insert: {
          amount_foreign?: number
          amount_local?: number
          branch_id?: string | null
          created_at?: string
          currency_foreign?: string
          currency_local?: string
          division_id?: string | null
          effective_rate?: number | null
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          period_from?: string | null
          period_to?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          resolution_type?: string
          shortfall_amount?: number
          student_id: string
        }
        Update: {
          amount_foreign?: number
          amount_local?: number
          branch_id?: string | null
          created_at?: string
          currency_foreign?: string
          currency_local?: string
          division_id?: string | null
          effective_rate?: number | null
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          period_from?: string | null
          period_to?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          resolution_type?: string
          shortfall_amount?: number
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "fee_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      phrase_mastery: {
        Row: {
          attempt_count: number | null
          id: string
          last_score: number | null
          mastered_at: string | null
          phrase_id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number | null
          id?: string
          last_score?: number | null
          mastered_at?: string | null
          phrase_id: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number | null
          id?: string
          last_score?: number | null
          mastered_at?: string | null
          phrase_id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phrase_mastery_phrase_id_fkey"
            columns: ["phrase_id"]
            isOneToOne: false
            referencedRelation: "drill_phrases"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_videos: {
        Row: {
          added_at: string
          added_by: string | null
          id: string
          playlist_id: string
          position: number
          video_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          id?: string
          playlist_id: string
          position?: number
          video_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          id?: string
          playlist_id?: string
          position?: number
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_videos_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "session_playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_videos_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "video_library"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_options: {
        Row: {
          created_at: string
          id: string
          option_text: string
          poll_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          option_text: string
          poll_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          option_text?: string
          poll_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_responses: {
        Row: {
          created_at: string
          id: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_responses_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_responses_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          branch_id: string | null
          course_id: string | null
          created_at: string
          created_by: string
          description: string | null
          division_id: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          course_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          division_id?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          division_id?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age: number | null
          archived_at: string | null
          bank_account_number: string | null
          bank_account_title: string | null
          bank_iban: string | null
          bank_name: string | null
          city: string | null
          country: string | null
          country_code: string | null
          created_at: string
          daily_target_amount: number
          daily_target_lines: number
          default_payout_rate: number | null
          email: string | null
          full_name: string
          gender: string | null
          id: string
          meeting_link: string | null
          mushaf_type: string
          preferred_language: string | null
          preferred_unit: string
          region: string | null
          registration_id: string | null
          teaching_os_language: string
          timezone: string | null
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          age?: number | null
          archived_at?: string | null
          bank_account_number?: string | null
          bank_account_title?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          daily_target_amount?: number
          daily_target_lines?: number
          default_payout_rate?: number | null
          email?: string | null
          full_name: string
          gender?: string | null
          id?: string
          meeting_link?: string | null
          mushaf_type?: string
          preferred_language?: string | null
          preferred_unit?: string
          region?: string | null
          registration_id?: string | null
          teaching_os_language?: string
          timezone?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          age?: number | null
          archived_at?: string | null
          bank_account_number?: string | null
          bank_account_title?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          daily_target_amount?: number
          daily_target_lines?: number
          default_payout_rate?: number | null
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          meeting_link?: string | null
          mushaf_type?: string
          preferred_language?: string | null
          preferred_unit?: string
          region?: string | null
          registration_id?: string | null
          teaching_os_language?: string
          timezone?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          branch_id: string | null
          created_at: string
          description: string | null
          division_id: string | null
          id: string
          name: string
          owner_id: string
          status: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          description?: string | null
          division_id?: string | null
          id?: string
          name: string
          owner_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          description?: string | null
          division_id?: string | null
          id?: string
          name?: string
          owner_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotional_posts: {
        Row: {
          attachment_url: string | null
          channels: string[]
          content: string
          course_id: string
          created_at: string
          created_by: string | null
          id: string
          scheduled_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          attachment_url?: string | null
          channels?: string[]
          content?: string
          course_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          scheduled_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          attachment_url?: string | null
          channels?: string[]
          content?: string
          course_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          scheduled_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotional_posts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          answers: Json
          completed_at: string | null
          created_at: string
          guest_email: string | null
          guest_name: string | null
          id: string
          max_score: number
          percentage: number
          questions: Json
          quiz_bank_id: string
          score: number
          session_id: string
          started_at: string
          status: string
          student_id: string | null
          time_taken_seconds: number | null
        }
        Insert: {
          answers?: Json
          completed_at?: string | null
          created_at?: string
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          max_score?: number
          percentage?: number
          questions?: Json
          quiz_bank_id: string
          score?: number
          session_id: string
          started_at?: string
          status?: string
          student_id?: string | null
          time_taken_seconds?: number | null
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          created_at?: string
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          max_score?: number
          percentage?: number
          questions?: Json
          quiz_bank_id?: string
          score?: number
          session_id?: string
          started_at?: string
          status?: string
          student_id?: string | null
          time_taken_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_bank_id_fkey"
            columns: ["quiz_bank_id"]
            isOneToOne: false
            referencedRelation: "quiz_banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "quiz_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_banks: {
        Row: {
          course_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          difficulty_level: string
          id: string
          language: string
          max_attempts: number | null
          mode: string
          name: string
          passing_percentage: number | null
          question_bank: Json
          question_mix: Json
          questions_per_attempt: number
          source_content: string | null
          status: string
          time_limit_minutes: number | null
          updated_at: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty_level?: string
          id?: string
          language?: string
          max_attempts?: number | null
          mode?: string
          name: string
          passing_percentage?: number | null
          question_bank?: Json
          question_mix?: Json
          questions_per_attempt?: number
          source_content?: string | null
          status?: string
          time_limit_minutes?: number | null
          updated_at?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty_level?: string
          id?: string
          language?: string
          max_attempts?: number | null
          mode?: string
          name?: string
          passing_percentage?: number | null
          question_bank?: Json
          question_mix?: Json
          questions_per_attempt?: number
          source_content?: string | null
          status?: string
          time_limit_minutes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_banks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          blooms_level: string | null
          correct_answer: string | null
          created_at: string
          difficulty: string | null
          explanation: string | null
          id: string
          kit_id: string
          options: Json | null
          question: string
          question_index: number
          type: string
        }
        Insert: {
          blooms_level?: string | null
          correct_answer?: string | null
          created_at?: string
          difficulty?: string | null
          explanation?: string | null
          id?: string
          kit_id: string
          options?: Json | null
          question: string
          question_index?: number
          type?: string
        }
        Update: {
          blooms_level?: string | null
          correct_answer?: string | null
          created_at?: string
          difficulty?: string | null
          explanation?: string | null
          id?: string
          kit_id?: string
          options?: Json | null
          question?: string
          question_index?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "content_kits"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_sessions: {
        Row: {
          access_token: string
          closes_at: string | null
          created_at: string
          created_by: string | null
          id: string
          opens_at: string | null
          quiz_bank_id: string
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          opens_at?: string | null
          quiz_bank_id: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          opens_at?: string | null
          quiz_bank_id?: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_sessions_quiz_bank_id_fkey"
            columns: ["quiz_bank_id"]
            isOneToOne: false
            referencedRelation: "quiz_banks"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_submissions: {
        Row: {
          answer: string | null
          id: string
          is_correct: boolean | null
          quiz_question_id: string
          student_id: string
          submitted_at: string
        }
        Insert: {
          answer?: string | null
          id?: string
          is_correct?: boolean | null
          quiz_question_id: string
          student_id: string
          submitted_at?: string
        }
        Update: {
          answer?: string | null
          id?: string
          is_correct?: boolean | null
          quiz_question_id?: string
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_submissions_quiz_question_id_fkey"
            columns: ["quiz_question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_form_fields: {
        Row: {
          created_at: string
          field_key: string
          field_type: string
          form_id: string
          id: string
          is_default: boolean
          is_required: boolean
          label: string
          options: Json | null
          placeholder: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          field_key: string
          field_type?: string
          form_id: string
          id?: string
          is_default?: boolean
          is_required?: boolean
          label: string
          options?: Json | null
          placeholder?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          field_key?: string
          field_type?: string
          form_id?: string
          id?: string
          is_default?: boolean
          is_required?: boolean
          label?: string
          options?: Json | null
          placeholder?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "registration_form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "registration_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_forms: {
        Row: {
          course_id: string
          created_at: string
          id: string
          is_active: boolean
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          slug: string
          title?: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_forms_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: true
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_sequences: {
        Row: {
          branch_code: string
          created_at: string
          id: string
          next_val: number
          org_code: string
          role_code: string
        }
        Insert: {
          branch_code: string
          created_at?: string
          id?: string
          next_val?: number
          org_code: string
          role_code: string
        }
        Update: {
          branch_code?: string
          created_at?: string
          id?: string
          next_val?: number
          org_code?: string
          role_code?: string
        }
        Relationships: []
      }
      registration_submissions: {
        Row: {
          course_id: string
          created_at: string
          data: Json
          eligibility_notes: string | null
          eligibility_status: string | null
          enrollment_id: string | null
          form_id: string
          id: string
          match_confidence: string | null
          match_status: string
          matched_profile_id: string | null
          notes: string | null
          processed_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_tag: string | null
          status: string
          submitted_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          data?: Json
          eligibility_notes?: string | null
          eligibility_status?: string | null
          enrollment_id?: string | null
          form_id: string
          id?: string
          match_confidence?: string | null
          match_status?: string
          matched_profile_id?: string | null
          notes?: string | null
          processed_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_tag?: string | null
          status?: string
          submitted_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          data?: Json
          eligibility_notes?: string | null
          eligibility_status?: string | null
          enrollment_id?: string | null
          form_id?: string
          id?: string
          match_confidence?: string | null
          match_status?: string
          matched_profile_id?: string | null
          notes?: string | null
          processed_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_tag?: string | null
          status?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_submissions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_submissions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "course_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "registration_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_submissions_matched_profile_id_fkey"
            columns: ["matched_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_assignments: {
        Row: {
          assigned_by: string
          assigned_to: string
          course_id: string | null
          created_at: string
          id: string
          notes: string | null
          resource_id: string
        }
        Insert: {
          assigned_by: string
          assigned_to: string
          course_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          resource_id: string
        }
        Update: {
          assigned_by?: string
          assigned_to?: string
          course_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_assignments_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          created_at: string
          deleted_at: string | null
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
          visibility: string
          visible_to_roles: string[] | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
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
          visibility?: string
          visible_to_roles?: string[] | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
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
          visibility?: string
          visible_to_roles?: string[] | null
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
      rukus: {
        Row: {
          ayah_from: number
          ayah_to: number
          created_at: string | null
          id: string
          juz_number: number | null
          ruku_number: number
          surah_number: number
        }
        Insert: {
          ayah_from: number
          ayah_to: number
          created_at?: string | null
          id?: string
          juz_number?: number | null
          ruku_number: number
          surah_number: number
        }
        Update: {
          ayah_from?: number
          ayah_to?: number
          created_at?: string | null
          id?: string
          juz_number?: number | null
          ruku_number?: number
          surah_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "rukus_surah_number_fkey"
            columns: ["surah_number"]
            isOneToOne: false
            referencedRelation: "surahs"
            referencedColumns: ["surah_number"]
          },
        ]
      }
      salary_adjustments: {
        Row: {
          adjustment_mode: string
          adjustment_type: string
          amount: number
          apply_to: string | null
          bulk_batch_id: string | null
          created_at: string
          created_by: string | null
          expense_id: string | null
          id: string
          is_bulk: boolean
          percentage_value: number | null
          reason: string | null
          resolved_amount: number | null
          salary_month: string
          student_id: string | null
          teacher_id: string
        }
        Insert: {
          adjustment_mode?: string
          adjustment_type: string
          amount?: number
          apply_to?: string | null
          bulk_batch_id?: string | null
          created_at?: string
          created_by?: string | null
          expense_id?: string | null
          id?: string
          is_bulk?: boolean
          percentage_value?: number | null
          reason?: string | null
          resolved_amount?: number | null
          salary_month: string
          student_id?: string | null
          teacher_id: string
        }
        Update: {
          adjustment_mode?: string
          adjustment_type?: string
          amount?: number
          apply_to?: string | null
          bulk_batch_id?: string | null
          created_at?: string
          created_by?: string | null
          expense_id?: string | null
          id?: string
          is_bulk?: boolean
          percentage_value?: number | null
          reason?: string | null
          resolved_amount?: number | null
          salary_month?: string
          student_id?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_adjustments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_adjustments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_adjustments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_payouts: {
        Row: {
          adjustment_amount: number
          amount_paid: number
          base_salary: number
          calculation_json: Json | null
          created_at: string
          deductions: number
          expense_amount: number
          extra_class_amount: number
          gross_salary: number
          id: string
          invoice_number: string | null
          locked_at: string | null
          locked_by: string | null
          net_salary: number
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          partial_notes: string | null
          payment_method: string | null
          payment_reference: string | null
          receipt_url: string | null
          receipt_urls: string[] | null
          revert_reason: string | null
          reverted_at: string | null
          reverted_by: string | null
          salary_month: string
          status: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          adjustment_amount?: number
          amount_paid?: number
          base_salary?: number
          calculation_json?: Json | null
          created_at?: string
          deductions?: number
          expense_amount?: number
          extra_class_amount?: number
          gross_salary?: number
          id?: string
          invoice_number?: string | null
          locked_at?: string | null
          locked_by?: string | null
          net_salary?: number
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          partial_notes?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          receipt_url?: string | null
          receipt_urls?: string[] | null
          revert_reason?: string | null
          reverted_at?: string | null
          reverted_by?: string | null
          salary_month: string
          status?: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          adjustment_amount?: number
          amount_paid?: number
          base_salary?: number
          calculation_json?: Json | null
          created_at?: string
          deductions?: number
          expense_amount?: number
          extra_class_amount?: number
          gross_salary?: number
          id?: string
          invoice_number?: string | null
          locked_at?: string | null
          locked_by?: string | null
          net_salary?: number
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          partial_notes?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          receipt_url?: string | null
          receipt_urls?: string[] | null
          revert_reason?: string | null
          reverted_at?: string | null
          reverted_by?: string | null
          salary_month?: string
          status?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_payouts_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_payouts_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_payouts_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_overrides: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          new_date: string
          new_start_time: string
          original_date: string
          reason: string | null
          schedule_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          new_date: string
          new_start_time: string
          original_date: string
          reason?: string | null
          schedule_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          new_date?: string
          new_start_time?: string
          original_date?: string
          reason?: string | null
          schedule_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_overrides_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          assignment_id: string | null
          branch_id: string | null
          course_id: string | null
          created_at: string
          day_of_week: string
          division_id: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          student_local_time: string
          teacher_local_time: string
          updated_at: string
        }
        Insert: {
          assignment_id?: string | null
          branch_id?: string | null
          course_id?: string | null
          created_at?: string
          day_of_week: string
          division_id?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          student_local_time: string
          teacher_local_time: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string | null
          branch_id?: string | null
          course_id?: string | null
          created_at?: string
          day_of_week?: string
          division_id?: string | null
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
          {
            foreignKeyName: "schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_logs: {
        Row: {
          activities_done: number | null
          activities_total: number | null
          actual_duration: number | null
          created_at: string
          ended_at: string | null
          id: string
          session_notes: string | null
          session_plan_id: string
          started_at: string
          status: string
          students_present: number | null
          updated_at: string
        }
        Insert: {
          activities_done?: number | null
          activities_total?: number | null
          actual_duration?: number | null
          created_at?: string
          ended_at?: string | null
          id?: string
          session_notes?: string | null
          session_plan_id: string
          started_at?: string
          status?: string
          students_present?: number | null
          updated_at?: string
        }
        Update: {
          activities_done?: number | null
          activities_total?: number | null
          actual_duration?: number | null
          created_at?: string
          ended_at?: string | null
          id?: string
          session_notes?: string | null
          session_plan_id?: string
          started_at?: string
          status?: string
          students_present?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_logs_session_plan_id_fkey"
            columns: ["session_plan_id"]
            isOneToOne: false
            referencedRelation: "session_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      session_plans: {
        Row: {
          activities: Json | null
          created_at: string
          homework_suggestion: string | null
          id: string
          language: string
          outline_day_id: string | null
          session_date: string | null
          session_day: string | null
          session_number: number
          session_objective: string | null
          session_title: string | null
          status: string
          syllabus_id: string
          teacher_notes: string | null
          total_minutes: number | null
          updated_at: string
          week_number: number
        }
        Insert: {
          activities?: Json | null
          created_at?: string
          homework_suggestion?: string | null
          id?: string
          language?: string
          outline_day_id?: string | null
          session_date?: string | null
          session_day?: string | null
          session_number: number
          session_objective?: string | null
          session_title?: string | null
          status?: string
          syllabus_id: string
          teacher_notes?: string | null
          total_minutes?: number | null
          updated_at?: string
          week_number: number
        }
        Update: {
          activities?: Json | null
          created_at?: string
          homework_suggestion?: string | null
          id?: string
          language?: string
          outline_day_id?: string | null
          session_date?: string | null
          session_day?: string | null
          session_number?: number
          session_objective?: string | null
          session_title?: string | null
          status?: string
          syllabus_id?: string
          teacher_notes?: string | null
          total_minutes?: number | null
          updated_at?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_plans_outline_day_id_fkey"
            columns: ["outline_day_id"]
            isOneToOne: false
            referencedRelation: "course_outlines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_plans_syllabus_id_fkey"
            columns: ["syllabus_id"]
            isOneToOne: false
            referencedRelation: "syllabi"
            referencedColumns: ["id"]
          },
        ]
      }
      session_playlists: {
        Row: {
          course_id: string | null
          created_at: string
          created_by: string | null
          id: string
          session_plan_id: string | null
          shared_at: string | null
          title: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          session_plan_id?: string | null
          shared_at?: string | null
          title?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          session_plan_id?: string | null
          shared_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_playlists_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_playlists_session_plan_id_fkey"
            columns: ["session_plan_id"]
            isOneToOne: false
            referencedRelation: "session_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      session_recordings: {
        Row: {
          created_at: string
          download_url: string | null
          file_size_mb: number | null
          file_type: string | null
          id: string
          password: string | null
          play_url: string | null
          recording_end: string | null
          recording_start: string | null
          recording_type: string
          session_id: string
          status: string
        }
        Insert: {
          created_at?: string
          download_url?: string | null
          file_size_mb?: number | null
          file_type?: string | null
          id?: string
          password?: string | null
          play_url?: string | null
          recording_end?: string | null
          recording_start?: string | null
          recording_type?: string
          session_id: string
          status?: string
        }
        Update: {
          created_at?: string
          download_url?: string | null
          file_size_mb?: number | null
          file_type?: string | null
          id?: string
          password?: string | null
          play_url?: string | null
          recording_end?: string | null
          recording_start?: string | null
          recording_type?: string
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_recordings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      slides: {
        Row: {
          activity_instruction: string | null
          arabic_text: string | null
          bullets: Json | null
          created_at: string
          edited: boolean | null
          edited_content: Json | null
          id: string
          kit_id: string
          layout_type: string | null
          phase: string | null
          slide_index: number
          teacher_note: string | null
          title: string | null
          transliteration: string | null
        }
        Insert: {
          activity_instruction?: string | null
          arabic_text?: string | null
          bullets?: Json | null
          created_at?: string
          edited?: boolean | null
          edited_content?: Json | null
          id?: string
          kit_id: string
          layout_type?: string | null
          phase?: string | null
          slide_index?: number
          teacher_note?: string | null
          title?: string | null
          transliteration?: string | null
        }
        Update: {
          activity_instruction?: string | null
          arabic_text?: string | null
          bullets?: Json | null
          created_at?: string
          edited?: boolean | null
          edited_content?: Json | null
          id?: string
          kit_id?: string
          layout_type?: string | null
          phase?: string | null
          slide_index?: number
          teacher_note?: string | null
          title?: string | null
          transliteration?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "slides_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "content_kits"
            referencedColumns: ["id"]
          },
        ]
      }
      source_files: {
        Row: {
          course_id: string | null
          detected_chapters: Json | null
          extracted_text: string | null
          filename: string
          id: string
          page_count: number | null
          uploaded_at: string
        }
        Insert: {
          course_id?: string | null
          detected_chapters?: Json | null
          extracted_text?: string | null
          filename: string
          id?: string
          page_count?: number | null
          uploaded_at?: string
        }
        Update: {
          course_id?: string | null
          detected_chapters?: Json | null
          extracted_text?: string | null
          filename?: string
          id?: string
          page_count?: number | null
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_files_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      speaking_assignment_submissions: {
        Row: {
          assignment_id: string
          completed_at: string | null
          created_at: string
          final_score: number | null
          id: string
          status: string
          student_id: string
        }
        Insert: {
          assignment_id: string
          completed_at?: string | null
          created_at?: string
          final_score?: number | null
          id?: string
          status?: string
          student_id: string
        }
        Update: {
          assignment_id?: string
          completed_at?: string | null
          created_at?: string
          final_score?: number | null
          id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "speaking_assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "speaking_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      speaking_assignments: {
        Row: {
          assigned_to: Json | null
          created_at: string
          created_by: string | null
          due_at: string | null
          id: string
          instructions: string | null
          mode: string
          phrase_ids: Json | null
          session_id: string | null
          title: string
        }
        Insert: {
          assigned_to?: Json | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          instructions?: string | null
          mode?: string
          phrase_ids?: Json | null
          session_id?: string | null
          title: string
        }
        Update: {
          assigned_to?: Json | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          instructions?: string | null
          mode?: string
          phrase_ids?: Json | null
          session_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "speaking_assignments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      speaking_attempts: {
        Row: {
          assignment_id: string | null
          attempted_at: string
          audio_url: string | null
          feedback: string | null
          fluency: number | null
          id: string
          overall_score: number | null
          phrase_id: string | null
          pronunciation: number | null
          session_id: string | null
          student_id: string
          tip: string | null
          transcription: string | null
          word_breakdown: Json | null
        }
        Insert: {
          assignment_id?: string | null
          attempted_at?: string
          audio_url?: string | null
          feedback?: string | null
          fluency?: number | null
          id?: string
          overall_score?: number | null
          phrase_id?: string | null
          pronunciation?: number | null
          session_id?: string | null
          student_id: string
          tip?: string | null
          transcription?: string | null
          word_breakdown?: Json | null
        }
        Update: {
          assignment_id?: string | null
          attempted_at?: string
          audio_url?: string | null
          feedback?: string | null
          fluency?: number | null
          id?: string
          overall_score?: number | null
          phrase_id?: string | null
          pronunciation?: number | null
          session_id?: string | null
          student_id?: string
          tip?: string | null
          transcription?: string | null
          word_breakdown?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "speaking_attempts_phrase_id_fkey"
            columns: ["phrase_id"]
            isOneToOne: false
            referencedRelation: "drill_phrases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaking_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      speaking_conversations: {
        Row: {
          assignment_id: string | null
          duration_sec: number | null
          ended_at: string | null
          id: string
          messages: Json | null
          session_id: string | null
          started_at: string
          student_id: string
          vocab_used: Json | null
        }
        Insert: {
          assignment_id?: string | null
          duration_sec?: number | null
          ended_at?: string | null
          id?: string
          messages?: Json | null
          session_id?: string | null
          started_at?: string
          student_id: string
          vocab_used?: Json | null
        }
        Update: {
          assignment_id?: string | null
          duration_sec?: number | null
          ended_at?: string | null
          id?: string
          messages?: Json | null
          session_id?: string | null
          started_at?: string
          student_id?: string
          vocab_used?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "speaking_conversations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      speaking_drills: {
        Row: {
          category: string | null
          course_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_library: boolean | null
          kit_id: string | null
          level: string | null
          title: string
        }
        Insert: {
          category?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_library?: boolean | null
          kit_id?: string | null
          level?: string | null
          title: string
        }
        Update: {
          category?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_library?: boolean | null
          kit_id?: string | null
          level?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "speaking_drills_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaking_drills_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "content_kits"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_salaries: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          monthly_amount: number
          notes: string | null
          prorate_partial_months: boolean
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          monthly_amount?: number
          notes?: string | null
          prorate_partial_months?: boolean
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          monthly_amount?: number
          notes?: string | null
          prorate_partial_months?: boolean
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_salaries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_billing_plans: {
        Row: {
          assignment_id: string | null
          base_package_id: string | null
          branch_id: string | null
          created_at: string
          currency: string
          division_id: string | null
          duration_surcharge: number
          flat_discount: number
          global_discount_id: string | null
          id: string
          is_active: boolean
          manual_discount_reason: string | null
          net_recurring_fee: number
          session_duration: number
          student_id: string
          updated_at: string
        }
        Insert: {
          assignment_id?: string | null
          base_package_id?: string | null
          branch_id?: string | null
          created_at?: string
          currency?: string
          division_id?: string | null
          duration_surcharge?: number
          flat_discount?: number
          global_discount_id?: string | null
          id?: string
          is_active?: boolean
          manual_discount_reason?: string | null
          net_recurring_fee?: number
          session_duration?: number
          student_id: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string | null
          base_package_id?: string | null
          branch_id?: string | null
          created_at?: string
          currency?: string
          division_id?: string | null
          duration_surcharge?: number
          flat_discount?: number
          global_discount_id?: string | null
          id?: string
          is_active?: boolean
          manual_discount_reason?: string | null
          net_recurring_fee?: number
          session_duration?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_billing_plans_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "student_teacher_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_billing_plans_base_package_id_fkey"
            columns: ["base_package_id"]
            isOneToOne: false
            referencedRelation: "fee_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_billing_plans_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_billing_plans_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_billing_plans_global_discount_id_fkey"
            columns: ["global_discount_id"]
            isOneToOne: false
            referencedRelation: "discount_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_billing_plans_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          division_id: string | null
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
          division_id?: string | null
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
          division_id?: string | null
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
            foreignKeyName: "student_monthly_plans_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
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
          oversight_level: string
          parent_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          oversight_level?: string
          parent_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          oversight_level?: string
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
      student_signals: {
        Row: {
          created_at: string
          id: string
          session_log_id: string
          signal_type: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_log_id: string
          signal_type?: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          session_log_id?: string
          signal_type?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_signals_session_log_id_fkey"
            columns: ["session_log_id"]
            isOneToOne: false
            referencedRelation: "session_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      student_teacher_assignments: {
        Row: {
          branch_id: string | null
          calculated_monthly_fee: number | null
          created_at: string
          discount_id: string | null
          division_id: string | null
          duration_minutes: number
          effective_from_date: string | null
          effective_to_date: string | null
          enrollment_ref: string | null
          fee_package_id: string | null
          first_month_prorated_fee: number | null
          id: string
          is_custom_override: boolean
          parent_assignment_id: string | null
          payout_amount: number | null
          payout_type: string | null
          requires_attendance: boolean
          requires_planning: boolean
          requires_schedule: boolean
          start_date: string | null
          status: Database["public"]["Enums"]["assignment_status"]
          status_effective_date: string | null
          student_id: string
          student_timezone: string | null
          subject_id: string | null
          substitute_end_date: string | null
          teacher_id: string
          teacher_timezone: string | null
          transfer_type: string | null
        }
        Insert: {
          branch_id?: string | null
          calculated_monthly_fee?: number | null
          created_at?: string
          discount_id?: string | null
          division_id?: string | null
          duration_minutes?: number
          effective_from_date?: string | null
          effective_to_date?: string | null
          enrollment_ref?: string | null
          fee_package_id?: string | null
          first_month_prorated_fee?: number | null
          id?: string
          is_custom_override?: boolean
          parent_assignment_id?: string | null
          payout_amount?: number | null
          payout_type?: string | null
          requires_attendance?: boolean
          requires_planning?: boolean
          requires_schedule?: boolean
          start_date?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          status_effective_date?: string | null
          student_id: string
          student_timezone?: string | null
          subject_id?: string | null
          substitute_end_date?: string | null
          teacher_id: string
          teacher_timezone?: string | null
          transfer_type?: string | null
        }
        Update: {
          branch_id?: string | null
          calculated_monthly_fee?: number | null
          created_at?: string
          discount_id?: string | null
          division_id?: string | null
          duration_minutes?: number
          effective_from_date?: string | null
          effective_to_date?: string | null
          enrollment_ref?: string | null
          fee_package_id?: string | null
          first_month_prorated_fee?: number | null
          id?: string
          is_custom_override?: boolean
          parent_assignment_id?: string | null
          payout_amount?: number | null
          payout_type?: string | null
          requires_attendance?: boolean
          requires_planning?: boolean
          requires_schedule?: boolean
          start_date?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          status_effective_date?: string | null
          student_id?: string
          student_timezone?: string | null
          subject_id?: string | null
          substitute_end_date?: string | null
          teacher_id?: string
          teacher_timezone?: string | null
          transfer_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_teacher_assignments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_teacher_assignments_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discount_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_teacher_assignments_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_teacher_assignments_fee_package_id_fkey"
            columns: ["fee_package_id"]
            isOneToOne: false
            referencedRelation: "fee_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_teacher_assignments_parent_assignment_id_fkey"
            columns: ["parent_assignment_id"]
            isOneToOne: false
            referencedRelation: "student_teacher_assignments"
            referencedColumns: ["id"]
          },
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
      surahs: {
        Row: {
          created_at: string | null
          juz_end: number | null
          juz_start: number | null
          revelation_type: string
          surah_name_ar: string
          surah_name_en: string
          surah_number: number
          total_ayah: number
        }
        Insert: {
          created_at?: string | null
          juz_end?: number | null
          juz_start?: number | null
          revelation_type?: string
          surah_name_ar: string
          surah_name_en: string
          surah_number: number
          total_ayah: number
        }
        Update: {
          created_at?: string | null
          juz_end?: number | null
          juz_start?: number | null
          revelation_type?: string
          surah_name_ar?: string
          surah_name_en?: string
          surah_number?: number
          total_ayah?: number
        }
        Relationships: []
      }
      syllabi: {
        Row: {
          course_id: string | null
          course_name: string
          created_at: string
          duration_weeks: number | null
          id: string
          language: string
          learning_goals: string | null
          level: string | null
          rows: Json | null
          sessions_week: number | null
          source_text: string | null
          status: string
          subject: string | null
          target_audience: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
          course_name: string
          created_at?: string
          duration_weeks?: number | null
          id?: string
          language?: string
          learning_goals?: string | null
          level?: string | null
          rows?: Json | null
          sessions_week?: number | null
          source_text?: string | null
          status?: string
          subject?: string | null
          target_audience?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string | null
          course_name?: string
          created_at?: string
          duration_weeks?: number | null
          id?: string
          language?: string
          learning_goals?: string | null
          level?: string | null
          rows?: Json | null
          sessions_week?: number | null
          source_text?: string | null
          status?: string
          subject?: string | null
          target_audience?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "syllabi_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      syllabus_exports: {
        Row: {
          exported_at: string
          exported_by: string
          format: string
          id: string
          syllabus_id: string
        }
        Insert: {
          exported_at?: string
          exported_by: string
          format: string
          id?: string
          syllabus_id: string
        }
        Update: {
          exported_at?: string
          exported_by?: string
          format?: string
          id?: string
          syllabus_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "syllabus_exports_syllabus_id_fkey"
            columns: ["syllabus_id"]
            isOneToOne: false
            referencedRelation: "syllabi"
            referencedColumns: ["id"]
          },
        ]
      }
      system_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_email: string | null
          user_full_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_email?: string | null
          user_full_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_email?: string | null
          user_full_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          branch_id: string | null
          created_at: string
          created_by: string
          deadline: string | null
          description: string | null
          division_id: string | null
          id: string
          is_anonymous: boolean
          linked_ticket_id: string | null
          priority: string
          source_id: string | null
          source_type: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          branch_id?: string | null
          created_at?: string
          created_by: string
          deadline?: string | null
          description?: string | null
          division_id?: string | null
          id?: string
          is_anonymous?: boolean
          linked_ticket_id?: string | null
          priority?: string
          source_id?: string | null
          source_type?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string
          deadline?: string | null
          description?: string | null
          division_id?: string | null
          id?: string
          is_anonymous?: boolean
          linked_ticket_id?: string | null
          priority?: string
          source_id?: string | null
          source_type?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_linked_ticket_id_fkey"
            columns: ["linked_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tat_defaults: {
        Row: {
          branch_id: string | null
          category: string
          created_at: string
          id: string
          priority: string
          tat_hours: number
        }
        Insert: {
          branch_id?: string | null
          category: string
          created_at?: string
          id?: string
          priority?: string
          tat_hours?: number
        }
        Update: {
          branch_id?: string | null
          category?: string
          created_at?: string
          id?: string
          priority?: string
          tat_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "tat_defaults_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_payouts: {
        Row: {
          calculated_amount: number
          class_id: string | null
          course_id: string | null
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          paid_reference: string | null
          payout_type: string
          period_end: string
          period_start: string
          rate: number
          sessions_count: number
          status: string
          students_count: number
          teacher_id: string
          updated_at: string
        }
        Insert: {
          calculated_amount?: number
          class_id?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_reference?: string | null
          payout_type?: string
          period_end: string
          period_start: string
          rate?: number
          sessions_count?: number
          status?: string
          students_count?: number
          teacher_id: string
          updated_at?: string
        }
        Update: {
          calculated_amount?: number
          class_id?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_reference?: string | null
          payout_type?: string
          period_end?: string
          period_start?: string
          rate?: number
          sessions_count?: number
          status?: string
          students_count?: number
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_payouts_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "course_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_payouts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      teaching_exam_questions: {
        Row: {
          auto_mark: boolean | null
          blank_sentence: string | null
          blooms_level: string | null
          correct_answer: string | null
          created_at: string
          difficulty: string | null
          exam_id: string
          id: string
          model_answer: string | null
          options: Json | null
          points: number
          question_index: number
          question_text: string
          rubric: Json | null
          scenario_context: string | null
          type: string
        }
        Insert: {
          auto_mark?: boolean | null
          blank_sentence?: string | null
          blooms_level?: string | null
          correct_answer?: string | null
          created_at?: string
          difficulty?: string | null
          exam_id: string
          id?: string
          model_answer?: string | null
          options?: Json | null
          points?: number
          question_index?: number
          question_text: string
          rubric?: Json | null
          scenario_context?: string | null
          type?: string
        }
        Update: {
          auto_mark?: boolean | null
          blank_sentence?: string | null
          blooms_level?: string | null
          correct_answer?: string | null
          created_at?: string
          difficulty?: string | null
          exam_id?: string
          id?: string
          model_answer?: string | null
          options?: Json | null
          points?: number
          question_index?: number
          question_text?: string
          rubric?: Json | null
          scenario_context?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "teaching_exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "teaching_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      teaching_exam_responses: {
        Row: {
          ai_confidence: number | null
          ai_feedback: string | null
          ai_score: number | null
          created_at: string
          id: string
          is_correct: boolean | null
          marked_at: string | null
          question_id: string
          rubric_breakdown: Json | null
          score_awarded: number | null
          student_answer: string | null
          submission_id: string
          teacher_feedback: string | null
          teacher_reviewed: boolean | null
          teacher_score: number | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_feedback?: string | null
          ai_score?: number | null
          created_at?: string
          id?: string
          is_correct?: boolean | null
          marked_at?: string | null
          question_id: string
          rubric_breakdown?: Json | null
          score_awarded?: number | null
          student_answer?: string | null
          submission_id: string
          teacher_feedback?: string | null
          teacher_reviewed?: boolean | null
          teacher_score?: number | null
        }
        Update: {
          ai_confidence?: number | null
          ai_feedback?: string | null
          ai_score?: number | null
          created_at?: string
          id?: string
          is_correct?: boolean | null
          marked_at?: string | null
          question_id?: string
          rubric_breakdown?: Json | null
          score_awarded?: number | null
          student_answer?: string | null
          submission_id?: string
          teacher_feedback?: string | null
          teacher_reviewed?: boolean | null
          teacher_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "teaching_exam_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "teaching_exam_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_exam_responses_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "teaching_exam_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      teaching_exam_submissions: {
        Row: {
          created_at: string
          exam_id: string
          id: string
          passed: boolean | null
          percentage: number | null
          started_at: string | null
          status: string
          student_id: string
          submitted_at: string | null
          time_taken_minutes: number | null
          total_possible: number | null
          total_score: number | null
        }
        Insert: {
          created_at?: string
          exam_id: string
          id?: string
          passed?: boolean | null
          percentage?: number | null
          started_at?: string | null
          status?: string
          student_id: string
          submitted_at?: string | null
          time_taken_minutes?: number | null
          total_possible?: number | null
          total_score?: number | null
        }
        Update: {
          created_at?: string
          exam_id?: string
          id?: string
          passed?: boolean | null
          percentage?: number | null
          started_at?: string | null
          status?: string
          student_id?: string
          submitted_at?: string | null
          time_taken_minutes?: number | null
          total_possible?: number | null
          total_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "teaching_exam_submissions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "teaching_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      teaching_exams: {
        Row: {
          closes_at: string | null
          course_id: string | null
          created_at: string
          created_by: string | null
          duration_minutes: number | null
          id: string
          instructions: string | null
          language: string
          opens_at: string | null
          pass_mark_percent: number | null
          published_at: string | null
          session_plan_id: string | null
          settings: Json | null
          status: string
          title: string
          total_marks: number | null
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          id?: string
          instructions?: string | null
          language?: string
          opens_at?: string | null
          pass_mark_percent?: number | null
          published_at?: string | null
          session_plan_id?: string | null
          settings?: Json | null
          status?: string
          title?: string
          total_marks?: number | null
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          id?: string
          instructions?: string | null
          language?: string
          opens_at?: string | null
          pass_mark_percent?: number | null
          published_at?: string | null
          session_plan_id?: string | null
          settings?: Json | null
          status?: string
          title?: string
          total_marks?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teaching_exams_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_exams_session_plan_id_fkey"
            columns: ["session_plan_id"]
            isOneToOne: false
            referencedRelation: "session_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_comments: {
        Row: {
          attachment_url: string | null
          author_id: string
          created_at: string
          id: string
          is_internal: boolean
          marked_user_id: string | null
          message: string
          metadata: Json | null
          ticket_id: string
        }
        Insert: {
          attachment_url?: string | null
          author_id: string
          created_at?: string
          id?: string
          is_internal?: boolean
          marked_user_id?: string | null
          message: string
          metadata?: Json | null
          ticket_id: string
        }
        Update: {
          attachment_url?: string | null
          author_id?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          marked_user_id?: string | null
          message?: string
          metadata?: Json | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_subcategories: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          tat_override_hours: number | null
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          tat_override_hours?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          tat_override_hours?: number | null
        }
        Relationships: []
      }
      ticket_watchers: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          ticket_id: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_watchers_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assignee_id: string
          attachment_url: string | null
          branch_id: string | null
          category: string
          closed_at: string | null
          created_at: string
          creator_id: string
          description: string | null
          division_id: string | null
          due_date: string | null
          id: string
          is_anonymous: boolean
          is_overdue: boolean
          metadata: Json | null
          priority: string
          project_id: string | null
          resolved_at: string | null
          status: string
          subcategory_id: string | null
          subject: string
          target_role: string | null
          tat_deadline: string | null
          tat_hours: number | null
          ticket_number: number
          updated_at: string
        }
        Insert: {
          assignee_id: string
          attachment_url?: string | null
          branch_id?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          creator_id: string
          description?: string | null
          division_id?: string | null
          due_date?: string | null
          id?: string
          is_anonymous?: boolean
          is_overdue?: boolean
          metadata?: Json | null
          priority?: string
          project_id?: string | null
          resolved_at?: string | null
          status?: string
          subcategory_id?: string | null
          subject: string
          target_role?: string | null
          tat_deadline?: string | null
          tat_hours?: number | null
          ticket_number?: number
          updated_at?: string
        }
        Update: {
          assignee_id?: string
          attachment_url?: string | null
          branch_id?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          creator_id?: string
          description?: string | null
          division_id?: string | null
          due_date?: string | null
          id?: string
          is_anonymous?: boolean
          is_overdue?: boolean
          metadata?: Json | null
          priority?: string
          project_id?: string | null
          resolved_at?: string | null
          status?: string
          subcategory_id?: string | null
          subject?: string
          target_role?: string | null
          tat_deadline?: string | null
          tat_hours?: number | null
          ticket_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "ticket_subcategories"
            referencedColumns: ["id"]
          },
        ]
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
      user_context: {
        Row: {
          branch_id: string
          created_at: string
          division_id: string
          id: string
          is_default: boolean
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          division_id: string
          id?: string
          is_default?: boolean
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          division_id?: string
          id?: string
          is_default?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_context_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_context_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_context_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      video_filter_settings: {
        Row: {
          academy_id: string | null
          course_id: string | null
          id: string
          rules: Json | null
          strictness: string
          updated_at: string
        }
        Insert: {
          academy_id?: string | null
          course_id?: string | null
          id?: string
          rules?: Json | null
          strictness?: string
          updated_at?: string
        }
        Update: {
          academy_id?: string | null
          course_id?: string | null
          id?: string
          rules?: Json | null
          strictness?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_filter_settings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      video_insights: {
        Row: {
          applied: boolean | null
          created_at: string
          description: string
          id: string
          session_plan_id: string | null
          suggested_action: string | null
          title: string
          type: string
        }
        Insert: {
          applied?: boolean | null
          created_at?: string
          description: string
          id?: string
          session_plan_id?: string | null
          suggested_action?: string | null
          title: string
          type?: string
        }
        Update: {
          applied?: boolean | null
          created_at?: string
          description?: string
          id?: string
          session_plan_id?: string | null
          suggested_action?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_insights_session_plan_id_fkey"
            columns: ["session_plan_id"]
            isOneToOne: false
            referencedRelation: "session_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      video_library: {
        Row: {
          academy_id: string | null
          added_at: string
          added_by: string | null
          ai_score: number | null
          channel_name: string | null
          content_tags: Json | null
          duration_seconds: number | null
          id: string
          recommendation_reason: string | null
          safety_flags: Json | null
          safety_status: string
          thumbnail_url: string | null
          title: string
          use_count: number | null
          youtube_id: string
        }
        Insert: {
          academy_id?: string | null
          added_at?: string
          added_by?: string | null
          ai_score?: number | null
          channel_name?: string | null
          content_tags?: Json | null
          duration_seconds?: number | null
          id?: string
          recommendation_reason?: string | null
          safety_flags?: Json | null
          safety_status?: string
          thumbnail_url?: string | null
          title: string
          use_count?: number | null
          youtube_id: string
        }
        Update: {
          academy_id?: string | null
          added_at?: string
          added_by?: string | null
          ai_score?: number | null
          channel_name?: string | null
          content_tags?: Json | null
          duration_seconds?: number | null
          id?: string
          recommendation_reason?: string | null
          safety_flags?: Json | null
          safety_status?: string
          thumbnail_url?: string | null
          title?: string
          use_count?: number | null
          youtube_id?: string
        }
        Relationships: []
      }
      video_watch_events: {
        Row: {
          completed: boolean | null
          created_at: string
          id: string
          last_watched_at: string | null
          playlist_id: string | null
          replay_count: number | null
          session_id: string | null
          student_id: string
          total_seconds: number | null
          video_id: string
          watched_seconds: number | null
        }
        Insert: {
          completed?: boolean | null
          created_at?: string
          id?: string
          last_watched_at?: string | null
          playlist_id?: string | null
          replay_count?: number | null
          session_id?: string | null
          student_id: string
          total_seconds?: number | null
          video_id: string
          watched_seconds?: number | null
        }
        Update: {
          completed?: boolean | null
          created_at?: string
          id?: string
          last_watched_at?: string | null
          playlist_id?: string | null
          replay_count?: number | null
          session_id?: string | null
          student_id?: string
          total_seconds?: number | null
          video_id?: string
          watched_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_watch_events_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "session_playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_watch_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_watch_events_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "video_library"
            referencedColumns: ["id"]
          },
        ]
      }
      virtual_sessions: {
        Row: {
          class_id: string | null
          course_id: string
          created_at: string
          created_by: string
          ended_at: string | null
          id: string
          provider: string
          room_name: string
          room_token: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          class_id?: string | null
          course_id: string
          created_at?: string
          created_by: string
          ended_at?: string | null
          id?: string
          provider?: string
          room_name: string
          room_token?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          class_id?: string | null
          course_id?: string
          created_at?: string
          created_by?: string
          ended_at?: string | null
          id?: string
          provider?: string
          room_name?: string
          room_token?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtual_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "course_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "virtual_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_contacts: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          name: string | null
          phone: string
          profile_id: string | null
          unread_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          name?: string | null
          phone: string
          profile_id?: string | null
          unread_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          name?: string | null
          phone?: string
          profile_id?: string | null
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_contacts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          attachment_type: string | null
          attachment_url: string | null
          contact_id: string
          created_at: string
          delivery_status: string
          direction: string
          forwarded_to_group_id: string | null
          forwarded_to_task_id: string | null
          forwarded_to_user_id: string | null
          id: string
          is_forwarded: boolean
          message_text: string | null
          sent_by: string | null
          template_name: string | null
          updated_at: string
          wa_message_id: string | null
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          contact_id: string
          created_at?: string
          delivery_status?: string
          direction?: string
          forwarded_to_group_id?: string | null
          forwarded_to_task_id?: string | null
          forwarded_to_user_id?: string | null
          id?: string
          is_forwarded?: boolean
          message_text?: string | null
          sent_by?: string | null
          template_name?: string | null
          updated_at?: string
          wa_message_id?: string | null
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          contact_id?: string
          created_at?: string
          delivery_status?: string
          direction?: string
          forwarded_to_group_id?: string | null
          forwarded_to_task_id?: string | null
          forwarded_to_user_id?: string | null
          id?: string
          is_forwarded?: boolean
          message_text?: string | null
          sent_by?: string | null
          template_name?: string | null
          updated_at?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_forwarded_to_group_id_fkey"
            columns: ["forwarded_to_group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_forwarded_to_task_id_fkey"
            columns: ["forwarded_to_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_forwarded_to_user_id_fkey"
            columns: ["forwarded_to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      worksheets: {
        Row: {
          created_at: string
          exercises: Json | null
          id: string
          kit_id: string
          title: string | null
        }
        Insert: {
          created_at?: string
          exercises?: Json | null
          id?: string
          kit_id: string
          title?: string | null
        }
        Update: {
          created_at?: string
          exercises?: Json | null
          id?: string
          kit_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "worksheets_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "content_kits"
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
          participant_email: string | null
          participant_name: string | null
          role: string | null
          session_id: string
          timestamp: string
          total_duration_minutes: number | null
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["attendance_action"]
          id?: string
          join_time?: string | null
          leave_time?: string | null
          participant_email?: string | null
          participant_name?: string | null
          role?: string | null
          session_id: string
          timestamp?: string
          total_duration_minutes?: number | null
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["attendance_action"]
          id?: string
          join_time?: string | null
          leave_time?: string | null
          participant_email?: string | null
          participant_name?: string | null
          role?: string | null
          session_id?: string
          timestamp?: string
          total_duration_minutes?: number | null
          user_id?: string | null
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
          license_type: string
          meeting_link: string
          priority: number
          status: Database["public"]["Enums"]["zoom_license_status"]
          updated_at: string
          zoom_email: string
        }
        Insert: {
          created_at?: string
          host_id?: string | null
          id?: string
          last_used_at?: string | null
          license_type?: string
          meeting_link: string
          priority?: number
          status?: Database["public"]["Enums"]["zoom_license_status"]
          updated_at?: string
          zoom_email: string
        }
        Update: {
          created_at?: string
          host_id?: string | null
          id?: string
          last_used_at?: string | null
          license_type?: string
          meeting_link?: string
          priority?: number
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
      can_view_resource_visibility: {
        Args: { _visibility: string; _visible_to_roles: string[] }
        Returns: boolean
      }
      generate_registration_id: {
        Args: { _branch_code: string; _org_code: string; _role_code: string }
        Returns: string
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
      get_user_default_context: {
        Args: { _user_id: string }
        Returns: {
          branch_id: string
          division_id: string
        }[]
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
      is_chat_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_course_staff: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
      is_enrolled_in_course: {
        Args: { _course_id: string; _student_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_ticket_participant: {
        Args: { _ticket_id: string; _user_id: string }
        Returns: boolean
      }
      is_ticket_watcher: {
        Args: { _ticket_id: string; _user_id: string }
        Returns: boolean
      }
      normalize_phone: {
        Args: { p_country: string; raw_phone: string }
        Returns: string
      }
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
      assignment_status: "active" | "paused" | "completed" | "left"
      attendance_action: "join_intent" | "leave"
      billing_cycle: "monthly" | "quarterly" | "one_time"
      branch_type: "online" | "onsite"
      discount_type: "percentage" | "fixed_amount"
      division_model: "one_to_one" | "group"
      eligibility_rule_type:
        | "prerequisite_course"
        | "min_attendance"
        | "must_pass_exam"
      exam_tenure: "weekly" | "monthly" | "quarterly" | "yearly"
      grading_style: "numeric" | "rubric"
      invoice_status:
        | "pending"
        | "paid"
        | "overdue"
        | "partially_paid"
        | "waived"
        | "adjusted"
        | "voided"
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
      assignment_status: ["active", "paused", "completed", "left"],
      attendance_action: ["join_intent", "leave"],
      billing_cycle: ["monthly", "quarterly", "one_time"],
      branch_type: ["online", "onsite"],
      discount_type: ["percentage", "fixed_amount"],
      division_model: ["one_to_one", "group"],
      eligibility_rule_type: [
        "prerequisite_course",
        "min_attendance",
        "must_pass_exam",
      ],
      exam_tenure: ["weekly", "monthly", "quarterly", "yearly"],
      grading_style: ["numeric", "rubric"],
      invoice_status: [
        "pending",
        "paid",
        "overdue",
        "partially_paid",
        "waived",
        "adjusted",
        "voided",
      ],
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

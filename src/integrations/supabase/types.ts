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
      branches: {
        Row: {
          address: string | null
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
      courses: {
        Row: {
          branch_id: string | null
          created_at: string
          division_id: string | null
          end_date: string | null
          id: string
          is_group_class: boolean
          max_students: number
          name: string
          start_date: string
          status: string
          subject_id: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          division_id?: string | null
          end_date?: string | null
          id?: string
          is_group_class?: boolean
          max_students?: number
          name: string
          start_date: string
          status?: string
          subject_id?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          division_id?: string | null
          end_date?: string | null
          id?: string
          is_group_class?: boolean
          max_students?: number
          name?: string
          start_date?: string
          status?: string
          subject_id?: string | null
          teacher_id?: string
          updated_at?: string
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
      organizations: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
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
          email: string | null
          full_name: string
          gender: string | null
          id: string
          meeting_link: string | null
          mushaf_type: string
          preferred_language: string | null
          preferred_unit: string
          region: string | null
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
          email?: string | null
          full_name: string
          gender?: string | null
          id?: string
          meeting_link?: string | null
          mushaf_type?: string
          preferred_language?: string | null
          preferred_unit?: string
          region?: string | null
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
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          meeting_link?: string | null
          mushaf_type?: string
          preferred_language?: string | null
          preferred_unit?: string
          region?: string | null
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
          branch_id: string | null
          calculated_monthly_fee: number | null
          created_at: string
          discount_id: string | null
          division_id: string | null
          duration_minutes: number
          effective_from_date: string | null
          effective_to_date: string | null
          fee_package_id: string | null
          first_month_prorated_fee: number | null
          id: string
          is_custom_override: boolean
          payout_amount: number | null
          payout_type: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["assignment_status"]
          status_effective_date: string | null
          student_id: string
          student_timezone: string | null
          subject_id: string | null
          teacher_id: string
          teacher_timezone: string | null
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
          fee_package_id?: string | null
          first_month_prorated_fee?: number | null
          id?: string
          is_custom_override?: boolean
          payout_amount?: number | null
          payout_type?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          status_effective_date?: string | null
          student_id: string
          student_timezone?: string | null
          subject_id?: string | null
          teacher_id: string
          teacher_timezone?: string | null
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
          fee_package_id?: string | null
          first_month_prorated_fee?: number | null
          id?: string
          is_custom_override?: boolean
          payout_amount?: number | null
          payout_type?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          status_effective_date?: string | null
          student_id?: string
          student_timezone?: string | null
          subject_id?: string | null
          teacher_id?: string
          teacher_timezone?: string | null
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
          branch_id: string | null
          category: string
          closed_at: string | null
          created_at: string
          creator_id: string
          description: string | null
          division_id: string | null
          due_date: string | null
          id: string
          is_overdue: boolean
          metadata: Json | null
          priority: string
          project_id: string | null
          resolved_at: string | null
          status: string
          subcategory_id: string | null
          subject: string
          tat_deadline: string | null
          tat_hours: number | null
          ticket_number: number
          updated_at: string
        }
        Insert: {
          assignee_id: string
          branch_id?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          creator_id: string
          description?: string | null
          division_id?: string | null
          due_date?: string | null
          id?: string
          is_overdue?: boolean
          metadata?: Json | null
          priority?: string
          project_id?: string | null
          resolved_at?: string | null
          status?: string
          subcategory_id?: string | null
          subject: string
          tat_deadline?: string | null
          tat_hours?: number | null
          ticket_number?: number
          updated_at?: string
        }
        Update: {
          assignee_id?: string
          branch_id?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          creator_id?: string
          description?: string | null
          division_id?: string | null
          due_date?: string | null
          id?: string
          is_overdue?: boolean
          metadata?: Json | null
          priority?: string
          project_id?: string | null
          resolved_at?: string | null
          status?: string
          subcategory_id?: string | null
          subject?: string
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
      can_view_resource_visibility: {
        Args: { _visibility: string; _visible_to_roles: string[] }
        Returns: boolean
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
      is_enrolled_in_course: {
        Args: { _course_id: string; _student_id: string }
        Returns: boolean
      }
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
      assignment_status: "active" | "paused" | "completed" | "left"
      attendance_action: "join_intent" | "leave"
      billing_cycle: "monthly" | "quarterly" | "one_time"
      branch_type: "online" | "onsite"
      discount_type: "percentage" | "fixed_amount"
      division_model: "one_to_one" | "group"
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

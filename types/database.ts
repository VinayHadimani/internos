export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          email: string | null
          college_name: string | null
          phone: string | null
          skills: string[] | null
          avatar_url: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          full_name?: string | null
          email?: string | null
          college_name?: string | null
          phone?: string | null
          skills?: string[] | null
          avatar_url?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          full_name?: string | null
          email?: string | null
          college_name?: string | null
          phone?: string | null
          skills?: string[] | null
          avatar_url?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      resumes: {
        Row: {
          id: string
          user_id: string | null
          file_name: string | null
          file_url: string | null
          original_text: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          file_name?: string | null
          file_url?: string | null
          original_text?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          file_name?: string | null
          file_url?: string | null
          original_text?: string | null
          created_at?: string | null
        }
      }
      internships: {
        Row: {
          id: string
          title: string | null
          company: string | null
          location: string | null
          stipend: string | null
          duration: string | null
          description: string | null
          requirements: string[] | null
          skills_required: string[] | null
          category: string | null
          source: string | null
          external_url: string | null
          posted_date: string | null
          deadline: string | null
          is_active: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          title?: string | null
          company?: string | null
          location?: string | null
          stipend?: string | null
          duration?: string | null
          description?: string | null
          requirements?: string[] | null
          skills_required?: string[] | null
          category?: string | null
          source?: string | null
          external_url?: string | null
          posted_date?: string | null
          deadline?: string | null
          is_active?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          title?: string | null
          company?: string | null
          location?: string | null
          stipend?: string | null
          duration?: string | null
          description?: string | null
          requirements?: string[] | null
          skills_required?: string[] | null
          category?: string | null
          source?: string | null
          external_url?: string | null
          posted_date?: string | null
          deadline?: string | null
          is_active?: boolean | null
          created_at?: string | null
        }
      }
      tailored_resumes: {
        Row: {
          id: string
          user_id: string | null
          resume_id: string | null
          internship_id: string | null
          original_resume_text: string | null
          tailored_resume_text: string | null
          job_description: string | null
          match_score: number | null
          missing_skills: string[] | null
          suggestions: string[] | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          resume_id?: string | null
          internship_id?: string | null
          original_resume_text?: string | null
          tailored_resume_text?: string | null
          job_description?: string | null
          match_score?: number | null
          missing_skills?: string[] | null
          suggestions?: string[] | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          resume_id?: string | null
          internship_id?: string | null
          original_resume_text?: string | null
          tailored_resume_text?: string | null
          job_description?: string | null
          match_score?: number | null
          missing_skills?: string[] | null
          suggestions?: string[] | null
          created_at?: string | null
        }
      }
      applications: {
        Row: {
          id: string
          user_id: string | null
          internship_id: string | null
          resume_id: string | null
          tailored_resume_id: string | null
          status: string | null
          notes: string | null
          applied_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          internship_id?: string | null
          resume_id?: string | null
          tailored_resume_id?: string | null
          status?: string | null
          notes?: string | null
          applied_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          internship_id?: string | null
          resume_id?: string | null
          tailored_resume_id?: string | null
          status?: string | null
          notes?: string | null
          applied_at?: string | null
          created_at?: string | null
        }
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string | null
          plan: string | null
          tailor_count: number | null
          tailor_limit: number | null
          razorpay_customer_id: string | null
          razorpay_subscription_id: string | null
          current_period_start: string | null
          current_period_end: string | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          plan?: string | null
          tailor_count?: number | null
          tailor_limit?: number | null
          razorpay_customer_id?: string | null
          razorpay_subscription_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          plan?: string | null
          tailor_count?: number | null
          tailor_limit?: number | null
          razorpay_customer_id?: string | null
          razorpay_subscription_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      usage_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string | null
          metadata: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          action?: string | null
          metadata?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string | null
          metadata?: Json | null
          created_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

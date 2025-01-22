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
      company_users: {
        Row: {
          id: string
          company_id: string
          user_id: string
          role: string
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          user_id: string
          role: string
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          user_id?: string
          role?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      companies: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          id: string
          name: string
          phone: string
          area_code: string
          state: string
          city: string
          street: string | null
          number: string | null
          complement: string | null
          neighborhood: string | null
          zip_code: string | null
          parts_type: string
          specialization: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          phone: string
          area_code: string
          state: string
          city: string
          street?: string | null
          number?: string | null
          complement?: string | null
          neighborhood?: string | null
          zip_code?: string | null
          parts_type: string
          specialization: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          phone?: string
          area_code?: string
          state?: string
          city?: string
          street?: string | null
          number?: string | null
          complement?: string | null
          neighborhood?: string | null
          zip_code?: string | null
          parts_type?: string
          specialization?: string
          user_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      whatsapp_configs: {
        Row: {
          id: string
          company_id: string
          evolution_api_url: string
          evolution_api_key: string
          instance_name: string
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          evolution_api_url: string
          evolution_api_key: string
          instance_name: string
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          evolution_api_url?: string
          evolution_api_key?: string
          instance_name?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_configs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          }
        ]
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
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
      message_templates: {
        Row: {
          id: string
          name: string
          content: string
          is_default: boolean
          sequence: number
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          content: string
          is_default?: boolean
          sequence: number
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          content?: string
          is_default?: boolean
          sequence?: number
          user_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      purchase_orders: {
        Row: {
          id: string
          created_at: string
          quotation_id: string
          supplier_id: string
          status: string
          total_amount: number
          notes?: string
          delivery_time?: string
        }
        Insert: {
          id?: string
          created_at?: string
          quotation_id: string
          supplier_id: string
          status: string
          total_amount: number
          notes?: string
          delivery_time?: string
        }
        Update: {
          id?: string
          created_at?: string
          quotation_id?: string
          supplier_id?: string
          status?: string
          total_amount?: number
          notes?: string
          delivery_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          }
        ]
      }
      purchase_order_items: {
        Row: {
          id: string
          purchase_order_id: string
          part_description: string
          quantity: number
          unit_price: number
          total_price: number
          notes?: string
        }
        Insert: {
          id?: string
          purchase_order_id: string
          part_description: string
          quantity: number
          unit_price: number
          total_price: number
          notes?: string
        }
        Update: {
          id?: string
          purchase_order_id?: string
          part_description?: string
          quantity?: number
          unit_price?: number
          total_price?: number
          notes?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          }
        ]
      }
      quotation_requests: {
        Row: {
          id: string
          quotation_id: string
          supplier_id: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          quotation_id: string
          supplier_id: string
          status: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          quotation_id?: string
          supplier_id?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_requests_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_requests_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          }
        ]
      }
      quotations: {
        Row: {
          id: string
          vehicle_id: string
          created_at: string
        }
        Insert: {
          id?: string
          vehicle_id: string
          created_at?: string
        }
        Update: {
          id?: string
          vehicle_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          }
        ]
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
      vehicles: {
        Row: {
          id: string
          brand: string
          model: string
          year: string
          created_at: string
        }
        Insert: {
          id?: string
          brand: string
          model: string
          year: string
          created_at?: string
        }
        Update: {
          id?: string
          brand?: string
          model?: string
          year?: string
          created_at?: string
        }
        Relationships: []
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
      update_template_sequences_up: {
        Args: {
          p_template_id: string
          p_old_sequence: number
          p_new_sequence: number
        }
        Returns: void
      }
      update_template_sequences_down: {
        Args: {
          p_template_id: string
          p_old_sequence: number
          p_new_sequence: number
        }
        Returns: void
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
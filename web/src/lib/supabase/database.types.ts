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
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          checksum: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          mime_type: string | null
          original_filename: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_by: string
        }
        Update: {
          checksum?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          context: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          context?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          context?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_activities: {
        Row: {
          activity_at: string
          activity_type: Database["public"]["Enums"]["activity_type"]
          created_at: string
          customer_id: string
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          user_id: string
        }
        Insert: {
          activity_at?: string
          activity_type: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          user_id: string
        }
        Update: {
          activity_at?: string
          activity_type?: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_activities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_metrics"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_activities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_assignments: {
        Row: {
          active: boolean
          assigned_by: string
          assignment_type: Database["public"]["Enums"]["assignment_type"]
          created_at: string
          customer_id: string
          end_at: string | null
          id: string
          reason: string | null
          start_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          assigned_by: string
          assignment_type: Database["public"]["Enums"]["assignment_type"]
          created_at?: string
          customer_id: string
          end_at?: string | null
          id?: string
          reason?: string | null
          start_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          assigned_by?: string
          assignment_type?: Database["public"]["Enums"]["assignment_type"]
          created_at?: string
          customer_id?: string
          end_at?: string | null
          id?: string
          reason?: string | null
          start_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_assignments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_metrics"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_assignments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          channel: string | null
          check_digit: string | null
          city: string | null
          city_code: string | null
          commercial_name: string | null
          created_at: string
          credit_limit: number | null
          customer_type: string
          customer_type_classification: string | null
          department: string | null
          document_number: string
          document_number_normalized: string
          document_type: string
          email: string | null
          first_name: string | null
          fiscal_responsibility: string | null
          ghl_contact_id: string | null
          id: string
          is_duplicate_candidate: boolean
          last_contact_at: string | null
          last_name: string | null
          last_purchase_at: string | null
          legal_name: string | null
          merged_into_customer_id: string | null
          phone: string | null
          postal_code: string | null
          purchase_type: string | null
          responsible_user_id: string | null
          secondary_phone: string | null
          siigo_customer_id: string | null
          source: string | null
          state_code: string | null
          status: Database["public"]["Enums"]["customer_status"]
          updated_at: string
          vat_responsible: boolean | null
          website_social: string | null
        }
        Insert: {
          address?: string | null
          channel?: string | null
          check_digit?: string | null
          city?: string | null
          city_code?: string | null
          commercial_name?: string | null
          created_at?: string
          credit_limit?: number | null
          customer_type: string
          customer_type_classification?: string | null
          department?: string | null
          document_number: string
          document_number_normalized: string
          document_type: string
          email?: string | null
          first_name?: string | null
          fiscal_responsibility?: string | null
          ghl_contact_id?: string | null
          id?: string
          is_duplicate_candidate?: boolean
          last_contact_at?: string | null
          last_name?: string | null
          last_purchase_at?: string | null
          legal_name?: string | null
          merged_into_customer_id?: string | null
          phone?: string | null
          postal_code?: string | null
          purchase_type?: string | null
          responsible_user_id?: string | null
          secondary_phone?: string | null
          siigo_customer_id?: string | null
          source?: string | null
          state_code?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
          vat_responsible?: boolean | null
          website_social?: string | null
        }
        Update: {
          address?: string | null
          channel?: string | null
          check_digit?: string | null
          city?: string | null
          city_code?: string | null
          commercial_name?: string | null
          created_at?: string
          credit_limit?: number | null
          customer_type?: string
          customer_type_classification?: string | null
          department?: string | null
          document_number?: string
          document_number_normalized?: string
          document_type?: string
          email?: string | null
          first_name?: string | null
          fiscal_responsibility?: string | null
          ghl_contact_id?: string | null
          id?: string
          is_duplicate_candidate?: boolean
          last_contact_at?: string | null
          last_name?: string | null
          last_purchase_at?: string | null
          legal_name?: string | null
          merged_into_customer_id?: string | null
          phone?: string | null
          postal_code?: string | null
          purchase_type?: string | null
          responsible_user_id?: string | null
          secondary_phone?: string | null
          siigo_customer_id?: string | null
          source?: string | null
          state_code?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
          vat_responsible?: boolean | null
          website_social?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_merged_into_customer_id_fkey"
            columns: ["merged_into_customer_id"]
            isOneToOne: false
            referencedRelation: "customer_metrics"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customers_merged_into_customer_id_fkey"
            columns: ["merged_into_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_ups: {
        Row: {
          completed_at: string | null
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          priority: string | null
          reason: string | null
          result: string | null
          scheduled_at: string
          seller_id: string
          status: Database["public"]["Enums"]["follow_up_status"]
          type: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          priority?: string | null
          reason?: string | null
          result?: string | null
          scheduled_at: string
          seller_id: string
          status?: Database["public"]["Enums"]["follow_up_status"]
          type?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          priority?: string | null
          reason?: string | null
          result?: string | null
          scheduled_at?: string
          seller_id?: string
          status?: Database["public"]["Enums"]["follow_up_status"]
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_metrics"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "follow_ups_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          attempt: number
          created_at: string
          entity_id: string | null
          entity_type: string | null
          error_code: string | null
          error_message: string | null
          external_id: string | null
          finished_at: string | null
          http_status: number | null
          id: string
          operation: string
          request_id: string | null
          started_at: string
          status: string
          system: Database["public"]["Enums"]["integration_system"]
        }
        Insert: {
          attempt?: number
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_code?: string | null
          error_message?: string | null
          external_id?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          operation: string
          request_id?: string | null
          started_at?: string
          status: string
          system: Database["public"]["Enums"]["integration_system"]
        }
        Update: {
          attempt?: number
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_code?: string | null
          error_message?: string | null
          external_id?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          operation?: string
          request_id?: string | null
          started_at?: string
          status?: string
          system?: Database["public"]["Enums"]["integration_system"]
        }
        Relationships: []
      }
      invoice_operations: {
        Row: {
          attempt_count: number
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          idempotency_key: string
          last_attempt_at: string | null
          order_id: string
          request_started_at: string
          response_received_at: string | null
          siigo_invoice_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          idempotency_key: string
          last_attempt_at?: string | null
          order_id: string
          request_started_at?: string
          response_received_at?: string | null
          siigo_invoice_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string
          last_attempt_at?: string | null
          order_id?: string
          request_started_at?: string
          response_received_at?: string | null
          siigo_invoice_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_operations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          invoice_date: string | null
          invoice_number: string | null
          invoice_status: Database["public"]["Enums"]["invoice_status"]
          issued_by: string
          order_id: string
          response_reference: Json | null
          siigo_invoice_id: string | null
          siigo_status: string | null
          total: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_status?: Database["public"]["Enums"]["invoice_status"]
          issued_by: string
          order_id: string
          response_reference?: Json | null
          siigo_invoice_id?: string | null
          siigo_status?: string | null
          total?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_status?: Database["public"]["Enums"]["invoice_status"]
          issued_by?: string
          order_id?: string
          response_reference?: Json | null
          siigo_invoice_id?: string | null
          siigo_status?: string | null
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_metrics"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          discount_percent: number
          discount_value: number
          id: string
          line_subtotal: number
          line_tax: number
          line_total: number
          order_id: string
          product_code_snapshot: string
          product_id: string | null
          product_name_snapshot: string
          quantity: number
          siigo_product_id: string | null
          tax_id: string | null
          tax_percent: number | null
          unit_code: string | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount_percent?: number
          discount_value?: number
          id?: string
          line_subtotal: number
          line_tax?: number
          line_total: number
          order_id: string
          product_code_snapshot: string
          product_id?: string | null
          product_name_snapshot: string
          quantity: number
          siigo_product_id?: string | null
          tax_id?: string | null
          tax_percent?: number | null
          unit_code?: string | null
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount_percent?: number
          discount_value?: number
          id?: string
          line_subtotal?: number
          line_tax?: number
          line_total?: number
          order_id?: string
          product_code_snapshot?: string
          product_id?: string | null
          product_name_snapshot?: string
          quantity?: number
          siigo_product_id?: string | null
          tax_id?: string | null
          tax_percent?: number | null
          unit_code?: string | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_reviews: {
        Row: {
          created_at: string
          customer_ok: boolean
          fiscal_data_ok: boolean
          id: string
          inventory_ok: boolean
          notes: string | null
          order_id: string
          payment_ok: boolean
          prices_ok: boolean
          printed_receipt: boolean
          products_ok: boolean
          quantities_ok: boolean
          receipts_ok: boolean
          reviewed_at: string | null
          reviewed_by: string
          status: Database["public"]["Enums"]["order_review_status"]
        }
        Insert: {
          created_at?: string
          customer_ok?: boolean
          fiscal_data_ok?: boolean
          id?: string
          inventory_ok?: boolean
          notes?: string | null
          order_id: string
          payment_ok?: boolean
          prices_ok?: boolean
          printed_receipt?: boolean
          products_ok?: boolean
          quantities_ok?: boolean
          receipts_ok?: boolean
          reviewed_at?: string | null
          reviewed_by: string
          status?: Database["public"]["Enums"]["order_review_status"]
        }
        Update: {
          created_at?: string
          customer_ok?: boolean
          fiscal_data_ok?: boolean
          id?: string
          inventory_ok?: boolean
          notes?: string | null
          order_id?: string
          payment_ok?: boolean
          prices_ok?: boolean
          printed_receipt?: boolean
          products_ok?: boolean
          quantities_ok?: boolean
          receipts_ok?: boolean
          reviewed_at?: string | null
          reviewed_by?: string
          status?: Database["public"]["Enums"]["order_review_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string
          created_at: string
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: string
          metadata: Json | null
          order_id: string
          reason: string | null
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          changed_by: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          metadata?: Json | null
          order_id: string
          reason?: string | null
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          changed_by?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          metadata?: Json | null
          order_id?: string
          reason?: string | null
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          channel: string | null
          created_at: string
          customer_id: string
          delivered_at: string | null
          discount_total: number
          dispatched_at: string | null
          dispatched_by: string | null
          document_type: string | null
          ghl_opportunity_id: string | null
          grand_total: number
          id: string
          invoice_number: string | null
          invoiced_at: string | null
          invoiced_by: string | null
          invoicing_started_at: string | null
          notes: string | null
          order_number: string
          payment_method: string | null
          payment_method_detail: string | null
          price_list: string | null
          responsible_customer_owner_id: string
          retention_percent: number
          retention_total: number
          return_reason: string | null
          review_started_at: string | null
          seller_id: string
          siigo_invoice_id: string | null
          source_type: Database["public"]["Enums"]["order_source_type"]
          status: Database["public"]["Enums"]["order_status"]
          submitted_at: string | null
          subtotal_gross: number
          subtotal_net: number
          tax_total: number
          updated_at: string
          warehouse_reviewed_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          channel?: string | null
          created_at?: string
          customer_id: string
          delivered_at?: string | null
          discount_total?: number
          dispatched_at?: string | null
          dispatched_by?: string | null
          document_type?: string | null
          ghl_opportunity_id?: string | null
          grand_total?: number
          id?: string
          invoice_number?: string | null
          invoiced_at?: string | null
          invoiced_by?: string | null
          invoicing_started_at?: string | null
          notes?: string | null
          order_number: string
          payment_method?: string | null
          payment_method_detail?: string | null
          price_list?: string | null
          responsible_customer_owner_id: string
          retention_percent?: number
          retention_total?: number
          return_reason?: string | null
          review_started_at?: string | null
          seller_id: string
          siigo_invoice_id?: string | null
          source_type?: Database["public"]["Enums"]["order_source_type"]
          status?: Database["public"]["Enums"]["order_status"]
          submitted_at?: string | null
          subtotal_gross?: number
          subtotal_net?: number
          tax_total?: number
          updated_at?: string
          warehouse_reviewed_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          channel?: string | null
          created_at?: string
          customer_id?: string
          delivered_at?: string | null
          discount_total?: number
          dispatched_at?: string | null
          dispatched_by?: string | null
          document_type?: string | null
          ghl_opportunity_id?: string | null
          grand_total?: number
          id?: string
          invoice_number?: string | null
          invoiced_at?: string | null
          invoiced_by?: string | null
          invoicing_started_at?: string | null
          notes?: string | null
          order_number?: string
          payment_method?: string | null
          payment_method_detail?: string | null
          price_list?: string | null
          responsible_customer_owner_id?: string
          retention_percent?: number
          retention_total?: number
          return_reason?: string | null
          review_started_at?: string | null
          seller_id?: string
          siigo_invoice_id?: string | null
          source_type?: Database["public"]["Enums"]["order_source_type"]
          status?: Database["public"]["Enums"]["order_status"]
          submitted_at?: string | null
          subtotal_gross?: number
          subtotal_net?: number
          tax_total?: number
          updated_at?: string
          warehouse_reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_metrics"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_dispatched_by_fkey"
            columns: ["dispatched_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_invoiced_by_fkey"
            columns: ["invoiced_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_responsible_customer_owner_id_fkey"
            columns: ["responsible_customer_owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_warehouse_reviewed_by_fkey"
            columns: ["warehouse_reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          id: string
          order_id: string
          payment_date: string | null
          payment_method: string
          reference: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          id?: string
          order_id: string
          payment_date?: string | null
          payment_method: string
          reference?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          id?: string
          order_id?: string
          payment_date?: string | null
          payment_method?: string
          reference?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          brand: string | null
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          price_professional: number | null
          price_public: number | null
          price_salon: number | null
          siigo_product_id: string | null
          stock_cache: number | null
          stock_updated_at: string | null
          tax_id: string | null
          tax_percent: number | null
          unit_code: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          brand?: string | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          price_professional?: number | null
          price_public?: number | null
          price_salon?: number | null
          siigo_product_id?: string | null
          stock_cache?: number | null
          stock_updated_at?: string | null
          tax_id?: string | null
          tax_percent?: number | null
          unit_code?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand?: string | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          price_professional?: number | null
          price_public?: number | null
          price_salon?: number | null
          siigo_product_id?: string | null
          stock_cache?: number | null
          stock_updated_at?: string | null
          tax_id?: string | null
          tax_percent?: number | null
          unit_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      prospects: {
        Row: {
          city: string | null
          commercial_name: string | null
          converted_at: string | null
          created_at: string
          customer_id: string | null
          email: string | null
          first_visit_at: string | null
          id: string
          last_visit_at: string | null
          lost_reason: string | null
          name: string
          next_follow_up_at: string | null
          notes: string | null
          phone: string | null
          source: string | null
          stage: Database["public"]["Enums"]["prospect_stage"]
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          commercial_name?: string | null
          converted_at?: string | null
          created_at?: string
          customer_id?: string | null
          email?: string | null
          first_visit_at?: string | null
          id?: string
          last_visit_at?: string | null
          lost_reason?: string | null
          name: string
          next_follow_up_at?: string | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["prospect_stage"]
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          commercial_name?: string | null
          converted_at?: string | null
          created_at?: string
          customer_id?: string | null
          email?: string | null
          first_visit_at?: string | null
          id?: string
          last_visit_at?: string | null
          lost_reason?: string | null
          name?: string
          next_follow_up_at?: string | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["prospect_stage"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_metrics"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "prospects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          created_at: string
          discount_percent: number
          discount_value: number
          id: string
          line_subtotal: number
          line_tax: number
          line_total: number
          product_code_snapshot: string
          product_id: string | null
          product_name_snapshot: string
          quantity: number
          quote_id: string
          tax_id: string | null
          tax_percent: number | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount_percent?: number
          discount_value?: number
          id?: string
          line_subtotal: number
          line_tax?: number
          line_total: number
          product_code_snapshot: string
          product_id?: string | null
          product_name_snapshot: string
          quantity: number
          quote_id: string
          tax_id?: string | null
          tax_percent?: number | null
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount_percent?: number
          discount_value?: number
          id?: string
          line_subtotal?: number
          line_tax?: number
          line_total?: number
          product_code_snapshot?: string
          product_id?: string | null
          product_name_snapshot?: string
          quantity?: number
          quote_id?: string
          tax_id?: string | null
          tax_percent?: number | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          converted_order_id: string | null
          created_at: string
          customer_id: string
          discount_total: number
          grand_total: number
          id: string
          lost_at: string | null
          lost_reason: string | null
          notes: string | null
          price_list: string | null
          quote_number: string
          retention_total: number
          seller_id: string
          sent_at: string | null
          source_type: Database["public"]["Enums"]["order_source_type"]
          status: Database["public"]["Enums"]["quote_status"]
          subtotal: number
          tax_total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          accepted_at?: string | null
          converted_order_id?: string | null
          created_at?: string
          customer_id: string
          discount_total?: number
          grand_total?: number
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          notes?: string | null
          price_list?: string | null
          quote_number: string
          retention_total?: number
          seller_id: string
          sent_at?: string | null
          source_type?: Database["public"]["Enums"]["order_source_type"]
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          tax_total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          accepted_at?: string | null
          converted_order_id?: string | null
          created_at?: string
          customer_id?: string
          discount_total?: number
          grand_total?: number
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          notes?: string | null
          price_list?: string | null
          quote_number?: string
          retention_total?: number
          seller_id?: string
          sent_at?: string | null
          source_type?: Database["public"]["Enums"]["order_source_type"]
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          tax_total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_converted_order_fk"
            columns: ["converted_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_metrics"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          created_at: string
          delivery_confirmed_at: string | null
          dispatched_at: string | null
          dispatched_by: string | null
          id: string
          notes: string | null
          order_id: string
          status: Database["public"]["Enums"]["shipment_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_confirmed_at?: string | null
          dispatched_at?: string | null
          dispatched_by?: string | null
          id?: string
          notes?: string | null
          order_id: string
          status?: Database["public"]["Enums"]["shipment_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_confirmed_at?: string | null
          dispatched_at?: string | null
          dispatched_by?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          status?: Database["public"]["Enums"]["shipment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_dispatched_by_fkey"
            columns: ["dispatched_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_jobs: {
        Row: {
          created_at: string
          cursor: string | null
          error_summary: string | null
          finished_at: string | null
          id: string
          job_type: string
          records_failed: number
          records_processed: number
          started_at: string | null
          status: Database["public"]["Enums"]["sync_job_status"]
          system: Database["public"]["Enums"]["integration_system"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          cursor?: string | null
          error_summary?: string | null
          finished_at?: string | null
          id?: string
          job_type: string
          records_failed?: number
          records_processed?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_job_status"]
          system: Database["public"]["Enums"]["integration_system"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          cursor?: string | null
          error_summary?: string | null
          finished_at?: string | null
          id?: string
          job_type?: string
          records_failed?: number
          records_processed?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_job_status"]
          system?: Database["public"]["Enums"]["integration_system"]
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          active: boolean
          auth_user_id: string
          branch_code: string | null
          created_at: string
          email: string
          ghl_user_id: string | null
          id: string
          last_login_at: string | null
          name: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          seller_code: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          auth_user_id: string
          branch_code?: string | null
          created_at?: string
          email: string
          ghl_user_id?: string | null
          id?: string
          last_login_at?: string | null
          name: string
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          seller_code?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          auth_user_id?: string
          branch_code?: string | null
          created_at?: string
          email?: string
          ghl_user_id?: string | null
          id?: string
          last_login_at?: string | null
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          seller_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      customer_metrics: {
        Row: {
          average_ticket: number | null
          customer_id: string | null
          days_since_last_order: number | null
          last_order_at: string | null
          lifetime_value: number | null
          open_followups_count: number | null
          open_quotes_count: number | null
          orders_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      approve_order_for_invoice: {
        Args: {
          p_customer_ok: boolean
          p_fiscal_data_ok: boolean
          p_inventory_ok: boolean
          p_notes?: string
          p_order_id: string
          p_payment_ok: boolean
          p_prices_ok: boolean
          p_printed_receipt: boolean
          p_products_ok: boolean
          p_quantities_ok: boolean
          p_receipts_ok: boolean
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          channel: string | null
          created_at: string
          customer_id: string
          delivered_at: string | null
          discount_total: number
          dispatched_at: string | null
          dispatched_by: string | null
          document_type: string | null
          ghl_opportunity_id: string | null
          grand_total: number
          id: string
          invoice_number: string | null
          invoiced_at: string | null
          invoiced_by: string | null
          invoicing_started_at: string | null
          notes: string | null
          order_number: string
          payment_method: string | null
          payment_method_detail: string | null
          price_list: string | null
          responsible_customer_owner_id: string
          retention_percent: number
          retention_total: number
          return_reason: string | null
          review_started_at: string | null
          seller_id: string
          siigo_invoice_id: string | null
          source_type: Database["public"]["Enums"]["order_source_type"]
          status: Database["public"]["Enums"]["order_status"]
          submitted_at: string | null
          subtotal_gross: number
          subtotal_net: number
          tax_total: number
          updated_at: string
          warehouse_reviewed_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_order: {
        Args: { p_order_id: string; p_reason: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          channel: string | null
          created_at: string
          customer_id: string
          delivered_at: string | null
          discount_total: number
          dispatched_at: string | null
          dispatched_by: string | null
          document_type: string | null
          ghl_opportunity_id: string | null
          grand_total: number
          id: string
          invoice_number: string | null
          invoiced_at: string | null
          invoiced_by: string | null
          invoicing_started_at: string | null
          notes: string | null
          order_number: string
          payment_method: string | null
          payment_method_detail: string | null
          price_list: string | null
          responsible_customer_owner_id: string
          retention_percent: number
          retention_total: number
          return_reason: string | null
          review_started_at: string | null
          seller_id: string
          siigo_invoice_id: string | null
          source_type: Database["public"]["Enums"]["order_source_type"]
          status: Database["public"]["Enums"]["order_status"]
          submitted_at: string | null
          subtotal_gross: number
          subtotal_net: number
          tax_total: number
          updated_at: string
          warehouse_reviewed_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_customer: {
        Args: {
          p_address?: string
          p_city?: string
          p_commercial_name?: string
          p_customer_type: string
          p_document_number: string
          p_document_type: string
          p_email?: string
          p_first_name?: string
          p_last_name?: string
          p_legal_name?: string
          p_phone?: string
        }
        Returns: {
          address: string | null
          channel: string | null
          check_digit: string | null
          city: string | null
          city_code: string | null
          commercial_name: string | null
          created_at: string
          credit_limit: number | null
          customer_type: string
          customer_type_classification: string | null
          department: string | null
          document_number: string
          document_number_normalized: string
          document_type: string
          email: string | null
          first_name: string | null
          fiscal_responsibility: string | null
          ghl_contact_id: string | null
          id: string
          is_duplicate_candidate: boolean
          last_contact_at: string | null
          last_name: string | null
          last_purchase_at: string | null
          legal_name: string | null
          merged_into_customer_id: string | null
          phone: string | null
          postal_code: string | null
          purchase_type: string | null
          responsible_user_id: string | null
          secondary_phone: string | null
          siigo_customer_id: string | null
          source: string | null
          state_code: string | null
          status: Database["public"]["Enums"]["customer_status"]
          updated_at: string
          vat_responsible: boolean | null
          website_social: string | null
        }
        SetofOptions: {
          from: "*"
          to: "customers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_order: {
        Args: {
          p_channel?: string
          p_customer_id: string
          p_items: Json
          p_notes?: string
          p_payment_method?: string
          p_retention_percent?: number
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          channel: string | null
          created_at: string
          customer_id: string
          delivered_at: string | null
          discount_total: number
          dispatched_at: string | null
          dispatched_by: string | null
          document_type: string | null
          ghl_opportunity_id: string | null
          grand_total: number
          id: string
          invoice_number: string | null
          invoiced_at: string | null
          invoiced_by: string | null
          invoicing_started_at: string | null
          notes: string | null
          order_number: string
          payment_method: string | null
          payment_method_detail: string | null
          price_list: string | null
          responsible_customer_owner_id: string
          retention_percent: number
          retention_total: number
          return_reason: string | null
          review_started_at: string | null
          seller_id: string
          siigo_invoice_id: string | null
          source_type: Database["public"]["Enums"]["order_source_type"]
          status: Database["public"]["Enums"]["order_status"]
          submitted_at: string | null
          subtotal_gross: number
          subtotal_net: number
          tax_total: number
          updated_at: string
          warehouse_reviewed_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_quote: {
        Args: {
          p_customer_id: string
          p_items: Json
          p_notes?: string
          p_price_list?: string
          p_valid_until?: string
        }
        Returns: {
          accepted_at: string | null
          converted_order_id: string | null
          created_at: string
          customer_id: string
          discount_total: number
          grand_total: number
          id: string
          lost_at: string | null
          lost_reason: string | null
          notes: string | null
          price_list: string | null
          quote_number: string
          retention_total: number
          seller_id: string
          sent_at: string | null
          source_type: Database["public"]["Enums"]["order_source_type"]
          status: Database["public"]["Enums"]["quote_status"]
          subtotal: number
          tax_total: number
          updated_at: string
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "quotes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_wow_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      current_wow_user_id: { Args: never; Returns: string }
      mark_quote_accepted: {
        Args: { p_quote_id: string }
        Returns: {
          accepted_at: string | null
          converted_order_id: string | null
          created_at: string
          customer_id: string
          discount_total: number
          grand_total: number
          id: string
          lost_at: string | null
          lost_reason: string | null
          notes: string | null
          price_list: string | null
          quote_number: string
          retention_total: number
          seller_id: string
          sent_at: string | null
          source_type: Database["public"]["Enums"]["order_source_type"]
          status: Database["public"]["Enums"]["quote_status"]
          subtotal: number
          tax_total: number
          updated_at: string
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "quotes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_quote_lost: {
        Args: { p_quote_id: string; p_reason: string }
        Returns: {
          accepted_at: string | null
          converted_order_id: string | null
          created_at: string
          customer_id: string
          discount_total: number
          grand_total: number
          id: string
          lost_at: string | null
          lost_reason: string | null
          notes: string | null
          price_list: string | null
          quote_number: string
          retention_total: number
          seller_id: string
          sent_at: string | null
          source_type: Database["public"]["Enums"]["order_source_type"]
          status: Database["public"]["Enums"]["quote_status"]
          subtotal: number
          tax_total: number
          updated_at: string
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "quotes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      next_order_number: { Args: never; Returns: string }
      next_quote_number: { Args: never; Returns: string }
      return_order_to_seller: {
        Args: {
          p_customer_ok?: boolean
          p_fiscal_data_ok?: boolean
          p_inventory_ok?: boolean
          p_order_id: string
          p_payment_ok?: boolean
          p_prices_ok?: boolean
          p_printed_receipt?: boolean
          p_products_ok?: boolean
          p_quantities_ok?: boolean
          p_reason: string
          p_receipts_ok?: boolean
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          channel: string | null
          created_at: string
          customer_id: string
          delivered_at: string | null
          discount_total: number
          dispatched_at: string | null
          dispatched_by: string | null
          document_type: string | null
          ghl_opportunity_id: string | null
          grand_total: number
          id: string
          invoice_number: string | null
          invoiced_at: string | null
          invoiced_by: string | null
          invoicing_started_at: string | null
          notes: string | null
          order_number: string
          payment_method: string | null
          payment_method_detail: string | null
          price_list: string | null
          responsible_customer_owner_id: string
          retention_percent: number
          retention_total: number
          return_reason: string | null
          review_started_at: string | null
          seller_id: string
          siigo_invoice_id: string | null
          source_type: Database["public"]["Enums"]["order_source_type"]
          status: Database["public"]["Enums"]["order_status"]
          submitted_at: string | null
          subtotal_gross: number
          subtotal_net: number
          tax_total: number
          updated_at: string
          warehouse_reviewed_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_quote: {
        Args: { p_quote_id: string }
        Returns: {
          accepted_at: string | null
          converted_order_id: string | null
          created_at: string
          customer_id: string
          discount_total: number
          grand_total: number
          id: string
          lost_at: string | null
          lost_reason: string | null
          notes: string | null
          price_list: string | null
          quote_number: string
          retention_total: number
          seller_id: string
          sent_at: string | null
          source_type: Database["public"]["Enums"]["order_source_type"]
          status: Database["public"]["Enums"]["quote_status"]
          subtotal: number
          tax_total: number
          updated_at: string
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "quotes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_order_review: {
        Args: { p_order_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          channel: string | null
          created_at: string
          customer_id: string
          delivered_at: string | null
          discount_total: number
          dispatched_at: string | null
          dispatched_by: string | null
          document_type: string | null
          ghl_opportunity_id: string | null
          grand_total: number
          id: string
          invoice_number: string | null
          invoiced_at: string | null
          invoiced_by: string | null
          invoicing_started_at: string | null
          notes: string | null
          order_number: string
          payment_method: string | null
          payment_method_detail: string | null
          price_list: string | null
          responsible_customer_owner_id: string
          retention_percent: number
          retention_total: number
          return_reason: string | null
          review_started_at: string | null
          seller_id: string
          siigo_invoice_id: string | null
          source_type: Database["public"]["Enums"]["order_source_type"]
          status: Database["public"]["Enums"]["order_status"]
          submitted_at: string | null
          subtotal_gross: number
          subtotal_net: number
          tax_total: number
          updated_at: string
          warehouse_reviewed_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_order: {
        Args: { p_order_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          channel: string | null
          created_at: string
          customer_id: string
          delivered_at: string | null
          discount_total: number
          dispatched_at: string | null
          dispatched_by: string | null
          document_type: string | null
          ghl_opportunity_id: string | null
          grand_total: number
          id: string
          invoice_number: string | null
          invoiced_at: string | null
          invoiced_by: string | null
          invoicing_started_at: string | null
          notes: string | null
          order_number: string
          payment_method: string | null
          payment_method_detail: string | null
          price_list: string | null
          responsible_customer_owner_id: string
          retention_percent: number
          retention_total: number
          return_reason: string | null
          review_started_at: string | null
          seller_id: string
          siigo_invoice_id: string | null
          source_type: Database["public"]["Enums"]["order_source_type"]
          status: Database["public"]["Enums"]["order_status"]
          submitted_at: string | null
          subtotal_gross: number
          subtotal_net: number
          tax_total: number
          updated_at: string
          warehouse_reviewed_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      activity_type:
        | "CALL"
        | "WHATSAPP"
        | "EMAIL"
        | "VISIT"
        | "NOTE"
        | "QUOTE_CREATED"
        | "QUOTE_SENT"
        | "QUOTE_WON"
        | "QUOTE_LOST"
        | "ORDER_CREATED"
        | "ORDER_UPDATED"
        | "INVOICE_CREATED"
        | "SHIPMENT"
        | "FOLLOW_UP"
        | "OTHER"
      assignment_type: "PRIMARY_OWNER" | "TEMPORARY_SUPPORT"
      customer_status:
        | "PROSPECT"
        | "ACTIVE"
        | "INACTIVE"
        | "RECOVERY"
        | "BLOCKED"
      follow_up_status: "PENDING" | "COMPLETED" | "OVERDUE" | "CANCELLED"
      integration_system: "SIIGO" | "GHL"
      invoice_status:
        | "PENDING"
        | "PROCESSING"
        | "ISSUED"
        | "UNCERTAIN"
        | "ERROR_RETRYABLE"
        | "ERROR_FINAL"
      order_review_status: "PENDING" | "APPROVED" | "RETURNED"
      order_source_type: "LIVE" | "HISTORICAL" | "IMPORTED"
      order_status:
        | "DRAFT"
        | "SUBMITTED"
        | "PENDING_REVIEW"
        | "IN_REVIEW"
        | "RETURNED_TO_SELLER"
        | "APPROVED_FOR_INVOICE"
        | "INVOICING"
        | "INVOICED"
        | "READY_FOR_DISPATCH"
        | "DISPATCHED"
        | "DELIVERED"
        | "CANCELLED"
        | "BLOCKED"
      prospect_stage:
        | "NEW"
        | "CONTACTED"
        | "INTERESTED"
        | "QUOTE"
        | "NEGOTIATION"
        | "WON"
        | "LOST"
      quote_status:
        | "DRAFT"
        | "SENT"
        | "FOLLOW_UP"
        | "ACCEPTED"
        | "CONVERTED"
        | "LOST"
        | "EXPIRED"
        | "CANCELLED"
      shipment_status: "PENDING" | "DISPATCHED" | "DELIVERED" | "CANCELLED"
      sync_job_status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED"
      user_role: "SELLER" | "WAREHOUSE" | "SUPERVISOR" | "ADMIN"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      activity_type: [
        "CALL",
        "WHATSAPP",
        "EMAIL",
        "VISIT",
        "NOTE",
        "QUOTE_CREATED",
        "QUOTE_SENT",
        "QUOTE_WON",
        "QUOTE_LOST",
        "ORDER_CREATED",
        "ORDER_UPDATED",
        "INVOICE_CREATED",
        "SHIPMENT",
        "FOLLOW_UP",
        "OTHER",
      ],
      assignment_type: ["PRIMARY_OWNER", "TEMPORARY_SUPPORT"],
      customer_status: [
        "PROSPECT",
        "ACTIVE",
        "INACTIVE",
        "RECOVERY",
        "BLOCKED",
      ],
      follow_up_status: ["PENDING", "COMPLETED", "OVERDUE", "CANCELLED"],
      integration_system: ["SIIGO", "GHL"],
      invoice_status: [
        "PENDING",
        "PROCESSING",
        "ISSUED",
        "UNCERTAIN",
        "ERROR_RETRYABLE",
        "ERROR_FINAL",
      ],
      order_review_status: ["PENDING", "APPROVED", "RETURNED"],
      order_source_type: ["LIVE", "HISTORICAL", "IMPORTED"],
      order_status: [
        "DRAFT",
        "SUBMITTED",
        "PENDING_REVIEW",
        "IN_REVIEW",
        "RETURNED_TO_SELLER",
        "APPROVED_FOR_INVOICE",
        "INVOICING",
        "INVOICED",
        "READY_FOR_DISPATCH",
        "DISPATCHED",
        "DELIVERED",
        "CANCELLED",
        "BLOCKED",
      ],
      prospect_stage: [
        "NEW",
        "CONTACTED",
        "INTERESTED",
        "QUOTE",
        "NEGOTIATION",
        "WON",
        "LOST",
      ],
      quote_status: [
        "DRAFT",
        "SENT",
        "FOLLOW_UP",
        "ACCEPTED",
        "CONVERTED",
        "LOST",
        "EXPIRED",
        "CANCELLED",
      ],
      shipment_status: ["PENDING", "DISPATCHED", "DELIVERED", "CANCELLED"],
      sync_job_status: ["PENDING", "RUNNING", "COMPLETED", "FAILED"],
      user_role: ["SELLER", "WAREHOUSE", "SUPERVISOR", "ADMIN"],
    },
  },
} as const

export type Database = {
  public: {
    Tables: {
      appointment_slots: {
        Row: {
          id: string;
          starts_at: string;
          deleted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          starts_at: string;
          deleted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          starts_at?: string;
          deleted_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      appointment_bookings: {
        Row: {
          id: string;
          slot_id: string;
          lead_id: string;
          status: "booked" | "cancelled";
          booked_at: string;
          cancelled_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slot_id: string;
          lead_id: string;
          status?: "booked" | "cancelled";
          booked_at?: string;
          cancelled_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          slot_id?: string;
          lead_id?: string;
          status?: "booked" | "cancelled";
          booked_at?: string;
          cancelled_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointment_bookings_slot_id_fkey";
            columns: ["slot_id"];
            isOneToOne: false;
            referencedRelation: "appointment_slots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointment_bookings_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: true;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      folders: {
        Row: {
          id: string;
          name: string;
          locked: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          locked?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          locked?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          folder_id: string;
          unread: boolean;
          replied_at: string | null;
          created_at: string;
          source: string;
          name: string;
          company: string;
          email: string;
          phone: string | null;
          selected_package: string;
          message: string;
        };
        Insert: {
          id?: string;
          folder_id?: string;
          unread?: boolean;
          replied_at?: string | null;
          created_at?: string;
          source?: string;
          name: string;
          company: string;
          email: string;
          phone?: string | null;
          selected_package?: string;
          message?: string;
        };
        Update: {
          id?: string;
          folder_id?: string;
          unread?: boolean;
          replied_at?: string | null;
          created_at?: string;
          source?: string;
          name?: string;
          company?: string;
          email?: string;
          phone?: string | null;
          selected_package?: string;
          message?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leads_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_mail_events: {
        Row: {
          id: string;
          lead_id: string;
          kind: "owner_notification" | "customer_confirmation";
          status: "pending" | "processing" | "sent" | "failed";
          attempts: number;
          next_attempt_at: string | null;
          locked_at: string | null;
          rfc_message_id: string;
          provider_message_id: string | null;
          provider_thread_id: string | null;
          reply_message_id: string | null;
          reply_synced_at: string | null;
          sent_at: string | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          kind: "owner_notification" | "customer_confirmation";
          status?: "pending" | "processing" | "sent" | "failed";
          attempts?: number;
          next_attempt_at?: string | null;
          locked_at?: string | null;
          rfc_message_id: string;
          provider_message_id?: string | null;
          provider_thread_id?: string | null;
          reply_message_id?: string | null;
          reply_synced_at?: string | null;
          sent_at?: string | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string;
          kind?: "owner_notification" | "customer_confirmation";
          status?: "pending" | "processing" | "sent" | "failed";
          attempts?: number;
          next_attempt_at?: string | null;
          locked_at?: string | null;
          rfc_message_id?: string;
          provider_message_id?: string | null;
          provider_thread_id?: string | null;
          reply_message_id?: string | null;
          reply_synced_at?: string | null;
          sent_at?: string | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_mail_events_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_submission_limits: {
        Row: {
          ip_hash: string;
          window_started_at: string;
          attempts: number;
          updated_at: string;
        };
        Insert: {
          ip_hash: string;
          window_started_at?: string;
          attempts?: number;
          updated_at?: string;
        };
        Update: {
          ip_hash?: string;
          window_started_at?: string;
          attempts?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      gmail_sync_state: {
        Row: {
          singleton: boolean;
          history_id: string | null;
          updated_at: string;
        };
        Insert: {
          singleton?: boolean;
          history_id?: string | null;
          updated_at?: string;
        };
        Update: {
          singleton?: boolean;
          history_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_website_lead: {
        Args: {
          p_name: string;
          p_company: string;
          p_email: string;
          p_message: string;
        };
        Returns: string;
      };
      create_appointment_lead: {
        Args: {
          p_slot_id: string;
          p_name: string;
          p_company: string;
          p_email: string;
          p_phone: string;
          p_message: string;
        };
        Returns: string;
      };
      list_available_appointment_slots: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          starts_at: string;
        }[];
      };
      record_lead_submission_attempt: {
        Args: {
          p_ip_hash: string;
          p_limit?: number;
          p_window?: string;
        };
        Returns: boolean;
      };
      claim_due_lead_mail_events: {
        Args: {
          p_limit?: number;
        };
        Returns: Database["public"]["Tables"]["lead_mail_events"]["Row"][];
      };
      retry_lead_mail: {
        Args: {
          p_lead_id: string;
        };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

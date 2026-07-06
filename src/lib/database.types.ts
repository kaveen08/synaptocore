export type Database = {
  public: {
    Tables: {
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

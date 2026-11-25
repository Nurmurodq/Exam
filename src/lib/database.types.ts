export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      conversation_members: {
        Row: {
          conversation_id: string;
          id: string;
          joined_at: string;
          last_read_at: string;
          role: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          conversation_id: string;
          id?: string;
          joined_at?: string;
          last_read_at?: string;
          role?: string;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          id?: string;
          joined_at?: string;
          last_read_at?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          avatar_path: string | null;
          created_at: string;
          created_by: string | null;
          direct_key: string | null;
          id: string;
          last_message_at: string;
          title: string | null;
          type: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_path?: string | null;
          created_at?: string;
          created_by?: string | null;
          direct_key?: string | null;
          id?: string;
          last_message_at?: string;
          title?: string | null;
          type: string;
        };
        Update: {
          avatar_path?: string | null;
          created_at?: string;
          created_by?: string | null;
          direct_key?: string | null;
          id?: string;
          last_message_at?: string;
          title?: string | null;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          attachment_mime: string | null;
          attachment_name: string | null;
          attachment_path: string | null;
          attachment_size: number | null;
          body: string | null;
          conversation_id: string;
          created_at: string;
          deleted_at: string | null;
          edited_at: string | null;
          id: string;
          reply_to_id: string | null;
          sender_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          attachment_mime?: string | null;
          attachment_name?: string | null;
          attachment_path?: string | null;
          attachment_size?: number | null;
          body?: string | null;
          conversation_id: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          id?: string;
          reply_to_id?: string | null;
          sender_id?: string | null;
        };
        Update: {
          attachment_mime?: string | null;
          attachment_name?: string | null;
          attachment_path?: string | null;
          attachment_size?: number | null;
          body?: string | null;
          conversation_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          id?: string;
          reply_to_id?: string | null;
          sender_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey";
            columns: ["reply_to_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          about: string;
          avatar_path: string | null;
          created_at: string;
          display_name: string;
          id: string;
          last_seen_at: string;
          phone: string | null;
        };
        ComputedFields: never;
        Insert: {
          about?: string;
          avatar_path?: string | null;
          created_at?: string;
          display_name?: string;
          id: string;
          last_seen_at?: string;
          phone?: string | null;
        };
        Update: {
          about?: string;
          avatar_path?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          last_seen_at?: string;
          phone?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      add_group_members: {
        Args: { p_conversation_id: string; p_member_ids: string[] };
        Returns: number;
      };
      conversation_role: { Args: { p_conversation_id: string }; Returns: string };
      create_direct_conversation: { Args: { p_user_id: string }; Returns: string };
      create_group_conversation: {
        Args: { p_member_ids: string[]; p_title: string };
        Returns: string;
      };
      find_user_by_phone: {
        Args: { p_phone: string };
        Returns: {
          about: string;
          avatar_path: string;
          display_name: string;
          id: string;
          phone: string;
        }[];
      };
      get_my_conversations: {
        Args: Record<PropertyKey, never>;
        Returns: {
          avatar_path: string;
          created_at: string;
          id: string;
          last_message: Json;
          last_message_at: string;
          last_read_at: string;
          member_count: number;
          my_role: string;
          peer: Json;
          title: string;
          type: string;
          unread_count: number;
        }[];
      };
      is_conversation_member: { Args: { p_conversation_id: string }; Returns: boolean };
      is_conversation_member_text: { Args: { p_conversation_id: string }; Returns: boolean };
      mark_conversation_read: { Args: { p_conversation_id: string }; Returns: undefined };
      remove_group_member: {
        Args: { p_conversation_id: string; p_user_id: string };
        Returns: undefined;
      };
      set_member_role: {
        Args: { p_conversation_id: string; p_role: string; p_user_id: string };
        Returns: undefined;
      };
      shares_conversation_with: { Args: { p_user_id: string }; Returns: boolean };
      touch_last_seen: { Args: Record<PropertyKey, never>; Returns: undefined };
      update_group: {
        Args: {
          p_avatar_path?: string;
          p_clear_avatar?: boolean;
          p_conversation_id: string;
          p_title?: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;

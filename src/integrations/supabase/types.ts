export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      profile_weapons: {
        Row: {
          acquired_at: string;
          user_id: string;
          weapon_id: string;
        };
        Insert: {
          acquired_at?: string;
          user_id: string;
          weapon_id: string;
        };
        Update: {
          acquired_at?: string;
          user_id?: string;
          weapon_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_weapons_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_cosmetics: {
        Row: {
          acquired_at: string;
          cosmetic_id: string;
          user_id: string;
        };
        Insert: {
          acquired_at?: string;
          cosmetic_id: string;
          user_id: string;
        };
        Update: {
          acquired_at?: string;
          cosmetic_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_cosmetics_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_weapon_skins: {
        Row: {
          acquired_at: string;
          skin_id: string;
          user_id: string;
        };
        Insert: {
          acquired_at?: string;
          skin_id: string;
          user_id: string;
        };
        Update: {
          acquired_at?: string;
          skin_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_weapon_skins_skin_id_fkey";
            columns: ["skin_id"];
            isOneToOne: false;
            referencedRelation: "weapon_skin_catalog";
            referencedColumns: ["skin_id"];
          },
          {
            foreignKeyName: "profile_weapon_skins_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      weapon_skin_catalog: {
        Row: {
          color: string;
          display_name: string;
          rarity: string;
          skin_id: string;
        };
        Insert: {
          color: string;
          display_name: string;
          rarity: string;
          skin_id: string;
        };
        Update: {
          color?: string;
          display_name?: string;
          rarity?: string;
          skin_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          credits: number;
          deaths: number;
          avatar_customization_unlocked: boolean;
          avatar_hair_color: string;
          avatar_skin_tone: string;
          avatar_body_color: string;
          avatar_feet_color: string;
          avatar_boots_color: string;
          avatar_accessories_color: string;
          avatar_mask_color: string;
          avatar_hat_color: string;
          avatar_dress_color: string;
          display_name: string;
          dungeons_completed: number;
          enemies_killed: number;
          equipped_boots: string | null;
          equipped_hat: string | null;
          equipped_pants: string | null;
          equipped_shirt: string | null;
          equipped_weapon: string;
          equipped_weapon_skin: string | null;
          experience: number;
          id: string;
          level: number;
          play_seconds: number;
        };
        Insert: {
          created_at?: string;
          credits?: number;
          deaths?: number;
          avatar_customization_unlocked?: boolean;
          avatar_hair_color?: string;
          avatar_skin_tone?: string;
          avatar_body_color?: string;
          avatar_feet_color?: string;
          avatar_boots_color?: string;
          avatar_accessories_color?: string;
          avatar_mask_color?: string;
          avatar_hat_color?: string;
          avatar_dress_color?: string;
          display_name?: string;
          dungeons_completed?: number;
          enemies_killed?: number;
          equipped_boots?: string | null;
          equipped_hat?: string | null;
          equipped_pants?: string | null;
          equipped_shirt?: string | null;
          equipped_weapon?: string;
          equipped_weapon_skin?: string | null;
          experience?: number;
          id: string;
          level?: number;
          play_seconds?: number;
        };
        Update: {
          created_at?: string;
          credits?: number;
          deaths?: number;
          avatar_customization_unlocked?: boolean;
          avatar_hair_color?: string;
          avatar_skin_tone?: string;
          avatar_body_color?: string;
          avatar_feet_color?: string;
          avatar_boots_color?: string;
          avatar_accessories_color?: string;
          avatar_mask_color?: string;
          avatar_hat_color?: string;
          avatar_dress_color?: string;
          display_name?: string;
          dungeons_completed?: number;
          enemies_killed?: number;
          equipped_boots?: string | null;
          equipped_hat?: string | null;
          equipped_pants?: string | null;
          equipped_shirt?: string | null;
          equipped_weapon?: string;
          equipped_weapon_skin?: string | null;
          experience?: number;
          id?: string;
          level?: number;
          play_seconds?: number;
        };
        Relationships: [];
      };
      runs: {
        Row: {
          created_at: string;
          credits_earned: number;
          completed_at: string | null;
          difficulty: string;
          id: string;
          map: string;
          mode: string;
          user_id: string;
          waves_cleared: number;
        };
        Insert: {
          created_at?: string;
          credits_earned?: number;
          completed_at?: string | null;
          difficulty: string;
          id?: string;
          map: string;
          mode?: string;
          user_id: string;
          waves_cleared?: number;
        };
        Update: {
          created_at?: string;
          credits_earned?: number;
          completed_at?: string | null;
          difficulty?: string;
          id?: string;
          map?: string;
          mode?: string;
          user_id?: string;
          waves_cleared?: number;
        };
        Relationships: [
          {
            foreignKeyName: "runs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      save_avatar_customization: {
        Args: {
          colors: Json;
        };
        Returns: Json;
      };
      import_guest_weapon_skins: {
        Args: {
          equipped_skin: string | null;
          skin_ids: string[];
        };
        Returns: string[];
      };
      open_weapon_crate: {
        Args: {
          crate_rarity: string;
        };
        Returns: {
          credits: number;
          refunded: boolean;
          skin_id: string | null;
        }[];
      };
      spin_credit_lottery: {
        Args: Record<PropertyKey, never>;
        Returns: {
          credits: number;
          prize: number;
        }[];
      };
      unlock_avatar_customization: {
        Args: Record<PropertyKey, never>;
        Returns: {
          credits: number;
          unlocked: boolean;
        }[];
      };
      spend_player_credits: {
        Args: {
          credit_amount: number;
        };
        Returns: number;
      };
      record_player_session: {
        Args: {
          death_count: number;
          kill_count: number;
          played_seconds: number;
        };
        Returns: {
          deaths: number;
          enemies_killed: number;
          play_seconds: number;
        }[];
      };
      search_player_directory: {
        Args: {
          search_term: string;
        };
        Returns: {
          deaths: number;
          display_name: string;
          dungeons_completed: number;
          enemies_killed: number;
          experience: number;
          hours_played: number;
          level: number;
        }[];
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
  DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;

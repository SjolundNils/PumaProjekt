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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_events: {
        Row: {
          actor_id: string | null
          audience: Database["public"]["Enums"]["activity_audience"]
          created_at: string | null
          daily_song_id: number | null
          delivery: Database["public"]["Enums"]["activity_delivery"]
          friendship_id: number | null
          group_id: string | null
          id: number
          metadata: Json
          read_at: string | null
          recipient_id: string | null
          type: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          actor_id?: string | null
          audience: Database["public"]["Enums"]["activity_audience"]
          created_at?: string | null
          daily_song_id?: number | null
          delivery?: Database["public"]["Enums"]["activity_delivery"]
          friendship_id?: number | null
          group_id?: string | null
          id?: number
          metadata?: Json
          read_at?: string | null
          recipient_id?: string | null
          type: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          actor_id?: string | null
          audience?: Database["public"]["Enums"]["activity_audience"]
          created_at?: string | null
          daily_song_id?: number | null
          delivery?: Database["public"]["Enums"]["activity_delivery"]
          friendship_id?: number | null
          group_id?: string | null
          id?: number
          metadata?: Json
          read_at?: string | null
          recipient_id?: string | null
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_daily_song_id_fkey"
            columns: ["daily_song_id"]
            isOneToOne: false
            referencedRelation: "daily_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_friendship_id_fkey"
            columns: ["friendship_id"]
            isOneToOne: false
            referencedRelation: "friendships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_songs: {
        Row: {
          artist_name: string
          chosen_at: string | null
          id: number
          image_url: string | null
          song_date: string
          spotify_track_id: string
          track_name: string
          user_id: string
        }
        Insert: {
          artist_name: string
          chosen_at?: string | null
          id?: number
          image_url?: string | null
          song_date?: string
          spotify_track_id: string
          track_name: string
          user_id: string
        }
        Update: {
          artist_name?: string
          chosen_at?: string | null
          id?: number
          image_url?: string | null
          song_date?: string
          spotify_track_id?: string
          track_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_songs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_albums: {
        Row: {
          album_name: string
          artist_name: string
          image_url: string | null
          position: number
          spotify_album_id: string
          user_id: string
        }
        Insert: {
          album_name: string
          artist_name: string
          image_url?: string | null
          position: number
          spotify_album_id: string
          user_id: string
        }
        Update: {
          album_name?: string
          artist_name?: string
          image_url?: string | null
          position?: number
          spotify_album_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorite_albums_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          accepted_at: string | null
          addressee_id: string
          created_at: string
          id: number
          requester_id: string
          status: Database["public"]["Enums"]["friend_status"]
        }
        Insert: {
          accepted_at?: string | null
          addressee_id: string
          created_at?: string
          id?: number
          requester_id: string
          status?: Database["public"]["Enums"]["friend_status"]
        }
        Update: {
          accepted_at?: string | null
          addressee_id?: string
          created_at?: string
          id?: number
          requester_id?: string
          status?: Database["public"]["Enums"]["friend_status"]
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_invites: {
        Row: {
          created_at: string
          group_id: string
          id: string
          invited_by: string
          invited_user_id: string
          status: Database["public"]["Enums"]["invite_status"]
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          invited_by: string
          invited_user_id: string
          status?: Database["public"]["Enums"]["invite_status"]
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          invited_by?: string
          invited_user_id?: string
          status?: Database["public"]["Enums"]["invite_status"]
        }
        Relationships: [
          {
            foreignKeyName: "group_invites_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invites_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          invited_by: string | null
          joined_at: string | null
          role: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Insert: {
          group_id?: string
          invited_by?: string | null
          joined_at?: string | null
          role?: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Update: {
          group_id?: string
          invited_by?: string | null
          joined_at?: string | null
          role?: Database["public"]["Enums"]["group_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          name: string
          owner_id: string
          spotify_playlist_id: string | null
        }
        Insert: {
          created_at?: string
          id: string
          invite_code?: string
          name: string
          owner_id: string
          spotify_playlist_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
          owner_id?: string
          spotify_playlist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          biography: string | null
          created_at: string | null
          display_name: string | null
          id: string
          spotify_connected: boolean | null
          spotify_user_id: string
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          biography?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          spotify_connected?: boolean | null
          spotify_user_id: string
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          biography?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          spotify_connected?: boolean | null
          spotify_user_id?: string
        }
        Relationships: []
      }
      song_ratings: {
        Row: {
          created_at: string | null
          daily_song_id: number
          id: number
          rating: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          daily_song_id: number
          id?: number
          rating: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          daily_song_id?: number
          id?: number
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "song_ratings_daily_song_id_fkey"
            columns: ["daily_song_id"]
            isOneToOne: false
            referencedRelation: "daily_songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "song_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spotify_tokens: {
        Row: {
          access_token: string
          expires_at: string
          refresh_token: string
          user_id: string
        }
        Insert: {
          access_token: string
          expires_at: string
          refresh_token: string
          user_id: string
        }
        Update: {
          access_token?: string
          expires_at?: string
          refresh_token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spotify_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      app_today: { Args: never; Returns: string }
    }
    Enums: {
      activity_audience: "recipient" | "friends" | "group"
      activity_delivery: "feed" | "push" | "both"
      activity_type:
        | "song_chosen"
        | "song_rated"
        | "group_all_rated"
        | "song_match"
        | "favorite_album_changed"
        | "friend_request_received"
        | "friend_request_accepted"
        | "group_invite_received"
        | "member_joined_group"
        | "joined_via_your_link"
        | "group_playlist_complete"
        | "group_top_song_today"
        | "group_weekly_top_song"
        | "streak_milestone"
        | "daily_reminder"
      friend_status: "pending" | "accepted"
      group_role: "owner" | "member"
      invite_status: "pending" | "accepted" | "declined"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      activity_audience: ["recipient", "friends", "group"],
      activity_delivery: ["feed", "push", "both"],
      activity_type: [
        "song_chosen",
        "song_rated",
        "group_all_rated",
        "song_match",
        "favorite_album_changed",
        "friend_request_received",
        "friend_request_accepted",
        "group_invite_received",
        "member_joined_group",
        "joined_via_your_link",
        "group_playlist_complete",
        "group_top_song_today",
        "group_weekly_top_song",
        "streak_milestone",
        "daily_reminder",
      ],
      friend_status: ["pending", "accepted"],
      group_role: ["owner", "member"],
      invite_status: ["pending", "accepted", "declined"],
    },
  },
} as const

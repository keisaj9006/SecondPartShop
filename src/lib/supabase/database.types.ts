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
      categories: {
        Row: {
          id: string
          is_selectable: boolean
          is_transmission_related: boolean
          name: string
          parent_id: string | null
          search_terms: string[]
          slug: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_selectable?: boolean
          is_transmission_related?: boolean
          name: string
          parent_id?: string | null
          search_terms?: string[]
          slug: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_selectable?: boolean
          is_transmission_related?: boolean
          name?: string
          parent_id?: string | null
          search_terms?: string[]
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_vehicles: {
        Row: {
          catalogue_variant_id: string
          created_at: string
          engine_size_simple: number | null
          fuel_type: string | null
          id: string
          nickname: string | null
          profile_id: string
          registration: string | null
          updated_at: string
          year: number
        }
        Insert: {
          catalogue_variant_id: string
          created_at?: string
          engine_size_simple?: number | null
          fuel_type?: string | null
          id?: string
          nickname?: string | null
          profile_id: string
          registration?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          catalogue_variant_id?: string
          created_at?: string
          engine_size_simple?: number | null
          fuel_type?: string | null
          id?: string
          nickname?: string | null
          profile_id?: string
          registration?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "garage_vehicles_catalogue_variant_id_fkey"
            columns: ["catalogue_variant_id"]
            isOneToOne: false
            referencedRelation: "vehicle_catalogue_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_vehicles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          part_id: string
          quantity: number
          seller_id: string
          unit_price_pence: number
        }
        Insert: {
          id?: string
          order_id: string
          part_id: string
          quantity: number
          seller_id: string
          unit_price_pence: number
        }
        Update: {
          id?: string
          order_id?: string
          part_id?: string
          quantity?: number
          seller_id?: string
          unit_price_pence?: number
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
            foreignKeyName: "order_items_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          status: string
          total_pence: number
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          status?: string
          total_pence: number
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          status?: string
          total_pence?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      part_catalogue_fitments: {
        Row: {
          created_at: string
          engine_size_simple: number | null
          fuel_type: string | null
          id: string
          notes: string | null
          part_id: string
          variant_id: string
          year_from: number | null
          year_to: number | null
        }
        Insert: {
          created_at?: string
          engine_size_simple?: number | null
          fuel_type?: string | null
          id?: string
          notes?: string | null
          part_id: string
          variant_id: string
          year_from?: number | null
          year_to?: number | null
        }
        Update: {
          created_at?: string
          engine_size_simple?: number | null
          fuel_type?: string | null
          id?: string
          notes?: string | null
          part_id?: string
          variant_id?: string
          year_from?: number | null
          year_to?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "part_catalogue_fitments_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_catalogue_fitments_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "vehicle_catalogue_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      part_fitments: {
        Row: {
          notes: string | null
          part_id: string
          transmission_id: string | null
          vehicle_id: string
        }
        Insert: {
          notes?: string | null
          part_id: string
          transmission_id?: string | null
          vehicle_id: string
        }
        Update: {
          notes?: string | null
          part_id?: string
          transmission_id?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "part_fitments_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_fitments_transmission_id_fkey"
            columns: ["transmission_id"]
            isOneToOne: false
            referencedRelation: "vehicle_transmissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_fitments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      part_images: {
        Row: {
          alt_text: string
          created_at: string
          id: string
          part_id: string
          position: number
          storage_path: string
        }
        Insert: {
          alt_text: string
          created_at?: string
          id?: string
          part_id: string
          position?: number
          storage_path: string
        }
        Update: {
          alt_text?: string
          created_at?: string
          id?: string
          part_id?: string
          position?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "part_images_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      parts: {
        Row: {
          category_id: string
          condition: Database["public"]["Enums"]["part_condition"]
          condition_notes: string | null
          created_at: string
          damage_notes: string | null
          description: string
          dispatch_days: number
          gearbox_code: string | null
          gearbox_family: string | null
          id: string
          manufacturer: string | null
          oem_number: string | null
          part_number: string | null
          price_pence: number
          seller_id: string
          slug: string
          status: Database["public"]["Enums"]["listing_status"]
          stock: number
          testing_status: string
          title: string
          updated_at: string
          warranty_days: number
        }
        Insert: {
          category_id: string
          condition: Database["public"]["Enums"]["part_condition"]
          condition_notes?: string | null
          created_at?: string
          damage_notes?: string | null
          description: string
          dispatch_days?: number
          gearbox_code?: string | null
          gearbox_family?: string | null
          id?: string
          manufacturer?: string | null
          oem_number?: string | null
          part_number?: string | null
          price_pence: number
          seller_id: string
          slug: string
          status?: Database["public"]["Enums"]["listing_status"]
          stock?: number
          testing_status?: string
          title: string
          updated_at?: string
          warranty_days?: number
        }
        Update: {
          category_id?: string
          condition?: Database["public"]["Enums"]["part_condition"]
          condition_notes?: string | null
          created_at?: string
          damage_notes?: string | null
          description?: string
          dispatch_days?: number
          gearbox_code?: string | null
          gearbox_family?: string | null
          id?: string
          manufacturer?: string | null
          oem_number?: string | null
          part_number?: string | null
          price_pence?: number
          seller_id?: string
          slug?: string
          status?: Database["public"]["Enums"]["listing_status"]
          stock?: number
          testing_status?: string
          title?: string
          updated_at?: string
          warranty_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "parts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      saved_parts: {
        Row: {
          created_at: string
          part_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          part_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          part_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_parts_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_parts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          business_name: string
          created_at: string
          description: string
          id: string
          location: string
          owner_id: string | null
          postcode: string | null
          slug: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          business_name: string
          created_at?: string
          description?: string
          id?: string
          location: string
          owner_id?: string | null
          postcode?: string | null
          slug: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          business_name?: string
          created_at?: string
          description?: string
          id?: string
          location?: string
          owner_id?: string | null
          postcode?: string | null
          slug?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sellers_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_catalogue_engines: {
        Row: {
          engine_size_desc: string | null
          engine_size_simple: number | null
          fuel_type: string
          id: string
          source_reference: string
          variant_id: string
        }
        Insert: {
          engine_size_desc?: string | null
          engine_size_simple?: number | null
          fuel_type: string
          id?: string
          source_reference: string
          variant_id: string
        }
        Update: {
          engine_size_desc?: string | null
          engine_size_simple?: number | null
          fuel_type?: string
          id?: string
          source_reference?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_catalogue_engines_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "vehicle_catalogue_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_catalogue_imports: {
        Row: {
          dataset: string
          id: string
          imported_at: string
          imported_rows: number | null
          notes: string | null
          provider: string
          source_published_at: string | null
          source_url: string
        }
        Insert: {
          dataset: string
          id?: string
          imported_at?: string
          imported_rows?: number | null
          notes?: string | null
          provider: string
          source_published_at?: string | null
          source_url: string
        }
        Update: {
          dataset?: string
          id?: string
          imported_at?: string
          imported_rows?: number | null
          notes?: string | null
          provider?: string
          source_published_at?: string | null
          source_url?: string
        }
        Relationships: []
      }
      vehicle_catalogue_make_aliases: {
        Row: {
          canonical_make: string
          created_at: string
          display_name: string
          provider: string
          source_make: string
        }
        Insert: {
          canonical_make: string
          created_at?: string
          display_name: string
          provider: string
          source_make: string
        }
        Update: {
          canonical_make?: string
          created_at?: string
          display_name?: string
          provider?: string
          source_make?: string
        }
        Relationships: []
      }
      vehicle_catalogue_variants: {
        Row: {
          body_type: string | null
          created_at: string
          data_status: Database["public"]["Enums"]["vehicle_data_status"]
          id: string
          make: string
          model_family: string
          provider: string
          provider_key: string
          source_reference: string
          source_updated_at: string | null
          updated_at: string
          variant: string
        }
        Insert: {
          body_type?: string | null
          created_at?: string
          data_status?: Database["public"]["Enums"]["vehicle_data_status"]
          id?: string
          make: string
          model_family: string
          provider: string
          provider_key: string
          source_reference: string
          source_updated_at?: string | null
          updated_at?: string
          variant: string
        }
        Update: {
          body_type?: string | null
          created_at?: string
          data_status?: Database["public"]["Enums"]["vehicle_data_status"]
          id?: string
          make?: string
          model_family?: string
          provider?: string
          provider_key?: string
          source_reference?: string
          source_updated_at?: string | null
          updated_at?: string
          variant?: string
        }
        Relationships: []
      }
      vehicle_catalogue_years: {
        Row: {
          source_reference: string
          variant_id: string
          year_first_used: number
        }
        Insert: {
          source_reference: string
          variant_id: string
          year_first_used: number
        }
        Update: {
          source_reference?: string
          variant_id?: string
          year_first_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_catalogue_years_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "vehicle_catalogue_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_transmissions: {
        Row: {
          code: string
          created_at: string
          data_status: Database["public"]["Enums"]["vehicle_data_status"]
          family: string
          id: string
          source_reference: string | null
          transmission_type: string | null
          vehicle_id: string
        }
        Insert: {
          code: string
          created_at?: string
          data_status?: Database["public"]["Enums"]["vehicle_data_status"]
          family: string
          id?: string
          source_reference?: string | null
          transmission_type?: string | null
          vehicle_id: string
        }
        Update: {
          code?: string
          created_at?: string
          data_status?: Database["public"]["Enums"]["vehicle_data_status"]
          family?: string
          id?: string
          source_reference?: string | null
          transmission_type?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_transmissions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          data_status: Database["public"]["Enums"]["vehicle_data_status"]
          engine: string
          engine_code: string | null
          fuel_type: string | null
          gearbox_code: string | null
          gearbox_family: string | null
          generation: string
          id: string
          make: string
          model: string
          source_reference: string | null
          year: number
        }
        Insert: {
          data_status?: Database["public"]["Enums"]["vehicle_data_status"]
          engine: string
          engine_code?: string | null
          fuel_type?: string | null
          gearbox_code?: string | null
          gearbox_family?: string | null
          generation: string
          id?: string
          make: string
          model: string
          source_reference?: string | null
          year: number
        }
        Update: {
          data_status?: Database["public"]["Enums"]["vehicle_data_status"]
          engine?: string
          engine_code?: string | null
          fuel_type?: string | null
          gearbox_code?: string | null
          gearbox_family?: string | null
          generation?: string
          id?: string
          make?: string
          model?: string
          source_reference?: string | null
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      category_descendant_ids: {
        Args: { p_category_id: string }
        Returns: {
          id: string
        }[]
      }
      import_vehicle_catalogue_batch: {
        Args: {
          p_engines?: Json
          p_provider: string
          p_variants?: Json
          p_years?: Json
        }
        Returns: Json
      }
      marketplace_catalogue_compatibility: {
        Args: {
          p_engine?: number
          p_fuel?: string
          p_part_id?: string
          p_variant_id: string
          p_year: number
        }
        Returns: {
          confidence: string
          part_id: string
        }[]
      }
      marketplace_legacy_vehicle_compatibility: {
        Args: { p_part_id?: string; p_vehicle_id: string }
        Returns: {
          confidence: string
          part_id: string
        }[]
      }
      marketplace_search_part_ids: {
        Args: { p_query: string }
        Returns: {
          part_id: string
        }[]
      }
      vehicle_catalogue_makes: {
        Args: never
        Returns: {
          make: string
        }[]
      }
      vehicle_catalogue_model_map: {
        Args: never
        Returns: {
          make: string
          model_family: string
        }[]
      }
      vehicle_catalogue_model_map_json: { Args: never; Returns: Json }
      vehicle_catalogue_models: {
        Args: { p_make: string }
        Returns: {
          model_family: string
        }[]
      }
      vehicle_catalogue_variants_for_model_year: {
        Args: { p_make: string; p_model: string; p_year: number }
        Returns: {
          id: string
          variant: string
        }[]
      }
      vehicle_catalogue_years_for_model: {
        Args: { p_make: string; p_model: string }
        Returns: {
          year_first_used: number
        }[]
      }
    }
    Enums: {
      listing_status: "draft" | "active" | "reserved" | "sold" | "archived"
      part_condition: "new" | "reconditioned" | "used"
      user_role: "buyer" | "seller" | "admin"
      vehicle_data_status: "verified" | "qa_seed" | "external_import"
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
      listing_status: ["draft", "active", "reserved", "sold", "archived"],
      part_condition: ["new", "reconditioned", "used"],
      user_role: ["buyer", "seller", "admin"],
      vehicle_data_status: ["verified", "qa_seed", "external_import"],
    },
  },
} as const

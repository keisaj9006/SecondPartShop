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
      account_deletion_requests: {
        Row: {
          id: string
          profile_id: string
          reason: string | null
          requested_at: string
          status: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          reason?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          reason?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_deletion_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      commerce_settings: {
        Row: {
          auto_release_hours: number
          checkout_reservation_minutes: number
          platform_fee_bps: number
          singleton: boolean
          updated_at: string
        }
        Insert: {
          auto_release_hours?: number
          checkout_reservation_minutes?: number
          platform_fee_bps?: number
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          auto_release_hours?: number
          checkout_reservation_minutes?: number
          platform_fee_bps?: number
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      donor_vehicles: {
        Row: {
          colour: string | null
          created_at: string
          engine_size_simple: number | null
          fuel_type: string | null
          id: string
          make: string
          model: string
          notes: string | null
          registration: string | null
          seller_id: string
          updated_at: string
          variant: string | null
          year: number
        }
        Insert: {
          colour?: string | null
          created_at?: string
          engine_size_simple?: number | null
          fuel_type?: string | null
          id?: string
          make: string
          model: string
          notes?: string | null
          registration?: string | null
          seller_id: string
          updated_at?: string
          variant?: string | null
          year: number
        }
        Update: {
          colour?: string | null
          created_at?: string
          engine_size_simple?: number | null
          fuel_type?: string | null
          id?: string
          make?: string
          model?: string
          notes?: string | null
          registration?: string | null
          seller_id?: string
          updated_at?: string
          variant?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "donor_vehicles_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      fitting_request_messages: {
        Row: {
          body: string
          created_at: string
          fitting_request_id: string
          id: string
          sender_profile_id: string
        }
        Insert: {
          body: string
          created_at?: string
          fitting_request_id: string
          id?: string
          sender_profile_id: string
        }
        Update: {
          body?: string
          created_at?: string
          fitting_request_id?: string
          id?: string
          sender_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fitting_request_messages_fitting_request_id_fkey"
            columns: ["fitting_request_id"]
            isOneToOne: false
            referencedRelation: "fitting_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fitting_request_messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fitting_requests: {
        Row: {
          buyer_id: string
          buyer_notes: string | null
          buyer_responded_at: string | null
          completed_at: string | null
          created_at: string
          garage_partner_id: string
          id: string
          order_item_id: string | null
          part_id: string
          quote_note: string | null
          quote_pence: number | null
          quoted_at: string | null
          status: string
          updated_at: string
          vehicle_engine_size: number | null
          vehicle_fuel: string | null
          vehicle_registration: string | null
          vehicle_variant_id: string
          vehicle_year: number
        }
        Insert: {
          buyer_id: string
          buyer_notes?: string | null
          buyer_responded_at?: string | null
          completed_at?: string | null
          created_at?: string
          garage_partner_id: string
          id?: string
          order_item_id?: string | null
          part_id: string
          quote_note?: string | null
          quote_pence?: number | null
          quoted_at?: string | null
          status?: string
          updated_at?: string
          vehicle_engine_size?: number | null
          vehicle_fuel?: string | null
          vehicle_registration?: string | null
          vehicle_variant_id: string
          vehicle_year: number
        }
        Update: {
          buyer_id?: string
          buyer_notes?: string | null
          buyer_responded_at?: string | null
          completed_at?: string | null
          created_at?: string
          garage_partner_id?: string
          id?: string
          order_item_id?: string | null
          part_id?: string
          quote_note?: string | null
          quote_pence?: number | null
          quoted_at?: string | null
          status?: string
          updated_at?: string
          vehicle_engine_size?: number | null
          vehicle_fuel?: string | null
          vehicle_registration?: string | null
          vehicle_variant_id?: string
          vehicle_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "fitting_requests_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fitting_requests_garage_partner_id_fkey"
            columns: ["garage_partner_id"]
            isOneToOne: false
            referencedRelation: "garage_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fitting_requests_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fitting_requests_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fitting_requests_vehicle_variant_id_fkey"
            columns: ["vehicle_variant_id"]
            isOneToOne: false
            referencedRelation: "vehicle_catalogue_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      founding_seller_applications: {
        Row: {
          admin_note: string | null
          business_kind: string
          business_name: string
          contact_name: string
          created_at: string
          email: string
          estimated_active_parts: number | null
          existing_channels: string[]
          id: string
          import_interest: string
          notes: string | null
          phone: string | null
          postcode: string
          source: string
          status: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          admin_note?: string | null
          business_kind: string
          business_name: string
          contact_name: string
          created_at?: string
          email: string
          estimated_active_parts?: number | null
          existing_channels?: string[]
          id?: string
          import_interest?: string
          notes?: string | null
          phone?: string | null
          postcode: string
          source?: string
          status?: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          admin_note?: string | null
          business_kind?: string
          business_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          estimated_active_parts?: number | null
          existing_channels?: string[]
          id?: string
          import_interest?: string
          notes?: string | null
          phone?: string | null
          postcode?: string
          source?: string
          status?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      garage_partners: {
        Row: {
          business_name: string
          created_at: string
          customer_supplied_parts: boolean
          description: string
          id: string
          latitude: number | null
          location: string
          longitude: number | null
          mobile_fitting: boolean
          owner_id: string
          postcode: string
          recycled_parts: boolean
          slug: string
          status: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          business_name: string
          created_at?: string
          customer_supplied_parts?: boolean
          description: string
          id?: string
          latitude?: number | null
          location: string
          longitude?: number | null
          mobile_fitting?: boolean
          owner_id: string
          postcode: string
          recycled_parts?: boolean
          slug: string
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          business_name?: string
          created_at?: string
          customer_supplied_parts?: boolean
          description?: string
          id?: string
          latitude?: number | null
          location?: string
          longitude?: number | null
          mobile_fitting?: boolean
          owner_id?: string
          postcode?: string
          recycled_parts?: boolean
          slug?: string
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garage_partners_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_vehicles: {
        Row: {
          catalogue_variant_id: string
          colour: string | null
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
          colour?: string | null
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
          colour?: string | null
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
      listing_conversation_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_profile_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_profile_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "listing_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_conversation_messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_conversations: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          last_message_at: string
          part_id: string
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          last_message_at?: string
          part_id: string
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          last_message_at?: string
          part_id?: string
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_conversations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_conversations_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_conversations_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          part_id: string | null
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          seller_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          part_id?: string | null
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          seller_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          part_id?: string | null
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          seller_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_reports_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_reports_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_search_synonyms: {
        Row: {
          alias: string
          canonical_query: string
          created_at: string
        }
        Insert: {
          alias: string
          canonical_query: string
          created_at?: string
        }
        Update: {
          alias?: string
          canonical_query?: string
          created_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          dedupe_key: string | null
          href: string | null
          id: string
          profile_id: string
          read_at: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          href?: string | null
          id?: string
          profile_id: string
          read_at?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          href?: string | null
          id?: string
          profile_id?: string
          read_at?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          actor_profile_id: string | null
          created_at: string
          event_type: string
          from_status: string | null
          id: string
          metadata: Json
          order_id: string
          order_item_id: string | null
          to_status: string | null
        }
        Insert: {
          actor_profile_id?: string | null
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: string
          metadata?: Json
          order_id: string
          order_item_id?: string | null
          to_status?: string | null
        }
        Update: {
          actor_profile_id?: string | null
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          order_id?: string
          order_item_id?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          accepted_at: string | null
          buyer_received_at: string | null
          buyer_vehicle_engine_size: number | null
          buyer_vehicle_fuel: string | null
          buyer_vehicle_registration: string | null
          buyer_vehicle_variant_id: string | null
          buyer_vehicle_year: number | null
          cancelled_at: string | null
          delivered_at: string | null
          delivery_method: string
          dispatched_at: string | null
          dispute_opened_at: string | null
          fulfilment_status: string
          funds_released_at: string | null
          id: string
          order_id: string
          part_id: string
          payout_rollback_required: boolean
          payout_status: string
          platform_fee_pence: number
          provider_transfer_id: string | null
          provider_transfer_reversal_id: string | null
          quantity: number
          refunded_at: string | null
          release_eligible_at: string | null
          return_requested_at: string | null
          seller_id: string
          seller_net_pence: number
          shipping_pence: number
          tracking_carrier: string | null
          tracking_number: string | null
          unit_price_pence: number
        }
        Insert: {
          accepted_at?: string | null
          buyer_received_at?: string | null
          buyer_vehicle_engine_size?: number | null
          buyer_vehicle_fuel?: string | null
          buyer_vehicle_registration?: string | null
          buyer_vehicle_variant_id?: string | null
          buyer_vehicle_year?: number | null
          cancelled_at?: string | null
          delivered_at?: string | null
          delivery_method?: string
          dispatched_at?: string | null
          dispute_opened_at?: string | null
          fulfilment_status?: string
          funds_released_at?: string | null
          id?: string
          order_id: string
          part_id: string
          payout_rollback_required?: boolean
          payout_status?: string
          platform_fee_pence?: number
          provider_transfer_id?: string | null
          provider_transfer_reversal_id?: string | null
          quantity: number
          refunded_at?: string | null
          release_eligible_at?: string | null
          return_requested_at?: string | null
          seller_id: string
          seller_net_pence?: number
          shipping_pence?: number
          tracking_carrier?: string | null
          tracking_number?: string | null
          unit_price_pence: number
        }
        Update: {
          accepted_at?: string | null
          buyer_received_at?: string | null
          buyer_vehicle_engine_size?: number | null
          buyer_vehicle_fuel?: string | null
          buyer_vehicle_registration?: string | null
          buyer_vehicle_variant_id?: string | null
          buyer_vehicle_year?: number | null
          cancelled_at?: string | null
          delivered_at?: string | null
          delivery_method?: string
          dispatched_at?: string | null
          dispute_opened_at?: string | null
          fulfilment_status?: string
          funds_released_at?: string | null
          id?: string
          order_id?: string
          part_id?: string
          payout_rollback_required?: boolean
          payout_status?: string
          platform_fee_pence?: number
          provider_transfer_id?: string | null
          provider_transfer_reversal_id?: string | null
          quantity?: number
          refunded_at?: string | null
          release_eligible_at?: string | null
          return_requested_at?: string | null
          seller_id?: string
          seller_net_pence?: number
          shipping_pence?: number
          tracking_carrier?: string | null
          tracking_number?: string | null
          unit_price_pence?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_buyer_vehicle_variant_id_fkey"
            columns: ["buyer_vehicle_variant_id"]
            isOneToOne: false
            referencedRelation: "vehicle_catalogue_variants"
            referencedColumns: ["id"]
          },
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
          cancelled_at: string | null
          checkout_expires_at: string | null
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          payment_provider: string | null
          payment_status: string
          platform_fee_pence: number
          provider_charge_id: string | null
          provider_checkout_session_id: string | null
          provider_payment_intent_id: string | null
          refunded_pence: number
          shipping_address: Json | null
          shipping_name: string | null
          shipping_pence: number
          status: string
          subtotal_pence: number
          total_pence: number
          updated_at: string
        }
        Insert: {
          buyer_id: string
          cancelled_at?: string | null
          checkout_expires_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          payment_provider?: string | null
          payment_status?: string
          platform_fee_pence?: number
          provider_charge_id?: string | null
          provider_checkout_session_id?: string | null
          provider_payment_intent_id?: string | null
          refunded_pence?: number
          shipping_address?: Json | null
          shipping_name?: string | null
          shipping_pence?: number
          status?: string
          subtotal_pence?: number
          total_pence: number
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          cancelled_at?: string | null
          checkout_expires_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          payment_provider?: string | null
          payment_status?: string
          platform_fee_pence?: number
          provider_charge_id?: string | null
          provider_checkout_session_id?: string | null
          provider_payment_intent_id?: string | null
          refunded_pence?: number
          shipping_address?: Json | null
          shipping_name?: string | null
          shipping_pence?: number
          status?: string
          subtotal_pence?: number
          total_pence?: number
          updated_at?: string
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
      part_requests: {
        Row: {
          catalogue_variant_id: string | null
          category_id: string | null
          created_at: string
          engine_size_simple: number | null
          fuel_type: string | null
          id: string
          notes: string | null
          oem_number: string | null
          profile_id: string
          query_text: string
          registration: string | null
          status: string
          updated_at: string
          year: number | null
        }
        Insert: {
          catalogue_variant_id?: string | null
          category_id?: string | null
          created_at?: string
          engine_size_simple?: number | null
          fuel_type?: string | null
          id?: string
          notes?: string | null
          oem_number?: string | null
          profile_id: string
          query_text: string
          registration?: string | null
          status?: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          catalogue_variant_id?: string | null
          category_id?: string | null
          created_at?: string
          engine_size_simple?: number | null
          fuel_type?: string | null
          id?: string
          notes?: string | null
          oem_number?: string | null
          profile_id?: string
          query_text?: string
          registration?: string | null
          status?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "part_requests_catalogue_variant_id_fkey"
            columns: ["catalogue_variant_id"]
            isOneToOne: false
            referencedRelation: "vehicle_catalogue_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_requests_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parts: {
        Row: {
          category_id: string
          collection_available: boolean
          condition: Database["public"]["Enums"]["part_condition"]
          condition_notes: string | null
          created_at: string
          damage_notes: string | null
          delivery_days_max: number | null
          delivery_days_min: number | null
          description: string
          dispatch_days: number
          donor_vehicle_id: string | null
          gearbox_code: string | null
          gearbox_family: string | null
          id: string
          import_batch_id: string | null
          manufacturer: string | null
          oem_number: string | null
          part_number: string | null
          price_pence: number
          search_document: unknown
          seller_id: string
          shipping_pence: number
          slug: string
          source_channel: string
          source_external_id: string | null
          source_request_id: string | null
          status: Database["public"]["Enums"]["listing_status"]
          stock: number
          testing_status: string
          title: string
          updated_at: string
          warranty_days: number
        }
        Insert: {
          category_id: string
          collection_available?: boolean
          condition: Database["public"]["Enums"]["part_condition"]
          condition_notes?: string | null
          created_at?: string
          damage_notes?: string | null
          delivery_days_max?: number | null
          delivery_days_min?: number | null
          description: string
          dispatch_days?: number
          donor_vehicle_id?: string | null
          gearbox_code?: string | null
          gearbox_family?: string | null
          id?: string
          import_batch_id?: string | null
          manufacturer?: string | null
          oem_number?: string | null
          part_number?: string | null
          price_pence: number
          search_document?: unknown
          seller_id: string
          shipping_pence?: number
          slug: string
          source_channel?: string
          source_external_id?: string | null
          source_request_id?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          stock?: number
          testing_status?: string
          title: string
          updated_at?: string
          warranty_days?: number
        }
        Update: {
          category_id?: string
          collection_available?: boolean
          condition?: Database["public"]["Enums"]["part_condition"]
          condition_notes?: string | null
          created_at?: string
          damage_notes?: string | null
          delivery_days_max?: number | null
          delivery_days_min?: number | null
          description?: string
          dispatch_days?: number
          donor_vehicle_id?: string | null
          gearbox_code?: string | null
          gearbox_family?: string | null
          id?: string
          import_batch_id?: string | null
          manufacturer?: string | null
          oem_number?: string | null
          part_number?: string | null
          price_pence?: number
          search_document?: unknown
          seller_id?: string
          shipping_pence?: number
          slug?: string
          source_channel?: string
          source_external_id?: string | null
          source_request_id?: string | null
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
            foreignKeyName: "parts_donor_vehicle_id_fkey"
            columns: ["donor_vehicle_id"]
            isOneToOne: false
            referencedRelation: "donor_vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "seller_inventory_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_source_request_id_fkey"
            columns: ["source_request_id"]
            isOneToOne: false
            referencedRelation: "part_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          event_type: string
          id: string
          order_id: string | null
          payload_ref: Json
          processed_at: string
          provider: string
          provider_event_id: string
        }
        Insert: {
          event_type: string
          id?: string
          order_id?: string | null
          payload_ref?: Json
          processed_at?: string
          provider: string
          provider_event_id: string
        }
        Update: {
          event_type?: string
          id?: string
          order_id?: string | null
          payload_ref?: Json
          processed_at?: string
          provider?: string
          provider_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bio: string | null
          created_at: string
          display_name: string
          handle: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          display_name: string
          handle: string
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          display_name?: string
          handle?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      recently_viewed_parts: {
        Row: {
          part_id: string
          profile_id: string
          viewed_at: string
        }
        Insert: {
          part_id: string
          profile_id: string
          viewed_at?: string
        }
        Update: {
          part_id?: string
          profile_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recently_viewed_parts_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recently_viewed_parts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      saved_searches: {
        Row: {
          created_at: string
          id: string
          name: string
          profile_id: string
          search_params: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          profile_id: string
          search_params?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          profile_id?: string
          search_params?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_inventory_imports: {
        Row: {
          created_at: string
          error_summary: Json
          filename: string | null
          id: string
          rows_created: number
          rows_received: number
          rows_rejected: number
          seller_id: string
          source_channel: string
          status: string
        }
        Insert: {
          created_at?: string
          error_summary?: Json
          filename?: string | null
          id?: string
          rows_created?: number
          rows_received?: number
          rows_rejected?: number
          seller_id: string
          source_channel: string
          status?: string
        }
        Update: {
          created_at?: string
          error_summary?: Json
          filename?: string | null
          id?: string
          rows_created?: number
          rows_received?: number
          rows_rejected?: number
          seller_id?: string
          source_channel?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_inventory_imports_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_part_request_leads: {
        Row: {
          catalogue_variant_id: string | null
          category_id: string | null
          created_at: string
          engine_size_simple: number | null
          fuel_type: string | null
          notes: string | null
          oem_number: string | null
          query_text: string
          request_id: string
          status: string
          year: number | null
        }
        Insert: {
          catalogue_variant_id?: string | null
          category_id?: string | null
          created_at: string
          engine_size_simple?: number | null
          fuel_type?: string | null
          notes?: string | null
          oem_number?: string | null
          query_text: string
          request_id: string
          status: string
          year?: number | null
        }
        Update: {
          catalogue_variant_id?: string | null
          category_id?: string | null
          created_at?: string
          engine_size_simple?: number | null
          fuel_type?: string | null
          notes?: string | null
          oem_number?: string | null
          query_text?: string
          request_id?: string
          status?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_part_request_leads_catalogue_variant_id_fkey"
            columns: ["catalogue_variant_id"]
            isOneToOne: false
            referencedRelation: "vehicle_catalogue_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_part_request_leads_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_part_request_leads_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "part_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_part_request_matches: {
        Row: {
          created_at: string
          match_reasons: string[]
          match_score: number
          request_id: string
          responded_part_id: string | null
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          match_reasons?: string[]
          match_score: number
          request_id: string
          responded_part_id?: string | null
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          match_reasons?: string[]
          match_score?: number
          request_id?: string
          responded_part_id?: string | null
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_part_request_matches_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "part_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_part_request_matches_responded_part_id_fkey"
            columns: ["responded_part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_part_request_matches_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_payment_accounts: {
        Row: {
          created_at: string
          details_submitted: boolean
          onboarding_status: string
          payment_provider: string
          payouts_enabled: boolean
          provider_account_id: string | null
          seller_id: string
          transfers_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          details_submitted?: boolean
          onboarding_status?: string
          payment_provider?: string
          payouts_enabled?: boolean
          provider_account_id?: string | null
          seller_id: string
          transfers_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          details_submitted?: boolean
          onboarding_status?: string
          payment_provider?: string
          payouts_enabled?: boolean
          provider_account_id?: string | null
          seller_id?: string
          transfers_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_payment_accounts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_prospects: {
        Row: {
          business_kind: string
          business_name: string
          created_at: string
          dedupe_key: string
          estimated_inventory: number | null
          id: string
          last_contacted_at: string | null
          location: string | null
          next_action_at: string | null
          notes: string | null
          postcode: string | null
          priority: string
          public_email: string | null
          public_phone: string | null
          source_type: string
          source_url: string | null
          status: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          business_kind: string
          business_name: string
          created_at?: string
          dedupe_key: string
          estimated_inventory?: number | null
          id?: string
          last_contacted_at?: string | null
          location?: string | null
          next_action_at?: string | null
          notes?: string | null
          postcode?: string | null
          priority?: string
          public_email?: string | null
          public_phone?: string | null
          source_type?: string
          source_url?: string | null
          status?: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          business_kind?: string
          business_name?: string
          created_at?: string
          dedupe_key?: string
          estimated_inventory?: number | null
          id?: string
          last_contacted_at?: string | null
          location?: string | null
          next_action_at?: string | null
          notes?: string | null
          postcode?: string | null
          priority?: string
          public_email?: string | null
          public_phone?: string | null
          source_type?: string
          source_url?: string | null
          status?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      seller_verification_requests: {
        Row: {
          business_kind_snapshot: string | null
          business_name_snapshot: string | null
          business_reference: string | null
          id: string
          legal_business_name: string | null
          location_snapshot: string | null
          message: string | null
          postcode_snapshot: string | null
          reference_url: string | null
          requested_at: string
          requester_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          seller_id: string
          seller_type_snapshot: string | null
          status: string
        }
        Insert: {
          business_kind_snapshot?: string | null
          business_name_snapshot?: string | null
          business_reference?: string | null
          id?: string
          legal_business_name?: string | null
          location_snapshot?: string | null
          message?: string | null
          postcode_snapshot?: string | null
          reference_url?: string | null
          requested_at?: string
          requester_id: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seller_id: string
          seller_type_snapshot?: string | null
          status?: string
        }
        Update: {
          business_kind_snapshot?: string | null
          business_name_snapshot?: string | null
          business_reference?: string | null
          id?: string
          legal_business_name?: string | null
          location_snapshot?: string | null
          message?: string | null
          postcode_snapshot?: string | null
          reference_url?: string | null
          requested_at?: string
          requester_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seller_id?: string
          seller_type_snapshot?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_verification_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_verification_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_verification_requests_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          business_kind: string | null
          business_name: string
          created_at: string
          description: string
          id: string
          latitude: number | null
          location: string
          longitude: number | null
          owner_id: string | null
          postcode: string | null
          postcode_geocode_approximate: boolean
          postcode_geocoded_at: string | null
          seller_type: string
          slug: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          business_kind?: string | null
          business_name: string
          created_at?: string
          description?: string
          id?: string
          latitude?: number | null
          location: string
          longitude?: number | null
          owner_id?: string | null
          postcode?: string | null
          postcode_geocode_approximate?: boolean
          postcode_geocoded_at?: string | null
          seller_type?: string
          slug: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          business_kind?: string | null
          business_name?: string
          created_at?: string
          description?: string
          id?: string
          latitude?: number | null
          location?: string
          longitude?: number | null
          owner_id?: string | null
          postcode?: string | null
          postcode_geocode_approximate?: boolean
          postcode_geocoded_at?: string | null
          seller_type?: string
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
      support_requests: {
        Row: {
          created_at: string
          id: string
          message: string
          profile_id: string
          status: string
          topic: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          profile_id: string
          status?: string
          topic: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          profile_id?: string
          status?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_case_evidence: {
        Row: {
          case_id: string
          created_at: string
          id: string
          mime_type: string
          original_name: string
          storage_path: string
          uploader_profile_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          id?: string
          mime_type: string
          original_name: string
          storage_path: string
          uploader_profile_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          id?: string
          mime_type?: string
          original_name?: string
          storage_path?: string
          uploader_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_case_evidence_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "transaction_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_case_evidence_uploader_profile_id_fkey"
            columns: ["uploader_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_cases: {
        Row: {
          case_type: string
          created_at: string
          details: string
          id: string
          opened_by: string | null
          order_item_id: string
          previous_fulfilment_status: string
          provider_dispute_id: string | null
          provider_dispute_reason: string | null
          provider_dispute_status: string | null
          provider_refund_id: string | null
          provider_transfer_reversal_id: string | null
          reason: string
          resolution: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          return_authorized_at: string | null
          return_received_at: string | null
          return_shipped_at: string | null
          return_tracking_carrier: string | null
          return_tracking_number: string | null
          seller_response: string | null
          status: string
          updated_at: string
        }
        Insert: {
          case_type: string
          created_at?: string
          details: string
          id?: string
          opened_by?: string | null
          order_item_id: string
          previous_fulfilment_status: string
          provider_dispute_id?: string | null
          provider_dispute_reason?: string | null
          provider_dispute_status?: string | null
          provider_refund_id?: string | null
          provider_transfer_reversal_id?: string | null
          reason: string
          resolution?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          return_authorized_at?: string | null
          return_received_at?: string | null
          return_shipped_at?: string | null
          return_tracking_carrier?: string | null
          return_tracking_number?: string | null
          seller_response?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          case_type?: string
          created_at?: string
          details?: string
          id?: string
          opened_by?: string | null
          order_item_id?: string
          previous_fulfilment_status?: string
          provider_dispute_id?: string | null
          provider_dispute_reason?: string | null
          provider_dispute_status?: string | null
          provider_refund_id?: string | null
          provider_transfer_reversal_id?: string | null
          reason?: string
          resolution?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          return_authorized_at?: string | null
          return_received_at?: string | null
          return_shipped_at?: string | null
          return_tracking_carrier?: string | null
          return_tracking_number?: string | null
          seller_response?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_cases_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_cases_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_cases_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          order_item_id: string
          sender_profile_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          order_item_id: string
          sender_profile_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          order_item_id?: string
          sender_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_messages_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_reviews: {
        Row: {
          buyer_conduct_rating: number | null
          comment: string | null
          communication_rating: number | null
          created_at: string
          direction: string
          dispatch_rating: number | null
          id: string
          item_as_described_rating: number | null
          order_item_id: string
          overall_rating: number
          removed_at: string | null
          removed_reason: string | null
          reviewee_id: string
          reviewer_id: string
          status: string
          visible_at: string
        }
        Insert: {
          buyer_conduct_rating?: number | null
          comment?: string | null
          communication_rating?: number | null
          created_at?: string
          direction: string
          dispatch_rating?: number | null
          id?: string
          item_as_described_rating?: number | null
          order_item_id: string
          overall_rating: number
          removed_at?: string | null
          removed_reason?: string | null
          reviewee_id: string
          reviewer_id: string
          status?: string
          visible_at?: string
        }
        Update: {
          buyer_conduct_rating?: number | null
          comment?: string | null
          communication_rating?: number | null
          created_at?: string
          direction?: string
          dispatch_rating?: number | null
          id?: string
          item_as_described_rating?: number | null
          order_item_id?: string
          overall_rating?: number
          removed_at?: string | null
          removed_reason?: string | null
          reviewee_id?: string
          reviewer_id?: string
          status?: string
          visible_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_reviews_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
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
      vehicle_lookup_cache: {
        Row: {
          expires_at: string
          fetched_at: string
          lookup_hash: string
          provider: string
          result_status: string
          vehicle: Json | null
        }
        Insert: {
          expires_at: string
          fetched_at?: string
          lookup_hash: string
          provider: string
          result_status: string
          vehicle?: Json | null
        }
        Update: {
          expires_at?: string
          fetched_at?: string
          lookup_hash?: string
          provider?: string
          result_status?: string
          vehicle?: Json | null
        }
        Relationships: []
      }
      vehicle_lookup_rate_limits: {
        Row: {
          key_hash: string
          request_count: number
          updated_at: string
          window_started_at: string
        }
        Insert: {
          key_hash: string
          request_count?: number
          updated_at?: string
          window_started_at?: string
        }
        Update: {
          key_hash?: string
          request_count?: number
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
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
      verified_fit_feedback: {
        Row: {
          buyer_id: string
          created_at: string
          engine_size_simple: number | null
          fuel_type: string | null
          id: string
          notes: string | null
          order_item_id: string
          part_id: string
          result: string
          updated_at: string
          variant_id: string
          year: number
        }
        Insert: {
          buyer_id: string
          created_at?: string
          engine_size_simple?: number | null
          fuel_type?: string | null
          id?: string
          notes?: string | null
          order_item_id: string
          part_id: string
          result: string
          updated_at?: string
          variant_id: string
          year: number
        }
        Update: {
          buyer_id?: string
          created_at?: string
          engine_size_simple?: number | null
          fuel_type?: string | null
          id?: string
          notes?: string | null
          order_item_id?: string
          part_id?: string
          result?: string
          updated_at?: string
          variant_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "verified_fit_feedback_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verified_fit_feedback_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verified_fit_feedback_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verified_fit_feedback_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "vehicle_catalogue_variants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_authorize_transaction_return: {
        Args: { p_case_id: string; p_notes?: string }
        Returns: boolean
      }
      admin_prepare_returnless_refund: {
        Args: { p_case_id: string; p_notes: string }
        Returns: boolean
      }
      admin_prepare_transaction_case_refund: {
        Args: { p_case_id: string; p_notes: string }
        Returns: boolean
      }
      admin_reject_transaction_case: {
        Args: { p_case_id: string; p_notes: string }
        Returns: boolean
      }
      admin_review_seller_verification: {
        Args: {
          p_approve: boolean
          p_request_id: string
          p_review_note?: string
        }
        Returns: undefined
      }
      admin_update_marketplace_report: {
        Args: { p_report_id: string; p_status: string }
        Returns: undefined
      }
      buyer_mark_order_item_received: {
        Args: { p_accept_now?: boolean; p_order_item_id: string }
        Returns: boolean
      }
      buyer_mark_transaction_return_shipped: {
        Args: {
          p_carrier: string
          p_case_id: string
          p_tracking_number: string
        }
        Returns: boolean
      }
      buyer_part_request_match_counts: {
        Args: never
        Returns: {
          matching_seller_count: number
          request_id: string
          verified_seller_count: number
        }[]
      }
      buyer_part_request_match_counts_for_ids: {
        Args: { request_ids: string[] }
        Returns: {
          matching_seller_count: number
          request_id: string
          verified_seller_count: number
        }[]
      }
      buyer_respond_fitting_quote: {
        Args: { p_action: string; p_request_id: string }
        Returns: boolean
      }
      cancel_checkout_order: {
        Args: { p_event_id?: string; p_event_type?: string; p_order_id: string }
        Returns: boolean
      }
      category_descendant_ids: {
        Args: { p_category_id: string }
        Returns: {
          id: string
        }[]
      }
      claim_order_item_payout_release: {
        Args: { p_order_item_id: string }
        Returns: boolean
      }
      close_listing_conversation: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      close_provider_payment_dispute: {
        Args: {
          p_dispute_id: string
          p_event_id: string
          p_status: string
          p_transfer_reversal_id?: string
        }
        Returns: boolean
      }
      confirm_checkout_paid: {
        Args: {
          p_charge_id: string
          p_checkout_session_id: string
          p_event_id: string
          p_order_id: string
          p_payment_intent_id: string
          p_shipping_address?: Json
          p_shipping_name?: string
        }
        Returns: boolean
      }
      consume_ai_listing_quota: {
        Args: never
        Returns: {
          allowed: boolean
          remaining: number
          reset_at: string
        }[]
      }
      consume_vehicle_lookup_rate_limit: {
        Args: {
          p_key_hash: string
          p_limit?: number
          p_window_seconds?: number
        }
        Returns: {
          allowed: boolean
          remaining: number
          retry_after_seconds: number
        }[]
      }
      dismiss_seller_part_request_match: {
        Args: { p_request_id: string }
        Returns: boolean
      }
      finalize_transaction_case_refund: {
        Args: {
          p_case_id: string
          p_refund_id: string
          p_refund_pence: number
          p_transfer_reversal_id?: string
        }
        Returns: boolean
      }
      garage_respond_fitting_request: {
        Args: {
          p_action: string
          p_note?: string
          p_quote_pence?: number
          p_request_id: string
        }
        Returns: boolean
      }
      get_due_payout_order_items: {
        Args: { p_limit?: number }
        Returns: {
          order_item_id: string
        }[]
      }
      get_existing_csv_inventory_references: {
        Args: { p_references: string[] }
        Returns: {
          source_external_id: string
        }[]
      }
      get_expired_unpaid_orders: {
        Args: { p_limit?: number }
        Returns: {
          order_id: string
        }[]
      }
      get_part_passport_evidence: {
        Args: { p_part_id: string }
        Returns: {
          donor_colour: string
          donor_engine_size_simple: number
          donor_fuel_type: string
          donor_make: string
          donor_model: string
          donor_variant: string
          donor_year: number
          explicit_fitment_count: number
          verified_fit_report_count: number
        }[]
      }
      get_part_verified_fit_summary: {
        Args: {
          p_engine?: number
          p_fuel?: string
          p_part_id: string
          p_variant_id: string
          p_year: number
        }
        Returns: {
          did_not_fit_count: number
          exact_fit_count: number
          modified_fit_count: number
        }[]
      }
      get_public_member_profile: {
        Args: { p_handle: string }
        Returns: {
          bio: string
          bought_count: number
          buyer_rating: number
          buyer_review_count: number
          display_name: string
          handle: string
          member_since: string
          profile_id: string
          seller_id: string
          seller_name: string
          seller_rating: number
          seller_review_count: number
          seller_slug: string
          seller_type: string
          seller_verified: boolean
          sold_count: number
        }[]
      }
      get_public_member_profile_by_id: {
        Args: { p_profile_id: string }
        Returns: {
          bio: string
          bought_count: number
          buyer_rating: number
          buyer_review_count: number
          display_name: string
          handle: string
          member_since: string
          profile_id: string
          seller_id: string
          seller_name: string
          seller_rating: number
          seller_review_count: number
          seller_slug: string
          seller_type: string
          seller_verified: boolean
          sold_count: number
        }[]
      }
      get_public_member_reviews: {
        Args: { p_limit?: number; p_profile_id: string }
        Returns: {
          buyer_conduct_rating: number
          comment: string
          communication_rating: number
          created_at: string
          direction: string
          dispatch_rating: number
          item_as_described_rating: number
          overall_rating: number
          part_title: string
          review_id: string
          reviewer_bought_count: number
          reviewer_display_name: string
          reviewer_handle: string
          reviewer_sold_count: number
        }[]
      }
      get_public_seller_inventory_summary: {
        Args: { p_seller_id: string }
        Returns: {
          active_count: number
          category_names: string[]
          collection_count: number
          tested_count: number
          warranty_count: number
        }[]
      }
      get_review_opportunities: {
        Args: never
        Returns: {
          counterpart_display_name: string
          counterpart_handle: string
          counterpart_profile_id: string
          direction: string
          existing_review_id: string
          funds_released_at: string
          order_item_id: string
          part_title: string
        }[]
      }
      get_review_opportunities_page: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          counterpart_display_name: string
          counterpart_handle: string
          counterpart_profile_id: string
          direction: string
          existing_review_id: string
          funds_released_at: string
          order_item_id: string
          part_title: string
        }[]
      }
      get_seller_directory_page: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          bought_count: number
          business_name: string
          description: string
          handle: string
          location: string
          owner_id: string
          seller_id: string
          seller_rating: number
          seller_review_count: number
          seller_type: string
          seller_verified: boolean
          slug: string
          sold_count: number
        }[]
      }
      get_verified_fit_opportunities: {
        Args: never
        Returns: {
          existing_notes: string
          existing_result: string
          funds_released_at: string
          order_item_id: string
          part_id: string
          part_slug: string
          part_title: string
          variant_id: string
          vehicle_engine: number
          vehicle_fuel: string
          vehicle_make: string
          vehicle_model: string
          vehicle_variant: string
          vehicle_year: number
        }[]
      }
      get_verified_fit_opportunities_page: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          existing_notes: string
          existing_result: string
          funds_released_at: string
          order_item_id: string
          part_id: string
          part_slug: string
          part_title: string
          variant_id: string
          vehicle_engine: number
          vehicle_fuel: string
          vehicle_make: string
          vehicle_model: string
          vehicle_variant: string
          vehicle_year: number
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
      mark_order_item_payout_released: {
        Args: { p_order_item_id: string; p_transfer_id: string }
        Returns: boolean
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
      marketplace_catalogue_distance_page: {
        Args: {
          p_buyer_lat: number
          p_buyer_lon: number
          p_category_ids?: string[]
          p_collection_only?: boolean
          p_compatible_only?: boolean
          p_condition?: string
          p_engine?: number
          p_fuel?: string
          p_limit?: number
          p_max_price_pence?: number
          p_min_price_pence?: number
          p_offset?: number
          p_part_ids?: string[]
          p_variant_id: string
          p_year: number
        }
        Returns: {
          confidence: string
          distance_approximate: boolean
          distance_miles: number
          part_id: string
          total_count: number
        }[]
      }
      marketplace_catalogue_page: {
        Args: {
          p_category_ids?: string[]
          p_collection_only?: boolean
          p_compatible_only?: boolean
          p_condition?: string
          p_engine?: number
          p_fuel?: string
          p_limit?: number
          p_max_price_pence?: number
          p_min_price_pence?: number
          p_offset?: number
          p_part_ids?: string[]
          p_variant_id: string
          p_year: number
        }
        Returns: {
          confidence: string
          part_id: string
          total_count: number
        }[]
      }
      marketplace_catalogue_sorted_page: {
        Args: {
          p_category_ids?: string[]
          p_collection_only?: boolean
          p_compatible_only?: boolean
          p_condition?: string
          p_engine?: number
          p_fuel?: string
          p_limit?: number
          p_max_price_pence?: number
          p_min_price_pence?: number
          p_offset?: number
          p_part_ids?: string[]
          p_sort?: string
          p_variant_id: string
          p_year: number
        }
        Returns: {
          confidence: string
          part_id: string
          total_count: number
        }[]
      }
      marketplace_distance_page: {
        Args: {
          p_buyer_lat: number
          p_buyer_lon: number
          p_category_ids?: string[]
          p_collection_only?: boolean
          p_condition?: string
          p_limit?: number
          p_max_price_pence?: number
          p_min_price_pence?: number
          p_offset?: number
          p_part_ids?: string[]
        }
        Returns: {
          distance_approximate: boolean
          distance_miles: number
          part_id: string
          total_count: number
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
      marketplace_search_part_ids_limited: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          part_id: string
        }[]
      }
      open_provider_payment_dispute: {
        Args: {
          p_charge_id: string
          p_dispute_id: string
          p_event_id: string
          p_reason?: string
          p_status: string
        }
        Returns: string
      }
      open_transaction_case: {
        Args: {
          p_case_type: string
          p_details: string
          p_order_item_id: string
          p_reason: string
        }
        Returns: string
      }
      prepare_checkout_order: {
        Args: {
          p_delivery_method?: string
          p_part_id: string
          p_quantity?: number
        }
        Returns: {
          checkout_expires_at: string
          order_id: string
          order_item_id: string
          part_title: string
          platform_fee_pence: number
          quantity: number
          seller_name: string
          seller_net_pence: number
          shipping_pence: number
          total_pence: number
          unit_price_pence: number
        }[]
      }
      prepare_checkout_order_v2: {
        Args: {
          p_delivery_method?: string
          p_part_id: string
          p_quantity?: number
          p_vehicle_engine?: number
          p_vehicle_fuel?: string
          p_vehicle_registration?: string
          p_vehicle_variant_id?: string
          p_vehicle_year?: number
        }
        Returns: {
          checkout_expires_at: string
          order_id: string
          order_item_id: string
          part_title: string
          platform_fee_pence: number
          quantity: number
          seller_name: string
          seller_net_pence: number
          shipping_pence: number
          total_pence: number
          unit_price_pence: number
        }[]
      }
      publish_ready_import_batch: {
        Args: { p_batch_id: string }
        Returns: number
      }
      register_transaction_case_evidence: {
        Args: {
          p_case_id: string
          p_mime_type: string
          p_original_name: string
          p_storage_path: string
        }
        Returns: string
      }
      replace_part_catalogue_fitments: {
        Args: { p_fitments: Json; p_part_id: string }
        Returns: undefined
      }
      request_part_fitting_quote: {
        Args: {
          p_garage_partner_id: string
          p_notes?: string
          p_part_id: string
          p_vehicle_engine?: number
          p_vehicle_fuel?: string
          p_vehicle_registration?: string
          p_vehicle_variant_id: string
          p_vehicle_year: number
        }
        Returns: string
      }
      reset_order_item_payout_release_claim: {
        Args: { p_order_item_id: string }
        Returns: boolean
      }
      seller_checkout_ready: { Args: { p_seller_id: string }; Returns: boolean }
      seller_confirm_transaction_return_received: {
        Args: { p_case_id: string }
        Returns: boolean
      }
      seller_import_batch_readiness: {
        Args: { p_batch_id: string }
        Returns: {
          needs_compatibility: number
          needs_photos: number
          needs_technical: number
          ready_drafts: number
          total_drafts: number
        }[]
      }
      seller_import_batch_work_queue: {
        Args: {
          p_batch_id: string
          p_limit?: number
          p_need?: string
          p_offset?: number
        }
        Returns: {
          category_name: string
          has_compatibility: boolean
          has_photo: boolean
          has_stock: boolean
          has_technical: boolean
          part_id: string
          source_external_id: string
          title: string
          total_count: number
        }[]
      }
      seller_part_request_lead: {
        Args: { p_request_id: string }
        Returns: {
          catalogue_variant_id: string
          category_id: string
          category_name: string
          created_at: string
          engine_size_simple: number
          fuel_type: string
          match_reasons: string[]
          match_score: number
          notes: string
          oem_number: string
          query_text: string
          request_id: string
          vehicle_make: string
          vehicle_model: string
          vehicle_variant: string
          year: number
        }[]
      }
      seller_ranked_part_request_leads: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          catalogue_variant_id: string
          category_id: string
          category_name: string
          created_at: string
          engine_size_simple: number
          fuel_type: string
          match_reasons: string[]
          match_score: number
          notes: string
          oem_number: string
          query_text: string
          request_id: string
          vehicle_make: string
          vehicle_model: string
          vehicle_variant: string
          year: number
        }[]
      }
      seller_respond_transaction_case: {
        Args: { p_case_id: string; p_response: string }
        Returns: boolean
      }
      seller_set_order_item_fulfilment: {
        Args: {
          p_action: string
          p_carrier?: string
          p_order_item_id: string
          p_tracking_number?: string
        }
        Returns: boolean
      }
      send_fitting_request_message: {
        Args: { p_body: string; p_request_id: string }
        Returns: string
      }
      send_listing_conversation_message: {
        Args: { p_body: string; p_conversation_id: string }
        Returns: string
      }
      send_transaction_message: {
        Args: { p_body: string; p_order_item_id: string }
        Returns: string
      }
      start_listing_conversation: {
        Args: { p_body: string; p_part_id: string }
        Returns: string
      }
      submit_transaction_review: {
        Args: {
          p_buyer_conduct_rating?: number
          p_comment?: string
          p_communication_rating?: number
          p_dispatch_rating?: number
          p_item_as_described_rating?: number
          p_order_item_id: string
          p_overall_rating: number
        }
        Returns: string
      }
      submit_verified_fit_feedback: {
        Args: { p_notes?: string; p_order_item_id: string; p_result: string }
        Returns: string
      }
      upgrade_account_to_seller: { Args: never; Returns: boolean }
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

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
      achievements: {
        Row: {
          category: string
          code: string
          created_at: string
          description: string
          icon: string
          id: string
          reward_points: number
          sort_order: number
          threshold: number
          title: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          category?: string
          code: string
          created_at?: string
          description: string
          icon?: string
          id?: string
          reward_points?: number
          sort_order?: number
          threshold?: number
          title: string
          trigger_type: string
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          reward_points?: number
          sort_order?: number
          threshold?: number
          title?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          created_at: string
          id: string
          log_date: string
          steps: number | null
          training_done: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          log_date?: string
          steps?: number | null
          training_done?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          log_date?: string
          steps?: number | null
          training_done?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      affiliate_partners: {
        Row: {
          commission_pct: number
          created_at: string
          created_by: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          payouts_enabled: boolean
          slug: string
          stripe_connect_account_id: string | null
          updated_at: string
        }
        Insert: {
          commission_pct?: number
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          payouts_enabled?: boolean
          slug: string
          stripe_connect_account_id?: string | null
          updated_at?: string
        }
        Update: {
          commission_pct?: number
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          payouts_enabled?: boolean
          slug?: string
          stripe_connect_account_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      affiliate_referrals: {
        Row: {
          commission_amount_eur: number | null
          commission_pct: number | null
          commission_status: string
          created_at: string
          first_payment_id: string | null
          id: string
          paid_at: string | null
          partner_id: string
          payment_amount_eur: number | null
          payout_note: string | null
          referred_user_id: string
          signup_at: string
          source_slug: string | null
          stripe_transfer_id: string | null
          updated_at: string
        }
        Insert: {
          commission_amount_eur?: number | null
          commission_pct?: number | null
          commission_status?: string
          created_at?: string
          first_payment_id?: string | null
          id?: string
          paid_at?: string | null
          partner_id: string
          payment_amount_eur?: number | null
          payout_note?: string | null
          referred_user_id: string
          signup_at?: string
          source_slug?: string | null
          stripe_transfer_id?: string | null
          updated_at?: string
        }
        Update: {
          commission_amount_eur?: number | null
          commission_pct?: number | null
          commission_status?: string
          created_at?: string
          first_payment_id?: string | null
          id?: string
          paid_at?: string | null
          partner_id?: string
          payment_amount_eur?: number | null
          payout_note?: string | null
          referred_user_id?: string
          signup_at?: string
          source_slug?: string | null
          stripe_transfer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_referrals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "affiliate_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_checkin_drafts: {
        Row: {
          client_id: string
          coach_id: string
          created_at: string
          decided_at: string | null
          draft: Json
          generated_at: string
          id: string
          message_final: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          coach_id: string
          created_at?: string
          decided_at?: string | null
          draft: Json
          generated_at?: string
          id?: string
          message_final?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          coach_id?: string
          created_at?: string
          decided_at?: string | null
          draft?: Json
          generated_at?: string
          id?: string
          message_final?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_reviews: {
        Row: {
          approved_for_public: boolean
          comment: string | null
          created_at: string
          first_name: string | null
          hidden: boolean
          id: string
          publish_with_name: boolean
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_for_public?: boolean
          comment?: string | null
          created_at?: string
          first_name?: string | null
          hidden?: boolean
          id?: string
          publish_with_name?: boolean
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_for_public?: boolean
          comment?: string | null
          created_at?: string
          first_name?: string | null
          hidden?: boolean
          id?: string
          publish_with_name?: boolean
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      body_measurements: {
        Row: {
          biceps_left_cm: number | null
          biceps_right_cm: number | null
          body_fat_pct: number | null
          chest_cm: number | null
          created_at: string
          hip_cm: number | null
          id: string
          measured_at: string
          muscle_mass_kg: number | null
          notes: string | null
          thigh_left_cm: number | null
          thigh_right_cm: number | null
          updated_at: string
          user_id: string
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          biceps_left_cm?: number | null
          biceps_right_cm?: number | null
          body_fat_pct?: number | null
          chest_cm?: number | null
          created_at?: string
          hip_cm?: number | null
          id?: string
          measured_at?: string
          muscle_mass_kg?: number | null
          notes?: string | null
          thigh_left_cm?: number | null
          thigh_right_cm?: number | null
          updated_at?: string
          user_id: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          biceps_left_cm?: number | null
          biceps_right_cm?: number | null
          body_fat_pct?: number | null
          chest_cm?: number | null
          created_at?: string
          hip_cm?: number | null
          id?: string
          measured_at?: string
          muscle_mass_kg?: number | null
          notes?: string | null
          thigh_left_cm?: number | null
          thigh_right_cm?: number | null
          updated_at?: string
          user_id?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      bulls_hub_events: {
        Row: {
          id: string
          kind: string
          occurred_at: string
          user_id: string
        }
        Insert: {
          id?: string
          kind: string
          occurred_at?: string
          user_id: string
        }
        Update: {
          id?: string
          kind?: string
          occurred_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bulls_profiles: {
        Row: {
          email: string
          first_name: string
          height_cm: number
          last_name: string
          main_goal: Database["public"]["Enums"]["bulls_goal"]
          onboarded_at: string
          position: Database["public"]["Enums"]["bulls_position"]
          updated_at: string
          user_id: string
          weight_kg: number
        }
        Insert: {
          email: string
          first_name: string
          height_cm: number
          last_name: string
          main_goal: Database["public"]["Enums"]["bulls_goal"]
          onboarded_at?: string
          position: Database["public"]["Enums"]["bulls_position"]
          updated_at?: string
          user_id: string
          weight_kg: number
        }
        Update: {
          email?: string
          first_name?: string
          height_cm?: number
          last_name?: string
          main_goal?: Database["public"]["Enums"]["bulls_goal"]
          onboarded_at?: string
          position?: Database["public"]["Enums"]["bulls_position"]
          updated_at?: string
          user_id?: string
          weight_kg?: number
        }
        Relationships: []
      }
      bulls_progress_photos: {
        Row: {
          back_path: string | null
          created_at: string
          front_path: string | null
          id: string
          photo_date: string
          side_path: string | null
          user_id: string
        }
        Insert: {
          back_path?: string | null
          created_at?: string
          front_path?: string | null
          id?: string
          photo_date?: string
          side_path?: string | null
          user_id: string
        }
        Update: {
          back_path?: string | null
          created_at?: string
          front_path?: string | null
          id?: string
          photo_date?: string
          side_path?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bulls_weight_logs: {
        Row: {
          created_at: string
          id: string
          log_date: string
          user_id: string
          weight_kg: number
        }
        Insert: {
          created_at?: string
          id?: string
          log_date?: string
          user_id: string
          weight_kg: number
        }
        Update: {
          created_at?: string
          id?: string
          log_date?: string
          user_id?: string
          weight_kg?: number
        }
        Relationships: []
      }
      coach_alert_resolutions: {
        Row: {
          action: string
          alert_detail: string | null
          alert_key: string
          alert_kind: string
          alert_range: string | null
          alert_severity: string
          alert_title: string
          alert_user_id: string
          client_name: string | null
          coach_user_id: string
          id: string
          resolved_at: string
        }
        Insert: {
          action: string
          alert_detail?: string | null
          alert_key: string
          alert_kind: string
          alert_range?: string | null
          alert_severity: string
          alert_title: string
          alert_user_id: string
          client_name?: string | null
          coach_user_id: string
          id?: string
          resolved_at?: string
        }
        Update: {
          action?: string
          alert_detail?: string | null
          alert_key?: string
          alert_kind?: string
          alert_range?: string | null
          alert_severity?: string
          alert_title?: string
          alert_user_id?: string
          client_name?: string | null
          coach_user_id?: string
          id?: string
          resolved_at?: string
        }
        Relationships: []
      }
      coach_exercise_library: {
        Row: {
          category: string
          created_at: string
          default_reps: string
          default_rest_seconds: number
          default_sets: number
          difficulty: string
          equipment: string[]
          exercise_type: string
          id: string
          is_active: boolean
          is_unilateral: boolean
          movement_pattern: string
          name: string
          notes: string | null
          primary_muscle: string
          secondary_muscles: string[]
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          default_reps?: string
          default_rest_seconds?: number
          default_sets?: number
          difficulty?: string
          equipment?: string[]
          exercise_type?: string
          id?: string
          is_active?: boolean
          is_unilateral?: boolean
          movement_pattern: string
          name: string
          notes?: string | null
          primary_muscle: string
          secondary_muscles?: string[]
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          default_reps?: string
          default_rest_seconds?: number
          default_sets?: number
          difficulty?: string
          equipment?: string[]
          exercise_type?: string
          id?: string
          is_active?: boolean
          is_unilateral?: boolean
          movement_pattern?: string
          name?: string
          notes?: string | null
          primary_muscle?: string
          secondary_muscles?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      coach_meal_library: {
        Row: {
          budget: Database["public"]["Enums"]["meal_budget_level"]
          carbs_g: number
          category: Database["public"]["Enums"]["meal_slot_kind"]
          created_at: string
          created_by: string | null
          description: string | null
          eat_cold: boolean
          effort: Database["public"]["Enums"]["meal_effort_level"]
          fat_g: number
          id: string
          ingredients: Json
          instructions: string | null
          is_active: boolean
          is_system: boolean
          kcal: number
          main_carb: string | null
          main_protein: string | null
          mealprep_ok: boolean
          name: string
          no_go_ingredients: string[]
          portion_label: string | null
          protein_g: number
          suitable_rest: boolean
          suitable_training: boolean
          tags: string[]
          updated_at: string
        }
        Insert: {
          budget?: Database["public"]["Enums"]["meal_budget_level"]
          carbs_g?: number
          category: Database["public"]["Enums"]["meal_slot_kind"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          eat_cold?: boolean
          effort?: Database["public"]["Enums"]["meal_effort_level"]
          fat_g?: number
          id?: string
          ingredients?: Json
          instructions?: string | null
          is_active?: boolean
          is_system?: boolean
          kcal?: number
          main_carb?: string | null
          main_protein?: string | null
          mealprep_ok?: boolean
          name: string
          no_go_ingredients?: string[]
          portion_label?: string | null
          protein_g?: number
          suitable_rest?: boolean
          suitable_training?: boolean
          tags?: string[]
          updated_at?: string
        }
        Update: {
          budget?: Database["public"]["Enums"]["meal_budget_level"]
          carbs_g?: number
          category?: Database["public"]["Enums"]["meal_slot_kind"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          eat_cold?: boolean
          effort?: Database["public"]["Enums"]["meal_effort_level"]
          fat_g?: number
          id?: string
          ingredients?: Json
          instructions?: string | null
          is_active?: boolean
          is_system?: boolean
          kcal?: number
          main_carb?: string | null
          main_protein?: string | null
          mealprep_ok?: boolean
          name?: string
          no_go_ingredients?: string[]
          portion_label?: string | null
          protein_g?: number
          suitable_rest?: boolean
          suitable_training?: boolean
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      coach_messages: {
        Row: {
          body: string
          broadcast_id: string | null
          created_at: string
          from_coach: boolean
          id: string
          read_by_client_at: string | null
          read_by_coach_at: string | null
          sender_id: string
          thread_user_id: string
        }
        Insert: {
          body: string
          broadcast_id?: string | null
          created_at?: string
          from_coach: boolean
          id?: string
          read_by_client_at?: string | null
          read_by_coach_at?: string | null
          sender_id: string
          thread_user_id: string
        }
        Update: {
          body?: string
          broadcast_id?: string | null
          created_at?: string
          from_coach?: boolean
          id?: string
          read_by_client_at?: string | null
          read_by_coach_at?: string | null
          sender_id?: string
          thread_user_id?: string
        }
        Relationships: []
      }
      coach_task_state: {
        Row: {
          coach_id: string
          completed_at: string | null
          created_at: string
          id: string
          note: string | null
          snoozed_until: string | null
          task_key: string
          updated_at: string
        }
        Insert: {
          coach_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          note?: string | null
          snoozed_until?: string | null
          task_key: string
          updated_at?: string
        }
        Update: {
          coach_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          note?: string | null
          snoozed_until?: string | null
          task_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      custom_meals: {
        Row: {
          carbs_g: number | null
          created_at: string
          fat_g: number | null
          id: string
          ingredients: Json
          kcal: number | null
          meal_slot: string
          name: string
          notes: string | null
          protein_g: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          carbs_g?: number | null
          created_at?: string
          fat_g?: number | null
          id?: string
          ingredients?: Json
          kcal?: number | null
          meal_slot?: string
          name: string
          notes?: string | null
          protein_g?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          carbs_g?: number | null
          created_at?: string
          fat_g?: number | null
          id?: string
          ingredients?: Json
          kcal?: number | null
          meal_slot?: string
          name?: string
          notes?: string | null
          protein_g?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_packages: {
        Row: {
          created_at: string
          end_date: string
          ended_at: string | null
          id: string
          is_active: boolean
          notes: string | null
          package: string
          price_eur: number
          source: string
          start_date: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          package: string
          price_eur?: number
          source?: string
          start_date?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          package?: string
          price_eur?: number
          source?: string
          start_date?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_checks: {
        Row: {
          check_date: string
          created_at: string
          id: string
          organization_id: string | null
          points: number
          source_task_id: string | null
          tasks: Json
          team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          check_date: string
          created_at?: string
          id?: string
          organization_id?: string | null
          points?: number
          source_task_id?: string | null
          tasks?: Json
          team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          check_date?: string
          created_at?: string
          id?: string
          organization_id?: string | null
          points?: number
          source_task_id?: string | null
          tasks?: Json
          team_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_checks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_checks_source_task_id_fkey"
            columns: ["source_task_id"]
            isOneToOne: false
            referencedRelation: "organization_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_checks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "organization_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      day_type_overrides: {
        Row: {
          created_at: string
          entry_date: string
          kind: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_date: string
          kind: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry_date?: string
          kind?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      food_entries: {
        Row: {
          barcode: string | null
          brand: string | null
          carbs_g: number
          created_at: string
          entry_date: string
          fat_g: number
          id: string
          kcal: number
          meal: string
          name: string
          protein_g: number
          serving_g: number
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          carbs_g?: number
          created_at?: string
          entry_date?: string
          fat_g?: number
          id?: string
          kcal?: number
          meal: string
          name: string
          protein_g?: number
          serving_g?: number
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          carbs_g?: number
          created_at?: string
          entry_date?: string
          fat_g?: number
          id?: string
          kcal?: number
          meal?: string
          name?: string
          protein_g?: number
          serving_g?: number
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      food_favorites: {
        Row: {
          barcode: string | null
          brand: string | null
          carbs_per_100g: number
          created_at: string
          fat_per_100g: number
          id: string
          kcal_per_100g: number
          last_amount_g: number | null
          name: string
          protein_per_100g: number
          serving_g: number | null
          serving_label: string | null
          user_id: string
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          carbs_per_100g?: number
          created_at?: string
          fat_per_100g?: number
          id?: string
          kcal_per_100g?: number
          last_amount_g?: number | null
          name: string
          protein_per_100g?: number
          serving_g?: number | null
          serving_label?: string | null
          user_id: string
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          carbs_per_100g?: number
          created_at?: string
          fat_per_100g?: number
          id?: string
          kcal_per_100g?: number
          last_amount_g?: number | null
          name?: string
          protein_per_100g?: number
          serving_g?: number | null
          serving_label?: string | null
          user_id?: string
        }
        Relationships: []
      }
      free_user_events: {
        Row: {
          created_at: string
          details: Json | null
          event: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          event?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      gift_hubs: {
        Row: {
          code: string
          created_at: string
          description: string | null
          group_name: string | null
          is_active: boolean
          kind: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          group_name?: string | null
          is_active?: boolean
          kind: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          group_name?: string | null
          is_active?: boolean
          kind?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      guardian_consent_tokens: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          guardian_email: string
          guardian_name: string | null
          token: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          guardian_email: string
          guardian_name?: string | null
          token?: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          guardian_email?: string
          guardian_name?: string | null
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          created_at: string
          current_weight: string | null
          desired_package: string | null
          email: string
          goal: string | null
          id: string
          message: string | null
          name: string
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_weight?: string | null
          desired_package?: string | null
          email: string
          goal?: string | null
          id?: string
          message?: string | null
          name: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_weight?: string | null
          desired_package?: string | null
          email?: string
          goal?: string | null
          id?: string
          message?: string | null
          name?: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      meal_favorites: {
        Row: {
          created_at: string
          id: string
          meal_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meal_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meal_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_favorites_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "nutrition_plan_meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_interactions: {
        Row: {
          created_at: string
          id: string
          kind: string
          meal_id: string
          meta: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          meal_id: string
          meta?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          meal_id?: string
          meta?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_interactions_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "nutrition_plan_meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          meal_id: string
          stars: number
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          meal_id: string
          stars: number
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          meal_id?: string
          stars?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_ratings_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "nutrition_plan_meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_skips: {
        Row: {
          created_at: string
          id: string
          meal_id: string | null
          meal_name: string | null
          note: string | null
          reason: string
          skip_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meal_id?: string | null
          meal_name?: string | null
          note?: string | null
          reason: string
          skip_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meal_id?: string | null
          meal_name?: string | null
          note?: string | null
          reason?: string
          skip_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_skips_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "nutrition_plan_meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_wishes: {
        Row: {
          applies_to: string
          coach_note: string | null
          consumed_at: string | null
          created_at: string
          for_person: string | null
          id: string
          meal_slot: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
          wish: string
        }
        Insert: {
          applies_to?: string
          coach_note?: string | null
          consumed_at?: string | null
          created_at?: string
          for_person?: string | null
          id?: string
          meal_slot?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
          wish: string
        }
        Update: {
          applies_to?: string
          coach_note?: string | null
          consumed_at?: string | null
          created_at?: string
          for_person?: string | null
          id?: string
          meal_slot?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          wish?: string
        }
        Relationships: []
      }
      nutrition_foods: {
        Row: {
          aliases: string[]
          carbs_per_100g: number
          category: string | null
          citation: string | null
          created_at: string
          created_by: string | null
          default_state: Database["public"]["Enums"]["nutrition_food_state"]
          density_g_per_ml: number | null
          fat_per_100g: number
          fiber_per_100g: number | null
          id: string
          is_active: boolean
          kcal_per_100g: number
          license: string | null
          name: string
          needs_review: boolean
          notes: string | null
          protein_per_100g: number
          review_reason: string | null
          safe_for_smart: boolean
          salt_per_100g: number | null
          source: Database["public"]["Enums"]["nutrition_food_source"]
          source_id: string | null
          source_name: string | null
          sugar_per_100g: number | null
          text_id: string
          unit_type: Database["public"]["Enums"]["nutrition_food_unit"]
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          verified_by_coach: boolean
        }
        Insert: {
          aliases?: string[]
          carbs_per_100g?: number
          category?: string | null
          citation?: string | null
          created_at?: string
          created_by?: string | null
          default_state?: Database["public"]["Enums"]["nutrition_food_state"]
          density_g_per_ml?: number | null
          fat_per_100g?: number
          fiber_per_100g?: number | null
          id?: string
          is_active?: boolean
          kcal_per_100g: number
          license?: string | null
          name: string
          needs_review?: boolean
          notes?: string | null
          protein_per_100g?: number
          review_reason?: string | null
          safe_for_smart?: boolean
          salt_per_100g?: number | null
          source?: Database["public"]["Enums"]["nutrition_food_source"]
          source_id?: string | null
          source_name?: string | null
          sugar_per_100g?: number | null
          text_id: string
          unit_type?: Database["public"]["Enums"]["nutrition_food_unit"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          verified_by_coach?: boolean
        }
        Update: {
          aliases?: string[]
          carbs_per_100g?: number
          category?: string | null
          citation?: string | null
          created_at?: string
          created_by?: string | null
          default_state?: Database["public"]["Enums"]["nutrition_food_state"]
          density_g_per_ml?: number | null
          fat_per_100g?: number
          fiber_per_100g?: number | null
          id?: string
          is_active?: boolean
          kcal_per_100g?: number
          license?: string | null
          name?: string
          needs_review?: boolean
          notes?: string | null
          protein_per_100g?: number
          review_reason?: string | null
          safe_for_smart?: boolean
          salt_per_100g?: number | null
          source?: Database["public"]["Enums"]["nutrition_food_source"]
          source_id?: string | null
          source_name?: string | null
          sugar_per_100g?: number | null
          text_id?: string
          unit_type?: Database["public"]["Enums"]["nutrition_food_unit"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          verified_by_coach?: boolean
        }
        Relationships: []
      }
      nutrition_partners: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          partner_a_name: string | null
          partner_b_name: string | null
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          partner_a_name?: string | null
          partner_b_name?: string | null
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          partner_a_name?: string | null
          partner_b_name?: string | null
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      nutrition_plan_days: {
        Row: {
          created_at: string
          day_date: string | null
          day_type: string | null
          id: string
          name: string
          plan_id: string
          sort_order: number
          week_number: number
        }
        Insert: {
          created_at?: string
          day_date?: string | null
          day_type?: string | null
          id?: string
          name: string
          plan_id: string
          sort_order?: number
          week_number?: number
        }
        Update: {
          created_at?: string
          day_date?: string | null
          day_type?: string | null
          id?: string
          name?: string
          plan_id?: string
          sort_order?: number
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_plan_days_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "nutrition_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_plan_meal_overrides: {
        Row: {
          carbs_g: number | null
          created_at: string
          description: string | null
          fat_g: number | null
          id: string
          kcal: number | null
          name: string
          override_date: string
          plan_meal_id: string
          protein_g: number | null
          source: string | null
          user_id: string
        }
        Insert: {
          carbs_g?: number | null
          created_at?: string
          description?: string | null
          fat_g?: number | null
          id?: string
          kcal?: number | null
          name: string
          override_date: string
          plan_meal_id: string
          protein_g?: number | null
          source?: string | null
          user_id: string
        }
        Update: {
          carbs_g?: number | null
          created_at?: string
          description?: string | null
          fat_g?: number | null
          id?: string
          kcal?: number | null
          name?: string
          override_date?: string
          plan_meal_id?: string
          protein_g?: number | null
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_plan_meal_overrides_plan_meal_id_fkey"
            columns: ["plan_meal_id"]
            isOneToOne: false
            referencedRelation: "nutrition_plan_meals"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_plan_meals: {
        Row: {
          assigned_to: string | null
          carbs_g: number | null
          compute_warnings: string[] | null
          created_at: string
          data_source: string
          day_id: string
          description: string | null
          fat_g: number | null
          id: string
          ingredients_json: Json | null
          is_locked: boolean
          is_shared: boolean
          kcal: number | null
          library_meal_id: string | null
          linked_prep_group: string | null
          meal_slot: Database["public"]["Enums"]["meal_slot_kind"] | null
          name: string
          partner_meal_id: string | null
          protein_g: number | null
          recipe_generated_at: string | null
          recipe_ingredients: string[] | null
          recipe_steps: string[] | null
          sort_order: number
          verified_ratio: number | null
        }
        Insert: {
          assigned_to?: string | null
          carbs_g?: number | null
          compute_warnings?: string[] | null
          created_at?: string
          data_source?: string
          day_id: string
          description?: string | null
          fat_g?: number | null
          id?: string
          ingredients_json?: Json | null
          is_locked?: boolean
          is_shared?: boolean
          kcal?: number | null
          library_meal_id?: string | null
          linked_prep_group?: string | null
          meal_slot?: Database["public"]["Enums"]["meal_slot_kind"] | null
          name: string
          partner_meal_id?: string | null
          protein_g?: number | null
          recipe_generated_at?: string | null
          recipe_ingredients?: string[] | null
          recipe_steps?: string[] | null
          sort_order?: number
          verified_ratio?: number | null
        }
        Update: {
          assigned_to?: string | null
          carbs_g?: number | null
          compute_warnings?: string[] | null
          created_at?: string
          data_source?: string
          day_id?: string
          description?: string | null
          fat_g?: number | null
          id?: string
          ingredients_json?: Json | null
          is_locked?: boolean
          is_shared?: boolean
          kcal?: number | null
          library_meal_id?: string | null
          linked_prep_group?: string | null
          meal_slot?: Database["public"]["Enums"]["meal_slot_kind"] | null
          name?: string
          partner_meal_id?: string | null
          protein_g?: number | null
          recipe_generated_at?: string | null
          recipe_ingredients?: string[] | null
          recipe_steps?: string[] | null
          sort_order?: number
          verified_ratio?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_plan_meals_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "nutrition_plan_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrition_plan_meals_library_meal_id_fkey"
            columns: ["library_meal_id"]
            isOneToOne: false
            referencedRelation: "coach_meal_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrition_plan_meals_partner_meal_id_fkey"
            columns: ["partner_meal_id"]
            isOneToOne: false
            referencedRelation: "nutrition_plan_meals"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_plans: {
        Row: {
          activated_at: string | null
          archived_at: string | null
          carbs_g: number | null
          client_id: string
          created_at: string
          fat_g: number | null
          file_name: string
          file_path: string
          generated_by: string | null
          id: string
          is_active: boolean
          is_partner_plan: boolean
          kcal: number | null
          last_auto_generated_at: string | null
          partner_plan_id: string | null
          plan_type: string
          pre_plan_note: string | null
          protein_g: number | null
          scheduled_activation_date: string | null
          scheduled_end_date: string | null
          scheduled_start_date: string | null
          source: string
          status: string
          title: string
          uploaded_by: string | null
          weeks_count: number
        }
        Insert: {
          activated_at?: string | null
          archived_at?: string | null
          carbs_g?: number | null
          client_id: string
          created_at?: string
          fat_g?: number | null
          file_name: string
          file_path: string
          generated_by?: string | null
          id?: string
          is_active?: boolean
          is_partner_plan?: boolean
          kcal?: number | null
          last_auto_generated_at?: string | null
          partner_plan_id?: string | null
          plan_type?: string
          pre_plan_note?: string | null
          protein_g?: number | null
          scheduled_activation_date?: string | null
          scheduled_end_date?: string | null
          scheduled_start_date?: string | null
          source?: string
          status?: string
          title: string
          uploaded_by?: string | null
          weeks_count?: number
        }
        Update: {
          activated_at?: string | null
          archived_at?: string | null
          carbs_g?: number | null
          client_id?: string
          created_at?: string
          fat_g?: number | null
          file_name?: string
          file_path?: string
          generated_by?: string | null
          id?: string
          is_active?: boolean
          is_partner_plan?: boolean
          kcal?: number | null
          last_auto_generated_at?: string | null
          partner_plan_id?: string | null
          plan_type?: string
          pre_plan_note?: string | null
          protein_g?: number | null
          scheduled_activation_date?: string | null
          scheduled_end_date?: string | null
          scheduled_start_date?: string | null
          source?: string
          status?: string
          title?: string
          uploaded_by?: string | null
          weeks_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_plans_partner_plan_id_fkey"
            columns: ["partner_plan_id"]
            isOneToOne: false
            referencedRelation: "nutrition_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_targets: {
        Row: {
          carbs_g: number
          carbs_g_rest: number | null
          created_at: string
          fat_g: number
          fat_g_rest: number | null
          kcal: number
          kcal_rest: number | null
          protein_g: number
          protein_g_rest: number | null
          updated_at: string
          updated_by: string | null
          user_id: string
          water_glasses: number
        }
        Insert: {
          carbs_g?: number
          carbs_g_rest?: number | null
          created_at?: string
          fat_g?: number
          fat_g_rest?: number | null
          kcal?: number
          kcal_rest?: number | null
          protein_g?: number
          protein_g_rest?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
          water_glasses?: number
        }
        Update: {
          carbs_g?: number
          carbs_g_rest?: number | null
          created_at?: string
          fat_g?: number
          fat_g_rest?: number | null
          kcal?: number
          kcal_rest?: number | null
          protein_g?: number
          protein_g_rest?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          water_glasses?: number
        }
        Relationships: []
      }
      organization_activity_log: {
        Row: {
          created_at: string
          event_type: string
          id: string
          organization_id: string
          payload: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          organization_id: string
          payload?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          organization_id?: string
          payload?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_activity_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_athletic_plan_assignments: {
        Row: {
          active: boolean
          athlete_user_id: string | null
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          plan_id: string
          position: string | null
          scope_type: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          athlete_user_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          plan_id: string
          position?: string | null
          scope_type: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          athlete_user_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          plan_id?: string
          position?: string | null
          scope_type?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_athletic_plan_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_athletic_plan_assignments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "organization_athletic_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_athletic_plan_assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "organization_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_athletic_plan_exercises: {
        Row: {
          created_at: string
          duration_seconds: number | null
          exercise_id: string | null
          id: string
          intensity_target: string | null
          notes: string | null
          order_index: number
          reps: string | null
          rest_seconds: number | null
          rir: number | null
          session_id: string
          sets: number | null
          tempo: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          exercise_id?: string | null
          id?: string
          intensity_target?: string | null
          notes?: string | null
          order_index?: number
          reps?: string | null
          rest_seconds?: number | null
          rir?: number | null
          session_id: string
          sets?: number | null
          tempo?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          exercise_id?: string | null
          id?: string
          intensity_target?: string | null
          notes?: string | null
          order_index?: number
          reps?: string | null
          rest_seconds?: number | null
          rir?: number | null
          session_id?: string
          sets?: number | null
          tempo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_athletic_plan_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "coach_exercise_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_athletic_plan_exercises_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "organization_athletic_plan_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_athletic_plan_sessions: {
        Row: {
          created_at: string
          description: string | null
          estimated_duration_minutes: number | null
          focus_areas: string[]
          id: string
          order_index: number
          plan_id: string
          scheduled_weekdays: number[]
          session_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          estimated_duration_minutes?: number | null
          focus_areas?: string[]
          id?: string
          order_index?: number
          plan_id: string
          scheduled_weekdays?: number[]
          session_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          estimated_duration_minutes?: number | null
          focus_areas?: string[]
          id?: string
          order_index?: number
          plan_id?: string
          scheduled_weekdays?: number[]
          session_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_athletic_plan_sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "organization_athletic_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_athletic_plans: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          focus_areas: string[]
          id: string
          name: string
          organization_id: string
          payload: Json
          position: string | null
          sport: string | null
          start_date: string | null
          status: string
          team_id: string | null
          updated_at: string
          updated_by: string | null
          user_id: string | null
          week_start: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          focus_areas?: string[]
          id?: string
          name: string
          organization_id: string
          payload?: Json
          position?: string | null
          sport?: string | null
          start_date?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
          week_start?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          focus_areas?: string[]
          id?: string
          name?: string
          organization_id?: string
          payload?: Json
          position?: string | null
          sport?: string | null
          start_date?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
          week_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_athletic_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_athletic_plans_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "organization_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_athletic_session_completions: {
        Row: {
          completed_at: string
          created_at: string
          duration_minutes: number | null
          id: string
          notes: string | null
          organization_id: string
          payload: Json
          plan_id: string | null
          rating: number | null
          session_id: string | null
          task_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          organization_id: string
          payload?: Json
          plan_id?: string | null
          rating?: number | null
          session_id?: string | null
          task_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          organization_id?: string
          payload?: Json
          plan_id?: string | null
          rating?: number | null
          session_id?: string | null
          task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_athletic_session_completions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_athletic_session_completions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "organization_athletic_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_athletic_session_completions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "organization_athletic_plan_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_athletic_session_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "organization_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_challenge_point_events: {
        Row: {
          challenge_id: string
          created_at: string
          created_by: string | null
          event_date: string
          id: string
          metadata: Json
          organization_id: string
          points: number
          rule_id: string | null
          source_id: string | null
          source_type: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          created_by?: string | null
          event_date?: string
          id?: string
          metadata?: Json
          organization_id: string
          points: number
          rule_id?: string | null
          source_id?: string | null
          source_type: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          created_by?: string | null
          event_date?: string
          id?: string
          metadata?: Json
          organization_id?: string
          points?: number
          rule_id?: string | null
          source_id?: string | null
          source_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_challenge_point_events_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "organization_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_challenge_point_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_challenge_point_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "organization_challenge_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_challenge_progress: {
        Row: {
          challenge_id: string
          created_at: string
          id: string
          points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          id?: string
          points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          id?: string
          points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_challenge_progress_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "organization_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_challenge_rules: {
        Row: {
          active: boolean
          challenge_id: string
          config: Json
          created_at: string
          description: string | null
          frequency: string
          id: string
          max_per_day: number | null
          max_total: number | null
          points: number
          rule_type: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          challenge_id: string
          config?: Json
          created_at?: string
          description?: string | null
          frequency?: string
          id?: string
          max_per_day?: number | null
          max_total?: number | null
          points?: number
          rule_type: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          challenge_id?: string
          config?: Json
          created_at?: string
          description?: string | null
          frequency?: string
          id?: string
          max_per_day?: number | null
          max_total?: number | null
          points?: number
          rule_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_challenge_rules_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "organization_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_challenges: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          name: string
          organization_id: string
          starts_at: string
          status: string
          team_id: string | null
          updated_at: string
          visibility_scope: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          name: string
          organization_id: string
          starts_at?: string
          status?: string
          team_id?: string | null
          updated_at?: string
          visibility_scope?: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          starts_at?: string
          status?: string
          team_id?: string | null
          updated_at?: string
          visibility_scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_challenges_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_challenges_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "organization_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_community_posts: {
        Row: {
          author_role_snapshot: string
          author_user_id: string
          content: string
          created_at: string
          id: string
          metadata: Json
          organization_id: string
          post_type: string
          status: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          author_role_snapshot?: string
          author_user_id: string
          content: string
          created_at?: string
          id?: string
          metadata?: Json
          organization_id: string
          post_type?: string
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          author_role_snapshot?: string
          author_user_id?: string
          content?: string
          created_at?: string
          id?: string
          metadata?: Json
          organization_id?: string
          post_type?: string
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_community_posts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_community_posts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "organization_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_features: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          feature: string
          id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          feature: string
          id?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          feature?: string
          id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_features_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          assigned_role: Database["public"]["Enums"]["organization_role"]
          created_at: string
          created_by: string | null
          email: string | null
          expires_at: string | null
          id: string
          invite_token: string
          organization_id: string
          permissions: string[]
          status: Database["public"]["Enums"]["organization_invite_status"]
          team_id: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          assigned_role?: Database["public"]["Enums"]["organization_role"]
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          invite_token: string
          organization_id: string
          permissions?: string[]
          status?: Database["public"]["Enums"]["organization_invite_status"]
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          assigned_role?: Database["public"]["Enums"]["organization_role"]
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          invite_token?: string
          organization_id?: string
          permissions?: string[]
          status?: Database["public"]["Enums"]["organization_invite_status"]
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "organization_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          id: string
          joined_at: string
          onboarding_completed: boolean
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          status: Database["public"]["Enums"]["organization_membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string
          onboarding_completed?: boolean
          organization_id: string
          role?: Database["public"]["Enums"]["organization_role"]
          status?: Database["public"]["Enums"]["organization_membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string
          onboarding_completed?: boolean
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_role"]
          status?: Database["public"]["Enums"]["organization_membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_tasks: {
        Row: {
          created_at: string
          duration_min: number | null
          id: string
          link_target: string | null
          organization_id: string
          payload: Json
          points: number | null
          scheduled_date: string | null
          scheduled_for: string
          source_id: string | null
          source_type: string | null
          status: string
          subtitle: string | null
          task_type: string
          team_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_min?: number | null
          id?: string
          link_target?: string | null
          organization_id: string
          payload?: Json
          points?: number | null
          scheduled_date?: string | null
          scheduled_for?: string
          source_id?: string | null
          source_type?: string | null
          status?: string
          subtitle?: string | null
          task_type: string
          team_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_min?: number | null
          id?: string
          link_target?: string | null
          organization_id?: string
          payload?: Json
          points?: number | null
          scheduled_date?: string | null
          scheduled_for?: string
          source_id?: string | null
          source_type?: string | null
          status?: string
          subtitle?: string | null
          task_type?: string
          team_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_tasks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "organization_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_team_training_schedule: {
        Row: {
          active: boolean
          created_at: string
          end_time: string | null
          id: string
          start_time: string | null
          team_id: string
          title: string
          updated_at: string
          weekday: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          end_time?: string | null
          id?: string
          start_time?: string | null
          team_id: string
          title?: string
          updated_at?: string
          weekday: number
        }
        Update: {
          active?: boolean
          created_at?: string
          end_time?: string | null
          id?: string
          start_time?: string | null
          team_id?: string
          title?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_team_training_schedule_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "organization_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_teams: {
        Row: {
          age_group: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
          slug: string
          sport: string | null
          status: Database["public"]["Enums"]["organization_team_status"]
          updated_at: string
        }
        Insert: {
          age_group?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
          slug: string
          sport?: string | null
          status?: Database["public"]["Enums"]["organization_team_status"]
          updated_at?: string
        }
        Update: {
          age_group?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          slug?: string
          sport?: string | null
          status?: Database["public"]["Enums"]["organization_team_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          organization_type: Database["public"]["Enums"]["organization_type"]
          primary_color: string | null
          secondary_color: string | null
          settings: Json
          slug: string
          status: Database["public"]["Enums"]["organization_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          organization_type?: Database["public"]["Enums"]["organization_type"]
          primary_color?: string | null
          secondary_color?: string | null
          settings?: Json
          slug: string
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          organization_type?: Database["public"]["Enums"]["organization_type"]
          primary_color?: string | null
          secondary_color?: string | null
          settings?: Json
          slug?: string
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
        }
        Relationships: []
      }
      package_requests: {
        Row: {
          coach_note: string | null
          created_at: string
          current_package: string | null
          id: string
          note: string | null
          request_type: string
          requested_package: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          coach_note?: string | null
          created_at?: string
          current_package?: string | null
          id?: string
          note?: string | null
          request_type: string
          requested_package?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          coach_note?: string | null
          created_at?: string
          current_package?: string | null
          id?: string
          note?: string | null
          request_type?: string
          requested_package?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_history: {
        Row: {
          amount_eur: number
          created_at: string
          customer_package_id: string | null
          id: string
          method: string
          note: string | null
          payment_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_eur: number
          created_at?: string
          customer_package_id?: string | null
          id?: string
          method?: string
          note?: string | null
          payment_date?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_eur?: number
          created_at?: string
          customer_package_id?: string | null
          id?: string
          method?: string
          note?: string | null
          payment_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_customer_package_id_fkey"
            columns: ["customer_package_id"]
            isOneToOne: false
            referencedRelation: "customer_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_athlete_domain_scores: {
        Row: {
          calculated_at: string
          contributing_metrics: Json
          domain_id: string
          id: string
          organization_id: string
          profile_id: string
          score: number | null
          user_id: string
        }
        Insert: {
          calculated_at?: string
          contributing_metrics?: Json
          domain_id: string
          id?: string
          organization_id: string
          profile_id: string
          score?: number | null
          user_id: string
        }
        Update: {
          calculated_at?: string
          contributing_metrics?: Json
          domain_id?: string
          id?: string
          organization_id?: string
          profile_id?: string
          score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_athlete_domain_scores_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "performance_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_athlete_domain_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_athlete_domain_scores_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "performance_athlete_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_athlete_focus_areas: {
        Row: {
          created_at: string
          created_by: string | null
          domain_id: string | null
          framework_id: string
          id: string
          label: string
          metric_definition_id: string | null
          organization_id: string
          priority: number
          rationale: string | null
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          domain_id?: string | null
          framework_id: string
          id?: string
          label: string
          metric_definition_id?: string | null
          organization_id: string
          priority?: number
          rationale?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          domain_id?: string | null
          framework_id?: string
          id?: string
          label?: string
          metric_definition_id?: string | null
          organization_id?: string
          priority?: number
          rationale?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_athlete_focus_areas_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "performance_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_athlete_focus_areas_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "performance_frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_athlete_focus_areas_metric_definition_id_fkey"
            columns: ["metric_definition_id"]
            isOneToOne: false
            referencedRelation: "performance_metric_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_athlete_focus_areas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_athlete_metric_scores: {
        Row: {
          benchmark_model_id: string | null
          benchmark_version: number | null
          calculated_at: string
          comparison_group: Json
          id: string
          metric_definition_id: string
          organization_id: string
          profile_id: string
          sample_size: number | null
          score: number | null
          selected_value: number | null
          unit: string | null
          user_id: string
        }
        Insert: {
          benchmark_model_id?: string | null
          benchmark_version?: number | null
          calculated_at?: string
          comparison_group?: Json
          id?: string
          metric_definition_id: string
          organization_id: string
          profile_id: string
          sample_size?: number | null
          score?: number | null
          selected_value?: number | null
          unit?: string | null
          user_id: string
        }
        Update: {
          benchmark_model_id?: string | null
          benchmark_version?: number | null
          calculated_at?: string
          comparison_group?: Json
          id?: string
          metric_definition_id?: string
          organization_id?: string
          profile_id?: string
          sample_size?: number | null
          score?: number | null
          selected_value?: number | null
          unit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_athlete_metric_scores_benchmark_model_id_fkey"
            columns: ["benchmark_model_id"]
            isOneToOne: false
            referencedRelation: "performance_benchmark_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_athlete_metric_scores_metric_definition_id_fkey"
            columns: ["metric_definition_id"]
            isOneToOne: false
            referencedRelation: "performance_metric_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_athlete_metric_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_athlete_metric_scores_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "performance_athlete_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_athlete_profiles: {
        Row: {
          benchmark_model_id: string | null
          calculated_at: string
          calculation_version: number
          confidence: string | null
          created_at: string
          data_coverage: number | null
          framework_id: string
          framework_version: number
          id: string
          missing_metrics: Json
          organization_id: string
          overall_score: number | null
          position_profile_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          benchmark_model_id?: string | null
          calculated_at?: string
          calculation_version?: number
          confidence?: string | null
          created_at?: string
          data_coverage?: number | null
          framework_id: string
          framework_version: number
          id?: string
          missing_metrics?: Json
          organization_id: string
          overall_score?: number | null
          position_profile_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          benchmark_model_id?: string | null
          calculated_at?: string
          calculation_version?: number
          confidence?: string | null
          created_at?: string
          data_coverage?: number | null
          framework_id?: string
          framework_version?: number
          id?: string
          missing_metrics?: Json
          organization_id?: string
          overall_score?: number | null
          position_profile_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_athlete_profiles_benchmark_model_id_fkey"
            columns: ["benchmark_model_id"]
            isOneToOne: false
            referencedRelation: "performance_benchmark_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_athlete_profiles_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "performance_frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_athlete_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_athlete_profiles_position_profile_id_fkey"
            columns: ["position_profile_id"]
            isOneToOne: false
            referencedRelation: "performance_position_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_benchmark_models: {
        Row: {
          benchmark_type: string
          config: Json
          created_at: string
          framework_id: string
          id: string
          minimum_sample_size: number
          name: string
          organization_id: string | null
          source_reference: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          benchmark_type: string
          config?: Json
          created_at?: string
          framework_id: string
          id?: string
          minimum_sample_size?: number
          name: string
          organization_id?: string | null
          source_reference?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          benchmark_type?: string
          config?: Json
          created_at?: string
          framework_id?: string
          id?: string
          minimum_sample_size?: number
          name?: string
          organization_id?: string | null
          source_reference?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_benchmark_models_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "performance_frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_benchmark_models_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_domain_metric_weights: {
        Row: {
          active: boolean
          created_at: string
          domain_id: string
          framework_id: string
          id: string
          metric_definition_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          domain_id: string
          framework_id: string
          id?: string
          metric_definition_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          domain_id?: string
          framework_id?: string
          id?: string
          metric_definition_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_domain_metric_weights_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "performance_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_domain_metric_weights_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "performance_frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_domain_metric_weights_metric_definition_id_fkey"
            columns: ["metric_definition_id"]
            isOneToOne: false
            referencedRelation: "performance_metric_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_domains: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          framework_id: string
          id: string
          key: string
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          framework_id: string
          id?: string
          key: string
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          framework_id?: string
          id?: string
          key?: string
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_domains_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "performance_frameworks"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_frameworks: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_template: boolean
          name: string
          organization_id: string | null
          parent_framework_id: string | null
          sport: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_template?: boolean
          name: string
          organization_id?: string | null
          parent_framework_id?: string | null
          sport: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_template?: boolean
          name?: string
          organization_id?: string | null
          parent_framework_id?: string | null
          sport?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_frameworks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_frameworks_parent_framework_id_fkey"
            columns: ["parent_framework_id"]
            isOneToOne: false
            referencedRelation: "performance_frameworks"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_metric_definitions: {
        Row: {
          active: boolean
          calculation_type: string
          config: Json
          created_at: string
          direction: string
          domain_id: string | null
          framework_id: string
          id: string
          key: string
          metric_type: string
          name: string
          order_index: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          calculation_type?: string
          config?: Json
          created_at?: string
          direction?: string
          domain_id?: string | null
          framework_id: string
          id?: string
          key: string
          metric_type?: string
          name: string
          order_index?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          calculation_type?: string
          config?: Json
          created_at?: string
          direction?: string
          domain_id?: string | null
          framework_id?: string
          id?: string
          key?: string
          metric_type?: string
          name?: string
          order_index?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_metric_definitions_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "performance_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_metric_definitions_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "performance_frameworks"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_points: {
        Row: {
          approved: boolean
          created_at: string
          details: Json
          exercise_id: string | null
          exercise_name: string | null
          flagged: boolean
          id: string
          kind: string
          points: number
          training_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          details?: Json
          exercise_id?: string | null
          exercise_name?: string | null
          flagged?: boolean
          id?: string
          kind: string
          points: number
          training_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          details?: Json
          exercise_id?: string | null
          exercise_name?: string | null
          flagged?: boolean
          id?: string
          kind?: string
          points?: number
          training_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_points_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "training_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_position_domain_weights: {
        Row: {
          created_at: string
          domain_id: string
          id: string
          position_profile_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          domain_id: string
          id?: string
          position_profile_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          domain_id?: string
          id?: string
          position_profile_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_position_domain_weights_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "performance_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_position_domain_weights_position_profile_id_fkey"
            columns: ["position_profile_id"]
            isOneToOne: false
            referencedRelation: "performance_position_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_position_profiles: {
        Row: {
          age_group: string | null
          created_at: string
          framework_id: string
          id: string
          organization_id: string | null
          position_group: string | null
          position_key: string
          position_name: string
          sport: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          age_group?: string | null
          created_at?: string
          framework_id: string
          id?: string
          organization_id?: string | null
          position_group?: string | null
          position_key: string
          position_name: string
          sport: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          age_group?: string | null
          created_at?: string
          framework_id?: string
          id?: string
          organization_id?: string | null
          position_group?: string | null
          position_key?: string
          position_name?: string
          sport?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_position_profiles_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "performance_frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_position_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_retest_schedule: {
        Row: {
          auto_created: boolean
          battery_id: string | null
          created_at: string
          id: string
          last_tested_at: string | null
          next_retest_due: string
          organization_id: string
          test_definition_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_created?: boolean
          battery_id?: string | null
          created_at?: string
          id?: string
          last_tested_at?: string | null
          next_retest_due: string
          organization_id: string
          test_definition_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_created?: boolean
          battery_id?: string | null
          created_at?: string
          id?: string
          last_tested_at?: string | null
          next_retest_due?: string
          organization_id?: string
          test_definition_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_retest_schedule_battery_id_fkey"
            columns: ["battery_id"]
            isOneToOne: false
            referencedRelation: "performance_test_batteries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_retest_schedule_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_retest_schedule_test_definition_id_fkey"
            columns: ["test_definition_id"]
            isOneToOne: false
            referencedRelation: "performance_test_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_session_context_snapshots: {
        Row: {
          captured_at: string
          context_key: string
          created_at: string
          id: string
          numeric_value: number | null
          organization_id: string
          session_id: string
          source: string | null
          text_value: string | null
          unit: string | null
          user_id: string
        }
        Insert: {
          captured_at?: string
          context_key: string
          created_at?: string
          id?: string
          numeric_value?: number | null
          organization_id: string
          session_id: string
          source?: string | null
          text_value?: string | null
          unit?: string | null
          user_id: string
        }
        Update: {
          captured_at?: string
          context_key?: string
          created_at?: string
          id?: string
          numeric_value?: number | null
          organization_id?: string
          session_id?: string
          source?: string | null
          text_value?: string | null
          unit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_session_context_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_session_context_snapshots_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "performance_test_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_test_attempts: {
        Row: {
          attempt_number: number
          created_at: string
          entered_by: string | null
          id: string
          invalid_reason: string | null
          measured_at: string
          metadata: Json
          organization_id: string
          raw_value: number
          session_id: string
          test_definition_id: string
          unit_snapshot: string
          user_id: string
          valid: boolean
        }
        Insert: {
          attempt_number?: number
          created_at?: string
          entered_by?: string | null
          id?: string
          invalid_reason?: string | null
          measured_at?: string
          metadata?: Json
          organization_id: string
          raw_value: number
          session_id: string
          test_definition_id: string
          unit_snapshot: string
          user_id: string
          valid?: boolean
        }
        Update: {
          attempt_number?: number
          created_at?: string
          entered_by?: string | null
          id?: string
          invalid_reason?: string | null
          measured_at?: string
          metadata?: Json
          organization_id?: string
          raw_value?: number
          session_id?: string
          test_definition_id?: string
          unit_snapshot?: string
          user_id?: string
          valid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "performance_test_attempts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_test_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "performance_test_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_test_attempts_test_definition_id_fkey"
            columns: ["test_definition_id"]
            isOneToOne: false
            referencedRelation: "performance_test_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_test_batteries: {
        Row: {
          created_at: string
          description: string | null
          framework_id: string
          id: string
          name: string
          organization_id: string | null
          recommended_retest_days: number | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          framework_id: string
          id?: string
          name: string
          organization_id?: string | null
          recommended_retest_days?: number | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          framework_id?: string
          id?: string
          name?: string
          organization_id?: string | null
          recommended_retest_days?: number | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_test_batteries_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "performance_frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_test_batteries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_test_definitions: {
        Row: {
          active: boolean
          battery_id: string
          config: Json
          created_at: string
          decimal_places: number
          description: string | null
          direction: string
          domain_id: string | null
          id: string
          key: string
          name: string
          order_index: number
          protocol: Json
          recommended_retest_days: number | null
          required: boolean
          result_selection: string
          unit: string
          updated_at: string
          value_type: string
        }
        Insert: {
          active?: boolean
          battery_id: string
          config?: Json
          created_at?: string
          decimal_places?: number
          description?: string | null
          direction?: string
          domain_id?: string | null
          id?: string
          key: string
          name: string
          order_index?: number
          protocol?: Json
          recommended_retest_days?: number | null
          required?: boolean
          result_selection?: string
          unit: string
          updated_at?: string
          value_type: string
        }
        Update: {
          active?: boolean
          battery_id?: string
          config?: Json
          created_at?: string
          decimal_places?: number
          description?: string | null
          direction?: string
          domain_id?: string | null
          id?: string
          key?: string
          name?: string
          order_index?: number
          protocol?: Json
          recommended_retest_days?: number | null
          required?: boolean
          result_selection?: string
          unit?: string
          updated_at?: string
          value_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_test_definitions_battery_id_fkey"
            columns: ["battery_id"]
            isOneToOne: false
            referencedRelation: "performance_test_batteries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_test_definitions_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "performance_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_test_session_athletes: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          session_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          session_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          session_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_test_session_athletes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "performance_test_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_test_sessions: {
        Row: {
          battery_id: string
          completed_at: string | null
          completion_notes: string | null
          created_at: string
          created_by: string | null
          entry_mode: string | null
          id: string
          location: string | null
          measurement_method_default: string | null
          mode: string | null
          name: string
          notes: string | null
          organization_id: string
          status: string
          team_id: string | null
          test_date: string
          test_day: string | null
          updated_at: string
        }
        Insert: {
          battery_id: string
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by?: string | null
          entry_mode?: string | null
          id?: string
          location?: string | null
          measurement_method_default?: string | null
          mode?: string | null
          name: string
          notes?: string | null
          organization_id: string
          status?: string
          team_id?: string | null
          test_date: string
          test_day?: string | null
          updated_at?: string
        }
        Update: {
          battery_id?: string
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by?: string | null
          entry_mode?: string | null
          id?: string
          location?: string | null
          measurement_method_default?: string | null
          mode?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          status?: string
          team_id?: string | null
          test_date?: string
          test_day?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_test_sessions_battery_id_fkey"
            columns: ["battery_id"]
            isOneToOne: false
            referencedRelation: "performance_test_batteries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_test_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_test_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "organization_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_assessments: {
        Row: {
          after_date: string
          ai_summary: string | null
          before_date: string | null
          coach_id: string | null
          coach_note: string | null
          created_at: string
          fat_back: string | null
          fat_belly: string | null
          fat_hip: string | null
          id: string
          muscle_arms: string | null
          muscle_back: string | null
          muscle_chest: string | null
          muscle_legs: string | null
          muscle_shoulder: string | null
          overall: string | null
          released_at: string | null
          released_to_client: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          after_date?: string
          ai_summary?: string | null
          before_date?: string | null
          coach_id?: string | null
          coach_note?: string | null
          created_at?: string
          fat_back?: string | null
          fat_belly?: string | null
          fat_hip?: string | null
          id?: string
          muscle_arms?: string | null
          muscle_back?: string | null
          muscle_chest?: string | null
          muscle_legs?: string | null
          muscle_shoulder?: string | null
          overall?: string | null
          released_at?: string | null
          released_to_client?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          after_date?: string
          ai_summary?: string | null
          before_date?: string | null
          coach_id?: string | null
          coach_note?: string | null
          created_at?: string
          fat_back?: string | null
          fat_belly?: string | null
          fat_hip?: string | null
          id?: string
          muscle_arms?: string | null
          muscle_back?: string | null
          muscle_chest?: string | null
          muscle_legs?: string | null
          muscle_shoulder?: string | null
          overall?: string | null
          released_at?: string | null
          released_to_client?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_adjustment_history: {
        Row: {
          after_json: Json | null
          area: string | null
          before_json: Json | null
          client_id: string
          coach_id: string
          created_at: string
          id: string
          kind: string
          rationale: string | null
          summary: string
        }
        Insert: {
          after_json?: Json | null
          area?: string | null
          before_json?: Json | null
          client_id: string
          coach_id: string
          created_at?: string
          id?: string
          kind: string
          rationale?: string | null
          summary: string
        }
        Update: {
          after_json?: Json | null
          area?: string | null
          before_json?: Json | null
          client_id?: string
          coach_id?: string
          created_at?: string
          id?: string
          kind?: string
          rationale?: string | null
          summary?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string
          activity_level: string | null
          athlete_profile_updated_at: string | null
          birthdate: string | null
          cardio_outside_gym: string | null
          checkin_reminder: boolean
          class_days_per_week: number | null
          class_types: string[]
          coaching_goal: string | null
          created_at: string
          daily_step_goal: number
          demo_client_key: string | null
          display_name: string | null
          gender: string | null
          goal_target_date: string | null
          goal_weight_kg: number | null
          guardian_consent_at: string | null
          guardian_consent_docs: Json | null
          guardian_consent_ip: string | null
          guardian_email: string | null
          guardian_name: string | null
          height_cm: number | null
          id: string
          injuries: string | null
          is_minor: boolean
          match_days_per_week: number | null
          mobility_focus: string | null
          mobility_frequency: string | null
          next_checkin_date: string | null
          nickname: string | null
          notifications_enabled: boolean
          phone: string | null
          practice_days_per_week: number | null
          referred_by_partner_id: string | null
          requires_guardian_consent: boolean
          season_phase: string | null
          smart_onboarding_completed_at: string | null
          sport: string | null
          sport_level: string | null
          sport_position: string | null
          sport_weekdays: string[] | null
          team_sport: boolean
          training_experience: string | null
          training_goal: string | null
          trial_end: string | null
          trial_start: string | null
          trial_status: string
          updated_at: string
        }
        Insert: {
          account_status?: string
          activity_level?: string | null
          athlete_profile_updated_at?: string | null
          birthdate?: string | null
          cardio_outside_gym?: string | null
          checkin_reminder?: boolean
          class_days_per_week?: number | null
          class_types?: string[]
          coaching_goal?: string | null
          created_at?: string
          daily_step_goal?: number
          demo_client_key?: string | null
          display_name?: string | null
          gender?: string | null
          goal_target_date?: string | null
          goal_weight_kg?: number | null
          guardian_consent_at?: string | null
          guardian_consent_docs?: Json | null
          guardian_consent_ip?: string | null
          guardian_email?: string | null
          guardian_name?: string | null
          height_cm?: number | null
          id: string
          injuries?: string | null
          is_minor?: boolean
          match_days_per_week?: number | null
          mobility_focus?: string | null
          mobility_frequency?: string | null
          next_checkin_date?: string | null
          nickname?: string | null
          notifications_enabled?: boolean
          phone?: string | null
          practice_days_per_week?: number | null
          referred_by_partner_id?: string | null
          requires_guardian_consent?: boolean
          season_phase?: string | null
          smart_onboarding_completed_at?: string | null
          sport?: string | null
          sport_level?: string | null
          sport_position?: string | null
          sport_weekdays?: string[] | null
          team_sport?: boolean
          training_experience?: string | null
          training_goal?: string | null
          trial_end?: string | null
          trial_start?: string | null
          trial_status?: string
          updated_at?: string
        }
        Update: {
          account_status?: string
          activity_level?: string | null
          athlete_profile_updated_at?: string | null
          birthdate?: string | null
          cardio_outside_gym?: string | null
          checkin_reminder?: boolean
          class_days_per_week?: number | null
          class_types?: string[]
          coaching_goal?: string | null
          created_at?: string
          daily_step_goal?: number
          demo_client_key?: string | null
          display_name?: string | null
          gender?: string | null
          goal_target_date?: string | null
          goal_weight_kg?: number | null
          guardian_consent_at?: string | null
          guardian_consent_docs?: Json | null
          guardian_consent_ip?: string | null
          guardian_email?: string | null
          guardian_name?: string | null
          height_cm?: number | null
          id?: string
          injuries?: string | null
          is_minor?: boolean
          match_days_per_week?: number | null
          mobility_focus?: string | null
          mobility_frequency?: string | null
          next_checkin_date?: string | null
          nickname?: string | null
          notifications_enabled?: boolean
          phone?: string | null
          practice_days_per_week?: number | null
          referred_by_partner_id?: string | null
          requires_guardian_consent?: boolean
          season_phase?: string | null
          smart_onboarding_completed_at?: string | null
          sport?: string | null
          sport_level?: string | null
          sport_position?: string | null
          sport_weekdays?: string[] | null
          team_sport?: boolean
          training_experience?: string | null
          training_goal?: string | null
          trial_end?: string | null
          trial_start?: string | null
          trial_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_partner_id_fkey"
            columns: ["referred_by_partner_id"]
            isOneToOne: false
            referencedRelation: "affiliate_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_photos: {
        Row: {
          created_at: string
          file_path: string
          id: string
          note: string | null
          pose: string
          taken_on: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_path: string
          id?: string
          note?: string | null
          pose: string
          taken_on?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_path?: string
          id?: string
          note?: string | null
          pose?: string
          taken_on?: string
          user_id?: string
        }
        Relationships: []
      }
      shopping_lists: {
        Row: {
          created_at: string
          days: number
          generated_at: string
          items: Json
          partner_user_id: string | null
          plan_id: string
          scope: string
        }
        Insert: {
          created_at?: string
          days?: number
          generated_at?: string
          items?: Json
          partner_user_id?: string | null
          plan_id: string
          scope?: string
        }
        Update: {
          created_at?: string
          days?: number
          generated_at?: string
          items?: Json
          partner_user_id?: string | null
          plan_id?: string
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_lists_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "nutrition_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      smart_autopilot_jobs: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          nutrition_plan_id: string | null
          started_at: string | null
          status: string
          step: string
          training_plan_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          nutrition_plan_id?: string | null
          started_at?: string | null
          status?: string
          step?: string
          training_plan_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          nutrition_plan_id?: string | null
          started_at?: string | null
          status?: string
          step?: string
          training_plan_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      smart_gift_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          days: number
          expires_at: string | null
          hub_code: string
          label: string | null
          max_uses: number
          uses: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          days?: number
          expires_at?: string | null
          hub_code?: string
          label?: string | null
          max_uses?: number
          uses?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          days?: number
          expires_at?: string | null
          hub_code?: string
          label?: string | null
          max_uses?: number
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "smart_gift_codes_hub_code_fkey"
            columns: ["hub_code"]
            isOneToOne: false
            referencedRelation: "gift_hubs"
            referencedColumns: ["code"]
          },
        ]
      }
      smart_gift_redemptions: {
        Row: {
          code: string
          id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          code: string
          id?: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          code?: string
          id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "smart_gift_redemptions_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "smart_gift_codes"
            referencedColumns: ["code"]
          },
        ]
      }
      smart_nutrition_profile: {
        Row: {
          allergies: string[]
          auto_publish: boolean
          auto_publish_training: boolean
          budget_band: string | null
          completed_at: string | null
          created_at: string
          diet_notes: string | null
          diet_style: string | null
          eating_style: string | null
          extra_allergies: string | null
          extra_favorites: string | null
          extra_nogos: string | null
          favorite_foods: string[]
          intolerances: string[] | null
          kitchen_equipment: string[]
          kitchen_equipment_notes: string | null
          meal_prep_days: number | null
          meal_prep_style: string | null
          nogo_foods: string[]
          shopping_day: string | null
          shopping_days: string[]
          shopping_lead_days: number
          training_duration_min: number | null
          training_equipment: string | null
          training_experience: string | null
          training_location: string | null
          training_session_minutes: number | null
          training_weekdays: string[]
          updated_at: string
          user_id: string
          variety_level: string | null
          weekly_budget_eur: number | null
        }
        Insert: {
          allergies?: string[]
          auto_publish?: boolean
          auto_publish_training?: boolean
          budget_band?: string | null
          completed_at?: string | null
          created_at?: string
          diet_notes?: string | null
          diet_style?: string | null
          eating_style?: string | null
          extra_allergies?: string | null
          extra_favorites?: string | null
          extra_nogos?: string | null
          favorite_foods?: string[]
          intolerances?: string[] | null
          kitchen_equipment?: string[]
          kitchen_equipment_notes?: string | null
          meal_prep_days?: number | null
          meal_prep_style?: string | null
          nogo_foods?: string[]
          shopping_day?: string | null
          shopping_days?: string[]
          shopping_lead_days?: number
          training_duration_min?: number | null
          training_equipment?: string | null
          training_experience?: string | null
          training_location?: string | null
          training_session_minutes?: number | null
          training_weekdays?: string[]
          updated_at?: string
          user_id: string
          variety_level?: string | null
          weekly_budget_eur?: number | null
        }
        Update: {
          allergies?: string[]
          auto_publish?: boolean
          auto_publish_training?: boolean
          budget_band?: string | null
          completed_at?: string | null
          created_at?: string
          diet_notes?: string | null
          diet_style?: string | null
          eating_style?: string | null
          extra_allergies?: string | null
          extra_favorites?: string | null
          extra_nogos?: string | null
          favorite_foods?: string[]
          intolerances?: string[] | null
          kitchen_equipment?: string[]
          kitchen_equipment_notes?: string | null
          meal_prep_days?: number | null
          meal_prep_style?: string | null
          nogo_foods?: string[]
          shopping_day?: string | null
          shopping_days?: string[]
          shopping_lead_days?: number
          training_duration_min?: number | null
          training_equipment?: string | null
          training_experience?: string | null
          training_location?: string | null
          training_session_minutes?: number | null
          training_weekdays?: string[]
          updated_at?: string
          user_id?: string
          variety_level?: string | null
          weekly_budget_eur?: number | null
        }
        Relationships: []
      }
      staff_assignments: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          permissions: string[]
          role: Database["public"]["Enums"]["organization_role"]
          team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          permissions?: string[]
          role?: Database["public"]["Enums"]["organization_role"]
          team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          permissions?: string[]
          role?: Database["public"]["Enums"]["organization_role"]
          team_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "organization_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      strength_check_reminders: {
        Row: {
          created_at: string
          due_at: string
          id: string
          kind: Database["public"]["Enums"]["strength_reminder_kind"]
          resolved_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          due_at: string
          id?: string
          kind: Database["public"]["Enums"]["strength_reminder_kind"]
          resolved_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          due_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["strength_reminder_kind"]
          resolved_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      strength_check_results: {
        Row: {
          check_id: string
          created_at: string
          duration_seconds: number | null
          e1rm_kg: number | null
          id: string
          pain_note: string | null
          reps: number | null
          rpe: number | null
          test_key: Database["public"]["Enums"]["strength_test_key"]
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          check_id: string
          created_at?: string
          duration_seconds?: number | null
          e1rm_kg?: number | null
          id?: string
          pain_note?: string | null
          reps?: number | null
          rpe?: number | null
          test_key: Database["public"]["Enums"]["strength_test_key"]
          updated_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          check_id?: string
          created_at?: string
          duration_seconds?: number | null
          e1rm_kg?: number | null
          id?: string
          pain_note?: string | null
          reps?: number | null
          rpe?: number | null
          test_key?: Database["public"]["Enums"]["strength_test_key"]
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "strength_check_results_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "strength_checks"
            referencedColumns: ["id"]
          },
        ]
      }
      strength_checks: {
        Row: {
          bodyweight_kg: number | null
          category_confidence: Json | null
          completed_at: string | null
          created_at: string
          exercise_calcs: Json | null
          id: string
          notes: string | null
          performed_at: string
          score_algorithm_version: number | null
          score_calculated_at: string | null
          score_core: number | null
          score_lower: number | null
          score_pull: number | null
          score_push: number | null
          score_total: number | null
          scoring_bodyweight_kg: number | null
          status: Database["public"]["Enums"]["strength_check_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          bodyweight_kg?: number | null
          category_confidence?: Json | null
          completed_at?: string | null
          created_at?: string
          exercise_calcs?: Json | null
          id?: string
          notes?: string | null
          performed_at?: string
          score_algorithm_version?: number | null
          score_calculated_at?: string | null
          score_core?: number | null
          score_lower?: number | null
          score_pull?: number | null
          score_push?: number | null
          score_total?: number | null
          scoring_bodyweight_kg?: number | null
          status?: Database["public"]["Enums"]["strength_check_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          bodyweight_kg?: number | null
          category_confidence?: Json | null
          completed_at?: string | null
          created_at?: string
          exercise_calcs?: Json | null
          id?: string
          notes?: string | null
          performed_at?: string
          score_algorithm_version?: number | null
          score_calculated_at?: string | null
          score_core?: number | null
          score_lower?: number | null
          score_pull?: number | null
          score_push?: number | null
          score_total?: number | null
          scoring_bodyweight_kg?: number | null
          status?: Database["public"]["Enums"]["strength_check_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      team_memberships: {
        Row: {
          available_training_days: number[] | null
          created_at: string
          gym_access: string | null
          id: string
          jersey_number: number | null
          limitations: string | null
          personal_goal: string | null
          position: string | null
          secondary_position: string | null
          status: Database["public"]["Enums"]["team_membership_status"]
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          available_training_days?: number[] | null
          created_at?: string
          gym_access?: string | null
          id?: string
          jersey_number?: number | null
          limitations?: string | null
          personal_goal?: string | null
          position?: string | null
          secondary_position?: string | null
          status?: Database["public"]["Enums"]["team_membership_status"]
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          available_training_days?: number[] | null
          created_at?: string
          gym_access?: string | null
          id?: string
          jersey_number?: number | null
          limitations?: string | null
          personal_goal?: string | null
          position?: string | null
          secondary_position?: string | null
          status?: Database["public"]["Enums"]["team_membership_status"]
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_memberships_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "organization_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      training_days: {
        Row: {
          created_at: string
          day_date: string | null
          id: string
          name: string
          plan_id: string
          sort_order: number
          week_number: number
        }
        Insert: {
          created_at?: string
          day_date?: string | null
          id?: string
          name: string
          plan_id: string
          sort_order?: number
          week_number?: number
        }
        Update: {
          created_at?: string
          day_date?: string | null
          id?: string
          name?: string
          plan_id?: string
          sort_order?: number
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_days_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "nutrition_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      training_exercise_notes: {
        Row: {
          client_id: string
          created_at: string
          exercise_id: string
          id: string
          note: string
          note_date: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          exercise_id: string
          id?: string
          note?: string
          note_date?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          exercise_id?: string
          id?: string
          note?: string
          note_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_exercise_notes_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "training_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      training_exercises: {
        Row: {
          category: string | null
          created_at: string
          day_id: string
          id: string
          is_locked: boolean
          library_exercise_id: string | null
          linked_partner_group: string | null
          name: string
          notes: string | null
          partner_exercise_id: string | null
          rest_seconds: number | null
          sort_order: number
          target_reps: string | null
          target_rir: number | null
          target_sets: number | null
          target_weights: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          day_id: string
          id?: string
          is_locked?: boolean
          library_exercise_id?: string | null
          linked_partner_group?: string | null
          name: string
          notes?: string | null
          partner_exercise_id?: string | null
          rest_seconds?: number | null
          sort_order?: number
          target_reps?: string | null
          target_rir?: number | null
          target_sets?: number | null
          target_weights?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          day_id?: string
          id?: string
          is_locked?: boolean
          library_exercise_id?: string | null
          linked_partner_group?: string | null
          name?: string
          notes?: string | null
          partner_exercise_id?: string | null
          rest_seconds?: number | null
          sort_order?: number
          target_reps?: string | null
          target_rir?: number | null
          target_sets?: number | null
          target_weights?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_exercises_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "training_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_exercises_library_exercise_id_fkey"
            columns: ["library_exercise_id"]
            isOneToOne: false
            referencedRelation: "coach_exercise_library"
            referencedColumns: ["id"]
          },
        ]
      }
      training_sessions: {
        Row: {
          client_id: string
          created_at: string
          duration_minutes: number | null
          id: string
          intensity: number | null
          name: string
          notes: string | null
          reps: string | null
          session_date: string
          session_type: string
          sets: number | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          client_id: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          intensity?: number | null
          name: string
          notes?: string | null
          reps?: string | null
          session_date?: string
          session_type: string
          sets?: number | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          intensity?: number | null
          name?: string
          notes?: string | null
          reps?: string | null
          session_date?: string
          session_type?: string
          sets?: number | null
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      training_set_logs: {
        Row: {
          client_id: string
          created_at: string
          exercise_id: string
          id: string
          performed_at: string
          reps: number | null
          set_number: number
          weight_kg: number | null
        }
        Insert: {
          client_id: string
          created_at?: string
          exercise_id: string
          id?: string
          performed_at?: string
          reps?: number | null
          set_number: number
          weight_kg?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string
          exercise_id?: string
          id?: string
          performed_at?: string
          reps?: number | null
          set_number?: number
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "training_set_logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "training_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      upgrade_events: {
        Row: {
          created_at: string
          event: string
          from_tier: string | null
          id: string
          source: string | null
          to_tier: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event: string
          from_tier?: string | null
          id?: string
          source?: string | null
          to_tier: string
          user_id: string
        }
        Update: {
          created_at?: string
          event?: string
          from_tier?: string | null
          id?: string
          source?: string | null
          to_tier?: string
          user_id?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_groups: {
        Row: {
          granted_at: string
          group_name: Database["public"]["Enums"]["app_group"]
          id: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          group_name: Database["public"]["Enums"]["app_group"]
          id?: string
          user_id: string
        }
        Update: {
          granted_at?: string
          group_name?: Database["public"]["Enums"]["app_group"]
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_points: {
        Row: {
          created_at: string
          current_streak: number
          daily_points: number
          last_check_date: string | null
          level: number
          longest_streak: number
          performance_points: number
          total_points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          daily_points?: number
          last_check_date?: string | null
          level?: number
          longest_streak?: number
          performance_points?: number
          total_points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          daily_points?: number
          last_check_date?: string | null
          level?: number
          longest_streak?: number
          performance_points?: number
          total_points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      water_logs: {
        Row: {
          created_at: string
          entry_date: string
          glasses: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_date?: string
          glasses?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry_date?: string
          glasses?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_checkins: {
        Row: {
          biceps_left_cm: number | null
          biceps_right_cm: number | null
          body_fat_pct: number | null
          chest_cm: number | null
          coach_notes: string | null
          created_at: string
          energy: number | null
          hip_cm: number | null
          id: string
          mood: number | null
          muscle_mass_kg: number | null
          nutrition_adherence: number | null
          photo_urls: string[]
          sleep_quality: number | null
          struggles: string | null
          submitted_at: string
          thigh_left_cm: number | null
          thigh_right_cm: number | null
          training_adherence: number | null
          updated_at: string
          user_id: string
          waist_cm: number | null
          week_start: string
          weight_kg: number | null
          wins: string | null
        }
        Insert: {
          biceps_left_cm?: number | null
          biceps_right_cm?: number | null
          body_fat_pct?: number | null
          chest_cm?: number | null
          coach_notes?: string | null
          created_at?: string
          energy?: number | null
          hip_cm?: number | null
          id?: string
          mood?: number | null
          muscle_mass_kg?: number | null
          nutrition_adherence?: number | null
          photo_urls?: string[]
          sleep_quality?: number | null
          struggles?: string | null
          submitted_at?: string
          thigh_left_cm?: number | null
          thigh_right_cm?: number | null
          training_adherence?: number | null
          updated_at?: string
          user_id: string
          waist_cm?: number | null
          week_start: string
          weight_kg?: number | null
          wins?: string | null
        }
        Update: {
          biceps_left_cm?: number | null
          biceps_right_cm?: number | null
          body_fat_pct?: number | null
          chest_cm?: number | null
          coach_notes?: string | null
          created_at?: string
          energy?: number | null
          hip_cm?: number | null
          id?: string
          mood?: number | null
          muscle_mass_kg?: number | null
          nutrition_adherence?: number | null
          photo_urls?: string[]
          sleep_quality?: number | null
          struggles?: string | null
          submitted_at?: string
          thigh_left_cm?: number | null
          thigh_right_cm?: number | null
          training_adherence?: number | null
          updated_at?: string
          user_id?: string
          waist_cm?: number | null
          week_start?: string
          weight_kg?: number | null
          wins?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      public_app_reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          first_name: string | null
          id: string | null
          rating: number | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          first_name?: string | null
          id?: string | null
          rating?: number | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          first_name?: string | null
          id?: string | null
          rating?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_organization_invite: {
        Args: { _token: string; _user_id: string }
        Returns: Json
      }
      are_nutrition_partners: {
        Args: { _a: string; _b: string }
        Returns: boolean
      }
      attach_referral: {
        Args: { _slug: string; _user_id: string }
        Returns: undefined
      }
      auto_activate_due_plans: {
        Args: never
        Returns: {
          activated_plan_id: string
          client_id: string
          plan_type: string
        }[]
      }
      compute_macro_targets: { Args: { _user_id: string }; Returns: undefined }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      find_user_id_by_email: { Args: { _email: string }; Returns: string }
      get_ranking: {
        Args: never
        Returns: {
          current_streak: number
          display_name: string
          level: number
          nickname: string
          total_points: number
          user_id: string
          weekly_points: number
        }[]
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_group: {
        Args: {
          _group: Database["public"]["Enums"]["app_group"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_admin: { Args: { _org: string; _user: string }; Returns: boolean }
      is_org_member: { Args: { _org: string; _user: string }; Returns: boolean }
      is_org_staff: {
        Args: { _org: string; _permission?: string; _user: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      nutrition_foods_slugify: { Args: { _name: string }; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recompute_user_points: { Args: { _user_id: string }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_group: "bulls" | "running_team" | "sgz" | "premium"
      app_role: "coach" | "client" | "free"
      bulls_goal: "fat_loss" | "muscle_gain" | "performance" | "general_fitness"
      bulls_position:
        | "QB"
        | "RB"
        | "WR"
        | "TE"
        | "OL"
        | "DL"
        | "LB"
        | "DB"
        | "KP"
        | "COACH"
      meal_budget_level: "low" | "medium" | "high"
      meal_effort_level: "low" | "medium" | "high"
      meal_slot_kind:
        | "breakfast"
        | "lunch"
        | "dinner"
        | "snack"
        | "pre_workout"
        | "post_workout"
      nutrition_food_source:
        | "bls_4_0"
        | "open_food_facts"
        | "usda"
        | "bodyfuel_verified"
        | "ai_estimate"
        | "manual"
      nutrition_food_state: "raw" | "cooked" | "n_a"
      nutrition_food_unit: "raw" | "cooked" | "ml" | "piece"
      organization_invite_status: "pending" | "accepted" | "expired" | "revoked"
      organization_membership_status:
        | "active"
        | "invited"
        | "inactive"
        | "removed"
      organization_role:
        | "athlete"
        | "member"
        | "staff"
        | "coach"
        | "organization_admin"
      organization_status: "active" | "inactive" | "archived"
      organization_team_status: "active" | "inactive" | "archived"
      organization_type: "sports_club" | "team" | "gym" | "company" | "other"
      strength_check_status: "draft" | "completed"
      strength_reminder_kind: "upcoming" | "due"
      strength_test_key:
        | "leg_press"
        | "leg_curl"
        | "chest_press"
        | "shoulder_press"
        | "lat_pulldown"
        | "cable_row"
        | "plank"
      team_membership_status: "active" | "inactive" | "removed"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_group: ["bulls", "running_team", "sgz", "premium"],
      app_role: ["coach", "client", "free"],
      bulls_goal: ["fat_loss", "muscle_gain", "performance", "general_fitness"],
      bulls_position: [
        "QB",
        "RB",
        "WR",
        "TE",
        "OL",
        "DL",
        "LB",
        "DB",
        "KP",
        "COACH",
      ],
      meal_budget_level: ["low", "medium", "high"],
      meal_effort_level: ["low", "medium", "high"],
      meal_slot_kind: [
        "breakfast",
        "lunch",
        "dinner",
        "snack",
        "pre_workout",
        "post_workout",
      ],
      nutrition_food_source: [
        "bls_4_0",
        "open_food_facts",
        "usda",
        "bodyfuel_verified",
        "ai_estimate",
        "manual",
      ],
      nutrition_food_state: ["raw", "cooked", "n_a"],
      nutrition_food_unit: ["raw", "cooked", "ml", "piece"],
      organization_invite_status: ["pending", "accepted", "expired", "revoked"],
      organization_membership_status: [
        "active",
        "invited",
        "inactive",
        "removed",
      ],
      organization_role: [
        "athlete",
        "member",
        "staff",
        "coach",
        "organization_admin",
      ],
      organization_status: ["active", "inactive", "archived"],
      organization_team_status: ["active", "inactive", "archived"],
      organization_type: ["sports_club", "team", "gym", "company", "other"],
      strength_check_status: ["draft", "completed"],
      strength_reminder_kind: ["upcoming", "due"],
      strength_test_key: [
        "leg_press",
        "leg_curl",
        "chest_press",
        "shoulder_press",
        "lat_pulldown",
        "cable_row",
        "plank",
      ],
      team_membership_status: ["active", "inactive", "removed"],
    },
  },
} as const

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
      customer_packages: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          notes: string | null
          package: string
          price_eur: number
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          notes?: string | null
          package: string
          price_eur: number
          start_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          package?: string
          price_eur?: number
          start_date?: string
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
          points: number
          tasks: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          check_date: string
          created_at?: string
          id?: string
          points?: number
          tasks?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          check_date?: string
          created_at?: string
          id?: string
          points?: number
          tasks?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      nutrition_plan_days: {
        Row: {
          created_at: string
          id: string
          name: string
          plan_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan_id?: string
          sort_order?: number
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
      nutrition_plan_meals: {
        Row: {
          carbs_g: number | null
          created_at: string
          day_id: string
          description: string | null
          fat_g: number | null
          id: string
          kcal: number | null
          name: string
          protein_g: number | null
          sort_order: number
        }
        Insert: {
          carbs_g?: number | null
          created_at?: string
          day_id: string
          description?: string | null
          fat_g?: number | null
          id?: string
          kcal?: number | null
          name: string
          protein_g?: number | null
          sort_order?: number
        }
        Update: {
          carbs_g?: number | null
          created_at?: string
          day_id?: string
          description?: string | null
          fat_g?: number | null
          id?: string
          kcal?: number | null
          name?: string
          protein_g?: number | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_plan_meals_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "nutrition_plan_days"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_plans: {
        Row: {
          client_id: string
          created_at: string
          file_name: string
          file_path: string
          id: string
          is_active: boolean
          plan_type: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          is_active?: boolean
          plan_type?: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          is_active?: boolean
          plan_type?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: []
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
      profiles: {
        Row: {
          activity_level: string | null
          birthdate: string | null
          checkin_reminder: boolean
          coaching_goal: string | null
          created_at: string
          demo_client_key: string | null
          display_name: string | null
          gender: string | null
          goal_weight_kg: number | null
          height_cm: number | null
          id: string
          next_checkin_date: string | null
          notifications_enabled: boolean
          phone: string | null
          trial_end: string | null
          trial_start: string | null
          trial_status: string
          updated_at: string
        }
        Insert: {
          activity_level?: string | null
          birthdate?: string | null
          checkin_reminder?: boolean
          coaching_goal?: string | null
          created_at?: string
          demo_client_key?: string | null
          display_name?: string | null
          gender?: string | null
          goal_weight_kg?: number | null
          height_cm?: number | null
          id: string
          next_checkin_date?: string | null
          notifications_enabled?: boolean
          phone?: string | null
          trial_end?: string | null
          trial_start?: string | null
          trial_status?: string
          updated_at?: string
        }
        Update: {
          activity_level?: string | null
          birthdate?: string | null
          checkin_reminder?: boolean
          coaching_goal?: string | null
          created_at?: string
          demo_client_key?: string | null
          display_name?: string | null
          gender?: string | null
          goal_weight_kg?: number | null
          height_cm?: number | null
          id?: string
          next_checkin_date?: string | null
          notifications_enabled?: boolean
          phone?: string | null
          trial_end?: string | null
          trial_start?: string | null
          trial_status?: string
          updated_at?: string
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
      training_days: {
        Row: {
          created_at: string
          id: string
          name: string
          plan_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan_id?: string
          sort_order?: number
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
      training_exercises: {
        Row: {
          created_at: string
          day_id: string
          id: string
          name: string
          notes: string | null
          sort_order: number
          target_reps: string | null
          target_sets: number | null
        }
        Insert: {
          created_at?: string
          day_id: string
          id?: string
          name: string
          notes?: string | null
          sort_order?: number
          target_reps?: string | null
          target_sets?: number | null
        }
        Update: {
          created_at?: string
          day_id?: string
          id?: string
          name?: string
          notes?: string | null
          sort_order?: number
          target_reps?: string | null
          target_sets?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "training_exercises_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "training_days"
            referencedColumns: ["id"]
          },
        ]
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
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
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
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recompute_user_points: { Args: { _user_id: string }; Returns: undefined }
    }
    Enums: {
      app_group: "bulls" | "running_team" | "sgz" | "premium"
      app_role: "coach" | "client"
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
      app_role: ["coach", "client"],
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
    },
  },
} as const

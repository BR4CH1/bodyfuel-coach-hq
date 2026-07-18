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
          discount_code: string | null
          discount_pct: number | null
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
          discount_code?: string | null
          discount_pct?: number | null
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
          discount_code?: string | null
          discount_pct?: number | null
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
          action_decisions: Json
          client_id: string
          coach_id: string
          created_at: string
          decided_at: string | null
          draft: Json
          generated_at: string
          id: string
          message_final: string | null
          published_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          action_decisions?: Json
          client_id: string
          coach_id: string
          created_at?: string
          decided_at?: string | null
          draft: Json
          generated_at?: string
          id?: string
          message_final?: string | null
          published_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          action_decisions?: Json
          client_id?: string
          coach_id?: string
          created_at?: string
          decided_at?: string | null
          draft?: Json
          generated_at?: string
          id?: string
          message_final?: string | null
          published_at?: string | null
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
      athlete_checkins: {
        Row: {
          checkin_date: string
          created_at: string
          energy: number | null
          id: string
          notes: string | null
          organization_id: string | null
          pain_level: number | null
          pain_note: string | null
          sleep: number | null
          stress: number | null
          training_feel: number | null
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          checkin_date?: string
          created_at?: string
          energy?: number | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          pain_level?: number | null
          pain_note?: string | null
          sleep?: number | null
          stress?: number | null
          training_feel?: number | null
          updated_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          checkin_date?: string
          created_at?: string
          energy?: number | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          pain_level?: number | null
          pain_note?: string | null
          sleep?: number | null
          stress?: number | null
          training_feel?: number | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_checkins_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_exercise_state: {
        Row: {
          confidence: string
          created_at: string
          current_working_load: number | null
          exercise_key: string
          exercise_name: string
          failed_sessions: number
          id: string
          last_completed_at: string | null
          last_decision: string | null
          last_reason: string | null
          pain_flag: boolean
          progression_status: string
          recommended_next_load: number | null
          successful_sessions: number
          target_rep_max: number | null
          target_rep_min: number | null
          trend: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: string
          created_at?: string
          current_working_load?: number | null
          exercise_key: string
          exercise_name: string
          failed_sessions?: number
          id?: string
          last_completed_at?: string | null
          last_decision?: string | null
          last_reason?: string | null
          pain_flag?: boolean
          progression_status?: string
          recommended_next_load?: number | null
          successful_sessions?: number
          target_rep_max?: number | null
          target_rep_min?: number | null
          trend?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: string
          created_at?: string
          current_working_load?: number | null
          exercise_key?: string
          exercise_name?: string
          failed_sessions?: number
          id?: string
          last_completed_at?: string | null
          last_decision?: string | null
          last_reason?: string | null
          pain_flag?: boolean
          progression_status?: string
          recommended_next_load?: number | null
          successful_sessions?: number
          target_rep_max?: number | null
          target_rep_min?: number | null
          trend?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      athlete_nutrition_schedule: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          nutrition_plan_id: string | null
          team_id: string | null
          title: string
          updated_at: string
          user_id: string
          weekday: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          nutrition_plan_id?: string | null
          team_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
          weekday: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          nutrition_plan_id?: string | null
          team_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "athlete_nutrition_schedule_nutrition_plan_id_fkey"
            columns: ["nutrition_plan_id"]
            isOneToOne: false
            referencedRelation: "nutrition_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_nutrition_schedule_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "organization_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_training_schedule: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          end_time: string | null
          id: string
          start_time: string | null
          team_id: string | null
          title: string
          updated_at: string
          user_id: string
          weekday: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          end_time?: string | null
          id?: string
          start_time?: string | null
          team_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
          weekday: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          end_time?: string | null
          id?: string
          start_time?: string | null
          team_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "athlete_training_schedule_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "organization_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_training_session: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_min: number | null
          exercises: Json
          focus: string
          id: string
          is_rehab: boolean
          organization_id: string
          position_code: string | null
          progress: Json
          session_date: string
          source_week_session_id: string
          status: string
          team_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_min?: number | null
          exercises?: Json
          focus: string
          id?: string
          is_rehab?: boolean
          organization_id: string
          position_code?: string | null
          progress?: Json
          session_date: string
          source_week_session_id: string
          status?: string
          team_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_min?: number | null
          exercises?: Json
          focus?: string
          id?: string
          is_rehab?: boolean
          organization_id?: string
          position_code?: string | null
          progress?: Json
          session_date?: string
          source_week_session_id?: string
          status?: string
          team_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_training_session_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_training_session_source_week_session_id_fkey"
            columns: ["source_week_session_id"]
            isOneToOne: false
            referencedRelation: "org_team_training_week_session"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_training_session_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "organization_teams"
            referencedColumns: ["id"]
          },
        ]
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
      bulls_monthly_finalizations: {
        Row: {
          created_at: string
          finalized_at: string
          id: string
          month: number
          organization_id: string
          participant_count: number
          status: string
          winner_points: number | null
          winner_user_id: string | null
          year: number
        }
        Insert: {
          created_at?: string
          finalized_at?: string
          id?: string
          month: number
          organization_id: string
          participant_count?: number
          status?: string
          winner_points?: number | null
          winner_user_id?: string | null
          year: number
        }
        Update: {
          created_at?: string
          finalized_at?: string
          id?: string
          month?: number
          organization_id?: string
          participant_count?: number
          status?: string
          winner_points?: number | null
          winner_user_id?: string | null
          year?: number
        }
        Relationships: []
      }
      bulls_monthly_standings: {
        Row: {
          active_days: number
          check_in_completion_rate: number
          check_in_days: number
          completed_trainings: number
          created_at: string
          final_points: number
          id: string
          metadata: Json
          month: number
          organization_id: string
          plan_completion_rate: number
          planned_trainings: number
          rank: number
          user_id: string
          year: number
        }
        Insert: {
          active_days?: number
          check_in_completion_rate?: number
          check_in_days?: number
          completed_trainings?: number
          created_at?: string
          final_points?: number
          id?: string
          metadata?: Json
          month: number
          organization_id: string
          plan_completion_rate?: number
          planned_trainings?: number
          rank: number
          user_id: string
          year: number
        }
        Update: {
          active_days?: number
          check_in_completion_rate?: number
          check_in_days?: number
          completed_trainings?: number
          created_at?: string
          final_points?: number
          id?: string
          metadata?: Json
          month?: number
          organization_id?: string
          plan_completion_rate?: number
          planned_trainings?: number
          rank?: number
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      bulls_performance_tests: {
        Row: {
          bodyweight_kg: number | null
          coach_corrected_value: number | null
          coach_note: string | null
          created_at: string
          footwear: string | null
          id: string
          measurement_method: string | null
          module_id: string
          performance_profile: string
          performed_at: string
          position_snapshot: string | null
          rejection_reason: string | null
          reps: number | null
          result_unit: string
          result_value: number
          rir: number | null
          surface: string | null
          test_id: string
          updated_at: string
          user_id: string
          variant: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
          video_path: string | null
          video_uploaded_at: string | null
        }
        Insert: {
          bodyweight_kg?: number | null
          coach_corrected_value?: number | null
          coach_note?: string | null
          created_at?: string
          footwear?: string | null
          id?: string
          measurement_method?: string | null
          module_id: string
          performance_profile?: string
          performed_at?: string
          position_snapshot?: string | null
          rejection_reason?: string | null
          reps?: number | null
          result_unit: string
          result_value: number
          rir?: number | null
          surface?: string | null
          test_id: string
          updated_at?: string
          user_id: string
          variant?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
          video_path?: string | null
          video_uploaded_at?: string | null
        }
        Update: {
          bodyweight_kg?: number | null
          coach_corrected_value?: number | null
          coach_note?: string | null
          created_at?: string
          footwear?: string | null
          id?: string
          measurement_method?: string | null
          module_id?: string
          performance_profile?: string
          performed_at?: string
          position_snapshot?: string | null
          rejection_reason?: string | null
          reps?: number | null
          result_unit?: string
          result_value?: number
          rir?: number | null
          surface?: string | null
          test_id?: string
          updated_at?: string
          user_id?: string
          variant?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
          video_path?: string | null
          video_uploaded_at?: string | null
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
      bulls_ranking_events: {
        Row: {
          awarded_by: string | null
          category: Database["public"]["Enums"]["bulls_point_category"]
          created_at: string
          event_date: string
          event_kind: string
          id: string
          metadata: Json
          organization_id: string
          points: number
          reason: string | null
          reversed_by_event_id: string | null
          source_id: string | null
          source_type: string | null
          status: string
          team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          awarded_by?: string | null
          category: Database["public"]["Enums"]["bulls_point_category"]
          created_at?: string
          event_date: string
          event_kind: string
          id?: string
          metadata?: Json
          organization_id: string
          points: number
          reason?: string | null
          reversed_by_event_id?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          awarded_by?: string | null
          category?: Database["public"]["Enums"]["bulls_point_category"]
          created_at?: string
          event_date?: string
          event_kind?: string
          id?: string
          metadata?: Json
          organization_id?: string
          points?: number
          reason?: string | null
          reversed_by_event_id?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulls_ranking_events_reversed_by_event_id_fkey"
            columns: ["reversed_by_event_id"]
            isOneToOne: false
            referencedRelation: "bulls_ranking_events"
            referencedColumns: ["id"]
          },
        ]
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
      coach_athlete_notes: {
        Row: {
          athlete_user_id: string
          author_user_id: string
          body: string
          created_at: string
          id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          athlete_user_id: string
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          athlete_user_id?: string
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_athlete_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      course_attendance: {
        Row: {
          created_at: string
          id: string
          note: string | null
          owner_id: string
          participant_id: string
          present: boolean
          session_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          owner_id: string
          participant_id: string
          present?: boolean
          session_date?: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          owner_id?: string
          participant_id?: string
          present?: boolean
          session_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_attendance_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "course_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      course_exercises: {
        Row: {
          coaching_cues: string | null
          created_at: string
          description: string | null
          difficulty: string
          equipment: string[]
          id: string
          is_favorite: boolean
          is_public: boolean
          media_url: string | null
          muscle_groups: string[]
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          coaching_cues?: string | null
          created_at?: string
          description?: string | null
          difficulty?: string
          equipment?: string[]
          id?: string
          is_favorite?: boolean
          is_public?: boolean
          media_url?: string | null
          muscle_groups?: string[]
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          coaching_cues?: string | null
          created_at?: string
          description?: string | null
          difficulty?: string
          equipment?: string[]
          id?: string
          is_favorite?: boolean
          is_public?: boolean
          media_url?: string | null
          muscle_groups?: string[]
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      course_music_links: {
        Row: {
          bpm: number | null
          created_at: string
          id: string
          is_favorite: boolean
          owner_id: string
          provider: string
          tags: string[]
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          bpm?: number | null
          created_at?: string
          id?: string
          is_favorite?: boolean
          owner_id: string
          provider?: string
          tags?: string[]
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          bpm?: number | null
          created_at?: string
          id?: string
          is_favorite?: boolean
          owner_id?: string
          provider?: string
          tags?: string[]
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      course_participants: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      course_templates: {
        Row: {
          blocks: Json
          created_at: string
          description: string | null
          duration_minutes: number | null
          equipment: string[]
          id: string
          is_favorite: boolean
          name: string
          owner_id: string
          target_group: string | null
          updated_at: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          equipment?: string[]
          id?: string
          is_favorite?: boolean
          name: string
          owner_id: string
          target_group?: string | null
          updated_at?: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          equipment?: string[]
          id?: string
          is_favorite?: boolean
          name?: string
          owner_id?: string
          target_group?: string | null
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
          session_intensity: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_date: string
          kind: string
          session_intensity?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry_date?: string
          kind?: string
          session_intensity?: string | null
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
      food_alias_learning: {
        Row: {
          created_at: string
          food_id: string
          id: string
          normalized_term: string
          user_id: string
        }
        Insert: {
          created_at?: string
          food_id: string
          id?: string
          normalized_term: string
          user_id: string
        }
        Update: {
          created_at?: string
          food_id?: string
          id?: string
          normalized_term?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_alias_learning_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "nutrition_foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_alias_learning_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "nutrition_foods_public"
            referencedColumns: ["id"]
          },
        ]
      }
      food_aliases: {
        Row: {
          alias: string
          alias_normalized: string | null
          food_id: number
          id: number
          language_code: string | null
        }
        Insert: {
          alias: string
          alias_normalized?: string | null
          food_id: number
          id?: number
          language_code?: string | null
        }
        Update: {
          alias?: string
          alias_normalized?: string | null
          food_id?: number
          id?: number
          language_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "food_aliases_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_aliases_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods_search"
            referencedColumns: ["id"]
          },
        ]
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
      food_library_favorites: {
        Row: {
          central_food_id: number | null
          created_at: string
          food_kind: string
          id: string
          user_food_id: string | null
          user_id: string
        }
        Insert: {
          central_food_id?: number | null
          created_at?: string
          food_kind: string
          id?: string
          user_food_id?: string | null
          user_id: string
        }
        Update: {
          central_food_id?: number | null
          created_at?: string
          food_kind?: string
          id?: string
          user_food_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_library_favorites_central_food_id_fkey"
            columns: ["central_food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_library_favorites_central_food_id_fkey"
            columns: ["central_food_id"]
            isOneToOne: false
            referencedRelation: "foods_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_library_favorites_user_food_id_fkey"
            columns: ["user_food_id"]
            isOneToOne: false
            referencedRelation: "user_foods"
            referencedColumns: ["id"]
          },
        ]
      }
      food_nutrients: {
        Row: {
          amount_per_100g: number | null
          food_id: number
          nutrient_id: number
          source_value: string | null
          unit: string
        }
        Insert: {
          amount_per_100g?: number | null
          food_id: number
          nutrient_id: number
          source_value?: string | null
          unit: string
        }
        Update: {
          amount_per_100g?: number | null
          food_id?: number
          nutrient_id?: number
          source_value?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_nutrients_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_nutrients_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_nutrients_nutrient_id_fkey"
            columns: ["nutrient_id"]
            isOneToOne: false
            referencedRelation: "nutrients"
            referencedColumns: ["id"]
          },
        ]
      }
      food_translations: {
        Row: {
          created_at: string
          food_id: number
          id: number
          language_code: string
          name: string
          name_normalized: string | null
        }
        Insert: {
          created_at?: string
          food_id: number
          id?: number
          language_code: string
          name: string
          name_normalized?: string | null
        }
        Update: {
          created_at?: string
          food_id?: number
          id?: number
          language_code?: string
          name?: string
          name_normalized?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "food_translations_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_translations_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods_search"
            referencedColumns: ["id"]
          },
        ]
      }
      food_usage: {
        Row: {
          central_food_id: number | null
          food_kind: string
          last_used_at: string
          use_count: number
          user_food_id: string | null
          user_id: string
        }
        Insert: {
          central_food_id?: number | null
          food_kind: string
          last_used_at?: string
          use_count?: number
          user_food_id?: string | null
          user_id: string
        }
        Update: {
          central_food_id?: number | null
          food_kind?: string
          last_used_at?: string
          use_count?: number
          user_food_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_usage_central_food_id_fkey"
            columns: ["central_food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_usage_central_food_id_fkey"
            columns: ["central_food_id"]
            isOneToOne: false
            referencedRelation: "foods_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_usage_user_food_id_fkey"
            columns: ["user_food_id"]
            isOneToOne: false
            referencedRelation: "user_foods"
            referencedColumns: ["id"]
          },
        ]
      }
      food_versions: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          created_at: string
          food_id: number
          id: number
          snapshot: Json
          version: number
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          food_id: number
          id?: number
          snapshot: Json
          version: number
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          food_id?: number
          id?: number
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "food_versions_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_versions_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods_search"
            referencedColumns: ["id"]
          },
        ]
      }
      foods: {
        Row: {
          allergens: Json | null
          barcode: string | null
          brand: string | null
          carbohydrates_g: number | null
          category: string | null
          country_codes: string[] | null
          data_basis: string | null
          fat_g: number | null
          fiber_g: number | null
          id: number
          imported_at: string
          ingredients: Json | null
          ingredients_text: string | null
          is_active: boolean
          is_bodyfuel_verified: boolean
          is_verified: boolean
          kcal: number | null
          language_code: string | null
          micronutrients: Json | null
          name: string
          name_normalized: string | null
          popularity: number
          protein_g: number | null
          quality_score: number | null
          raw_data: Json | null
          salt_g: number | null
          saturated_fat_g: number | null
          serving_size_g: number | null
          sodium_mg: number | null
          source: string
          source_id: string
          source_updated_at: string | null
          sugar_g: number | null
          updated_at: string
        }
        Insert: {
          allergens?: Json | null
          barcode?: string | null
          brand?: string | null
          carbohydrates_g?: number | null
          category?: string | null
          country_codes?: string[] | null
          data_basis?: string | null
          fat_g?: number | null
          fiber_g?: number | null
          id?: number
          imported_at?: string
          ingredients?: Json | null
          ingredients_text?: string | null
          is_active?: boolean
          is_bodyfuel_verified?: boolean
          is_verified?: boolean
          kcal?: number | null
          language_code?: string | null
          micronutrients?: Json | null
          name: string
          name_normalized?: string | null
          popularity?: number
          protein_g?: number | null
          quality_score?: number | null
          raw_data?: Json | null
          salt_g?: number | null
          saturated_fat_g?: number | null
          serving_size_g?: number | null
          sodium_mg?: number | null
          source: string
          source_id: string
          source_updated_at?: string | null
          sugar_g?: number | null
          updated_at?: string
        }
        Update: {
          allergens?: Json | null
          barcode?: string | null
          brand?: string | null
          carbohydrates_g?: number | null
          category?: string | null
          country_codes?: string[] | null
          data_basis?: string | null
          fat_g?: number | null
          fiber_g?: number | null
          id?: number
          imported_at?: string
          ingredients?: Json | null
          ingredients_text?: string | null
          is_active?: boolean
          is_bodyfuel_verified?: boolean
          is_verified?: boolean
          kcal?: number | null
          language_code?: string | null
          micronutrients?: Json | null
          name?: string
          name_normalized?: string | null
          popularity?: number
          protein_g?: number | null
          quality_score?: number | null
          raw_data?: Json | null
          salt_g?: number | null
          saturated_fat_g?: number | null
          serving_size_g?: number | null
          sodium_mg?: number | null
          source?: string
          source_id?: string
          source_updated_at?: string | null
          sugar_g?: number | null
          updated_at?: string
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
      fuely_action_log: {
        Row: {
          action_type: string
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          organization_id: string | null
          source: string
          status: string
          summary: string | null
          target_id: string | null
          target_table: string | null
          undo_until: string | null
          undone_at: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          organization_id?: string | null
          source?: string
          status?: string
          summary?: string | null
          target_id?: string | null
          target_table?: string | null
          undo_until?: string | null
          undone_at?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          organization_id?: string | null
          source?: string
          status?: string
          summary?: string | null
          target_id?: string | null
          target_table?: string | null
          undo_until?: string | null
          undone_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fuely_daily_notes: {
        Row: {
          content: string
          created_at: string
          data_snapshot: Json | null
          id: string
          kind: string
          note_date: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          data_snapshot?: Json | null
          id?: string
          kind: string
          note_date?: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          data_snapshot?: Json | null
          id?: string
          kind?: string
          note_date?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fuely_memories: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          importance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          importance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          importance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fuely_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      fuely_timeline_events: {
        Row: {
          category: string | null
          coach_visible: boolean
          created_at: string
          cta_href: string | null
          cta_label: string | null
          event_type: string
          icon: string | null
          id: string
          metadata: Json
          occurred_at: string
          summary: string | null
          title: string
          user_id: string
        }
        Insert: {
          category?: string | null
          coach_visible?: boolean
          created_at?: string
          cta_href?: string | null
          cta_label?: string | null
          event_type: string
          icon?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          summary?: string | null
          title: string
          user_id: string
        }
        Update: {
          category?: string | null
          coach_visible?: boolean
          created_at?: string
          cta_href?: string | null
          cta_label?: string | null
          event_type?: string
          icon?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          summary?: string | null
          title?: string
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
      import_runs: {
        Row: {
          finished_at: string | null
          id: number
          notes: string | null
          rows_imported: number | null
          rows_read: number | null
          rows_rejected: number | null
          source: string
          started_at: string
          status: string
        }
        Insert: {
          finished_at?: string | null
          id?: number
          notes?: string | null
          rows_imported?: number | null
          rows_read?: number | null
          rows_rejected?: number | null
          source: string
          started_at?: string
          status?: string
        }
        Update: {
          finished_at?: string | null
          id?: number
          notes?: string | null
          rows_imported?: number | null
          rows_read?: number | null
          rows_rejected?: number | null
          source?: string
          started_at?: string
          status?: string
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
      nutrients: {
        Row: {
          canonical_code: string
          default_unit: string
          id: number
          name_de: string
          name_en: string | null
        }
        Insert: {
          canonical_code: string
          default_unit: string
          id?: number
          name_de: string
          name_en?: string | null
        }
        Update: {
          canonical_code?: string
          default_unit?: string
          id?: number
          name_de?: string
          name_en?: string | null
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
          modification_source: string | null
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
          modification_source?: string | null
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
          modification_source?: string | null
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
          organization_id: string | null
          partner_plan_id: string | null
          performance_context: boolean
          plan_type: string
          pre_plan_note: string | null
          protein_g: number | null
          scheduled_activation_date: string | null
          scheduled_end_date: string | null
          scheduled_start_date: string | null
          source: string
          source_template_id: string | null
          source_template_version_id: string | null
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
          organization_id?: string | null
          partner_plan_id?: string | null
          performance_context?: boolean
          plan_type?: string
          pre_plan_note?: string | null
          protein_g?: number | null
          scheduled_activation_date?: string | null
          scheduled_end_date?: string | null
          scheduled_start_date?: string | null
          source?: string
          source_template_id?: string | null
          source_template_version_id?: string | null
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
          organization_id?: string | null
          partner_plan_id?: string | null
          performance_context?: boolean
          plan_type?: string
          pre_plan_note?: string | null
          protein_g?: number | null
          scheduled_activation_date?: string | null
          scheduled_end_date?: string | null
          scheduled_start_date?: string | null
          source?: string
          source_template_id?: string | null
          source_template_version_id?: string | null
          status?: string
          title?: string
          uploaded_by?: string | null
          weeks_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrition_plans_partner_plan_id_fkey"
            columns: ["partner_plan_id"]
            isOneToOne: false
            referencedRelation: "nutrition_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrition_plans_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "training_plan_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrition_plans_source_template_version_id_fkey"
            columns: ["source_template_version_id"]
            isOneToOne: false
            referencedRelation: "training_template_versions"
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
      org_group_nutrition_schedule: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          nutrition_plan_id: string | null
          position_group: string
          team_id: string
          title: string
          updated_at: string
          weekday: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          nutrition_plan_id?: string | null
          position_group: string
          team_id: string
          title?: string
          updated_at?: string
          weekday: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          nutrition_plan_id?: string | null
          position_group?: string
          team_id?: string
          title?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_group_nutrition_schedule_nutrition_plan_id_fkey"
            columns: ["nutrition_plan_id"]
            isOneToOne: false
            referencedRelation: "nutrition_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_group_nutrition_schedule_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "organization_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      org_group_training_schedule: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          end_time: string | null
          id: string
          position_group: string
          start_time: string | null
          team_id: string
          title: string
          updated_at: string
          weekday: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          end_time?: string | null
          id?: string
          position_group: string
          start_time?: string | null
          team_id: string
          title?: string
          updated_at?: string
          weekday: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          end_time?: string | null
          id?: string
          position_group?: string
          start_time?: string | null
          team_id?: string
          title?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_group_training_schedule_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "organization_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      org_monthly_finalizations: {
        Row: {
          created_at: string
          finalized_at: string
          id: string
          month: number
          organization_id: string
          participant_count: number
          status: string
          winner_points: number | null
          winner_user_id: string | null
          year: number
        }
        Insert: {
          created_at?: string
          finalized_at?: string
          id?: string
          month: number
          organization_id: string
          participant_count?: number
          status?: string
          winner_points?: number | null
          winner_user_id?: string | null
          year: number
        }
        Update: {
          created_at?: string
          finalized_at?: string
          id?: string
          month?: number
          organization_id?: string
          participant_count?: number
          status?: string
          winner_points?: number | null
          winner_user_id?: string | null
          year?: number
        }
        Relationships: []
      }
      org_monthly_standings: {
        Row: {
          active_days: number
          check_in_completion_rate: number
          check_in_days: number
          completed_trainings: number
          created_at: string
          final_points: number
          id: string
          metadata: Json
          month: number
          organization_id: string
          plan_completion_rate: number
          planned_trainings: number
          rank: number
          user_id: string
          year: number
        }
        Insert: {
          active_days?: number
          check_in_completion_rate?: number
          check_in_days?: number
          completed_trainings?: number
          created_at?: string
          final_points?: number
          id?: string
          metadata?: Json
          month: number
          organization_id: string
          plan_completion_rate?: number
          planned_trainings?: number
          rank: number
          user_id: string
          year: number
        }
        Update: {
          active_days?: number
          check_in_completion_rate?: number
          check_in_days?: number
          completed_trainings?: number
          created_at?: string
          final_points?: number
          id?: string
          metadata?: Json
          month?: number
          organization_id?: string
          plan_completion_rate?: number
          planned_trainings?: number
          rank?: number
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      org_ranking_events: {
        Row: {
          awarded_by: string | null
          category: Database["public"]["Enums"]["org_point_category"]
          created_at: string
          event_date: string
          event_kind: string
          id: string
          metadata: Json
          organization_id: string
          points: number
          reason: string | null
          reversed_by_event_id: string | null
          source_id: string | null
          source_type: string | null
          status: string
          team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          awarded_by?: string | null
          category: Database["public"]["Enums"]["org_point_category"]
          created_at?: string
          event_date: string
          event_kind: string
          id?: string
          metadata?: Json
          organization_id: string
          points: number
          reason?: string | null
          reversed_by_event_id?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          awarded_by?: string | null
          category?: Database["public"]["Enums"]["org_point_category"]
          created_at?: string
          event_date?: string
          event_kind?: string
          id?: string
          metadata?: Json
          organization_id?: string
          points?: number
          reason?: string | null
          reversed_by_event_id?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_ranking_events_reversed_by_event_id_fkey"
            columns: ["reversed_by_event_id"]
            isOneToOne: false
            referencedRelation: "org_ranking_events"
            referencedColumns: ["id"]
          },
        ]
      }
      org_team_nutrition_schedule: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          nutrition_plan_id: string | null
          team_id: string
          title: string
          updated_at: string
          weekday: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          nutrition_plan_id?: string | null
          team_id: string
          title?: string
          updated_at?: string
          weekday: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          nutrition_plan_id?: string | null
          team_id?: string
          title?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_team_nutrition_schedule_nutrition_plan_id_fkey"
            columns: ["nutrition_plan_id"]
            isOneToOne: false
            referencedRelation: "nutrition_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_team_nutrition_schedule_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "organization_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      org_team_training_week: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          published_at: string | null
          published_by: string | null
          status: string
          team_id: string
          updated_at: string
          week_start: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          published_at?: string | null
          published_by?: string | null
          status?: string
          team_id: string
          updated_at?: string
          week_start: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          published_at?: string | null
          published_by?: string | null
          status?: string
          team_id?: string
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_team_training_week_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_team_training_week_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "organization_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      org_team_training_week_session: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          end_time: string | null
          focus: string | null
          focus_source: string | null
          id: string
          session_date: string
          start_time: string | null
          title: string
          updated_at: string
          week_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          end_time?: string | null
          focus?: string | null
          focus_source?: string | null
          id?: string
          session_date: string
          start_time?: string | null
          title?: string
          updated_at?: string
          week_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          end_time?: string | null
          focus?: string | null
          focus_source?: string | null
          id?: string
          session_date?: string
          start_time?: string | null
          title?: string
          updated_at?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_team_training_week_session_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "org_team_training_week"
            referencedColumns: ["id"]
          },
        ]
      }
      org_training_session_template: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          duration_min: number | null
          end_time: string | null
          focus: string
          id: string
          name: string
          notes: string | null
          organization_id: string
          start_time: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          duration_min?: number | null
          end_time?: string | null
          focus?: string
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          start_time?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          duration_min?: number | null
          end_time?: string | null
          focus?: string
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          start_time?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_training_session_template_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_training_week_template: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          organization_id: string
          sessions: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          sessions?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          sessions?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_training_week_template_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      organization_coach_assignments: {
        Row: {
          coach_user_id: string
          created_at: string
          customer_user_id: string
          id: string
          organization_id: string
          role: string
          updated_at: string
        }
        Insert: {
          coach_user_id: string
          created_at?: string
          customer_user_id: string
          id?: string
          organization_id: string
          role?: string
          updated_at?: string
        }
        Update: {
          coach_user_id?: string
          created_at?: string
          customer_user_id?: string
          id?: string
          organization_id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_coach_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          image_path: string | null
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
          image_path?: string | null
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
          image_path?: string | null
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
      organization_events: {
        Row: {
          competition: string | null
          created_at: string
          created_by: string | null
          ends_at: string | null
          event_type: string
          id: string
          location: string | null
          metadata: Json
          opponent: string | null
          organization_id: string
          source: string
          starts_at: string
          team_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          competition?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          event_type: string
          id?: string
          location?: string | null
          metadata?: Json
          opponent?: string | null
          organization_id: string
          source?: string
          starts_at: string
          team_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          competition?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          event_type?: string
          id?: string
          location?: string | null
          metadata?: Json
          opponent?: string | null
          organization_id?: string
          source?: string
          starts_at?: string
          team_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_events_team_id_fkey"
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
          athlete_jersey_number: number | null
          athlete_primary_position: string | null
          athlete_secondary_position: string | null
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
          athlete_jersey_number?: number | null
          athlete_primary_position?: string | null
          athlete_secondary_position?: string | null
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
          athlete_jersey_number?: number | null
          athlete_primary_position?: string | null
          athlete_secondary_position?: string | null
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
      organization_load_day_athlete_overrides: {
        Row: {
          created_at: string
          date: string
          id: string
          load_level: number
          note: string | null
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          load_level: number
          note?: string | null
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          load_level?: number
          note?: string | null
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_load_day_athlete_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_load_days: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          id: string
          load_level: number
          notes: string | null
          organization_id: string
          session_type: string | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          load_level: number
          notes?: string | null
          organization_id: string
          session_type?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          load_level?: number
          notes?: string | null
          organization_id?: string
          session_type?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_load_days_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_load_days_team_id_fkey"
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
          is_course_instructor: boolean
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
          is_course_instructor?: boolean
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
          is_course_instructor?: boolean
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
          assign_scope: string
          assignee_user_id: string | null
          created_at: string
          duration_min: number | null
          id: string
          link_target: string | null
          organization_id: string
          payload: Json
          points: number | null
          position_group: string | null
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
          assign_scope?: string
          assignee_user_id?: string | null
          created_at?: string
          duration_min?: number | null
          id?: string
          link_target?: string | null
          organization_id: string
          payload?: Json
          points?: number | null
          position_group?: string | null
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
          assign_scope?: string
          assignee_user_id?: string | null
          created_at?: string
          duration_min?: number | null
          id?: string
          link_target?: string | null
          organization_id?: string
          payload?: Json
          points?: number | null
          position_group?: string | null
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
          accent_color: string | null
          alt_logo_url: string | null
          background_color: string | null
          branding_extra: Json
          branding_mode: string
          claim: string | null
          created_at: string
          id: string
          license_expires_at: string | null
          license_plan: string
          license_started_at: string | null
          license_status: string
          logo_url: string | null
          max_coaches: number | null
          max_customers: number | null
          name: string
          organization_type: Database["public"]["Enums"]["organization_type"]
          primary_color: string | null
          secondary_color: string | null
          settings: Json
          short_name: string | null
          slug: string
          sport: string | null
          status: Database["public"]["Enums"]["organization_status"]
          terminology: Json
          text_color: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          alt_logo_url?: string | null
          background_color?: string | null
          branding_extra?: Json
          branding_mode?: string
          claim?: string | null
          created_at?: string
          id?: string
          license_expires_at?: string | null
          license_plan?: string
          license_started_at?: string | null
          license_status?: string
          logo_url?: string | null
          max_coaches?: number | null
          max_customers?: number | null
          name: string
          organization_type?: Database["public"]["Enums"]["organization_type"]
          primary_color?: string | null
          secondary_color?: string | null
          settings?: Json
          short_name?: string | null
          slug: string
          sport?: string | null
          status?: Database["public"]["Enums"]["organization_status"]
          terminology?: Json
          text_color?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          alt_logo_url?: string | null
          background_color?: string | null
          branding_extra?: Json
          branding_mode?: string
          claim?: string | null
          created_at?: string
          id?: string
          license_expires_at?: string | null
          license_plan?: string
          license_started_at?: string | null
          license_status?: string
          logo_url?: string | null
          max_coaches?: number | null
          max_customers?: number | null
          name?: string
          organization_type?: Database["public"]["Enums"]["organization_type"]
          primary_color?: string | null
          secondary_color?: string | null
          settings?: Json
          short_name?: string | null
          slug?: string
          sport?: string | null
          status?: Database["public"]["Enums"]["organization_status"]
          terminology?: Json
          text_color?: string | null
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
      performance_nutrition_calculations: {
        Row: {
          age_at_calculation: number | null
          calculated_at: string
          calculation_date: string
          calculation_flags: string[]
          carb_floor_g: number | null
          carbs_g: number | null
          coach_review_required: boolean
          day_type: string
          effective_goal: string | null
          energy_floor_applied: boolean
          engine_version: number
          fat_g: number | null
          final_target_kcal: number | null
          goal_adjusted_energy: number | null
          goal_modifier: number | null
          height_cm: number | null
          id: string
          initial_eer: number | null
          organization_id: string
          pal_category: string | null
          performance_goal: string | null
          personal_calibration_kcal: number
          position_cluster: string | null
          protein_g: number | null
          session_intensity: string | null
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          age_at_calculation?: number | null
          calculated_at?: string
          calculation_date: string
          calculation_flags?: string[]
          carb_floor_g?: number | null
          carbs_g?: number | null
          coach_review_required?: boolean
          day_type: string
          effective_goal?: string | null
          energy_floor_applied?: boolean
          engine_version?: number
          fat_g?: number | null
          final_target_kcal?: number | null
          goal_adjusted_energy?: number | null
          goal_modifier?: number | null
          height_cm?: number | null
          id?: string
          initial_eer?: number | null
          organization_id: string
          pal_category?: string | null
          performance_goal?: string | null
          personal_calibration_kcal?: number
          position_cluster?: string | null
          protein_g?: number | null
          session_intensity?: string | null
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          age_at_calculation?: number | null
          calculated_at?: string
          calculation_date?: string
          calculation_flags?: string[]
          carb_floor_g?: number | null
          carbs_g?: number | null
          coach_review_required?: boolean
          day_type?: string
          effective_goal?: string | null
          energy_floor_applied?: boolean
          engine_version?: number
          fat_g?: number | null
          final_target_kcal?: number | null
          goal_adjusted_energy?: number | null
          goal_modifier?: number | null
          height_cm?: number | null
          id?: string
          initial_eer?: number | null
          organization_id?: string
          pal_category?: string | null
          performance_goal?: string | null
          personal_calibration_kcal?: number
          position_cluster?: string | null
          protein_g?: number | null
          session_intensity?: string | null
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_nutrition_calculations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_nutrition_calibrations: {
        Row: {
          calibration_mode: string
          created_at: string
          engine_version: number
          id: string
          last_calibration_at: string | null
          organization_id: string
          personal_calibration_kcal: number
          updated_at: string
          user_id: string
          weight_trend_percent_per_week: number | null
        }
        Insert: {
          calibration_mode?: string
          created_at?: string
          engine_version?: number
          id?: string
          last_calibration_at?: string | null
          organization_id: string
          personal_calibration_kcal?: number
          updated_at?: string
          user_id: string
          weight_trend_percent_per_week?: number | null
        }
        Update: {
          calibration_mode?: string
          created_at?: string
          engine_version?: number
          id?: string
          last_calibration_at?: string | null
          organization_id?: string
          personal_calibration_kcal?: number
          updated_at?: string
          user_id?: string
          weight_trend_percent_per_week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_nutrition_calibrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_nutrition_profiles: {
        Row: {
          baseline_daily_activity: string | null
          created_at: string
          id: string
          organization_id: string
          performance_goal: string | null
          sex_for_energy_calculation: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          baseline_daily_activity?: string | null
          created_at?: string
          id?: string
          organization_id: string
          performance_goal?: string | null
          sex_for_energy_calculation?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          baseline_daily_activity?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          performance_goal?: string | null
          sex_for_energy_calculation?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_nutrition_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_plan_history: {
        Row: {
          action: string
          created_at: string
          date: string
          engine_version: string | null
          flags: Json
          id: string
          job_id: string | null
          message: string | null
          new_day_type: string | null
          new_target_kcal: number | null
          organization_id: string
          plan_id: string | null
          previous_day_type: string | null
          previous_target_kcal: number | null
          trigger: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          date: string
          engine_version?: string | null
          flags?: Json
          id?: string
          job_id?: string | null
          message?: string | null
          new_day_type?: string | null
          new_target_kcal?: number | null
          organization_id: string
          plan_id?: string | null
          previous_day_type?: string | null
          previous_target_kcal?: number | null
          trigger: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          date?: string
          engine_version?: string | null
          flags?: Json
          id?: string
          job_id?: string | null
          message?: string | null
          new_day_type?: string | null
          new_target_kcal?: number | null
          organization_id?: string
          plan_id?: string | null
          previous_day_type?: string | null
          previous_target_kcal?: number | null
          trigger?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_plan_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "performance_plan_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_plan_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_plan_history_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "nutrition_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_plan_jobs: {
        Row: {
          athlete_user_id: string | null
          attempts: number
          completed_at: string | null
          created_at: string
          created_by: string | null
          failed_count: number
          generated_count: number
          id: string
          last_error: string | null
          organization_id: string
          processed_athletes: number
          skipped_count: number
          started_at: string | null
          status: string
          team_id: string | null
          total_athletes: number
          trigger: string
          updated_at: string
          updated_count: number
          week_start: string
        }
        Insert: {
          athlete_user_id?: string | null
          attempts?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          generated_count?: number
          id?: string
          last_error?: string | null
          organization_id: string
          processed_athletes?: number
          skipped_count?: number
          started_at?: string | null
          status?: string
          team_id?: string | null
          total_athletes?: number
          trigger: string
          updated_at?: string
          updated_count?: number
          week_start: string
        }
        Update: {
          athlete_user_id?: string | null
          attempts?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          generated_count?: number
          id?: string
          last_error?: string | null
          organization_id?: string
          processed_athletes?: number
          skipped_count?: number
          started_at?: string | null
          status?: string
          team_id?: string | null
          total_athletes?: number
          trigger?: string
          updated_at?: string
          updated_count?: number
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_plan_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_plan_jobs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "organization_teams"
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
      player_card_badge_definitions: {
        Row: {
          category: string
          created_at: string
          description: string
          icon_key: string
          key: string
          label: string
          rule: Json
          sort_order: number
          sport: string
          tier: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          icon_key: string
          key: string
          label: string
          rule: Json
          sort_order?: number
          sport?: string
          tier?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          icon_key?: string
          key?: string
          label?: string
          rule?: Json
          sort_order?: number
          sport?: string
          tier?: string
        }
        Relationships: []
      }
      player_card_badge_unlocks: {
        Row: {
          badge_key: string
          id: string
          organization_id: string | null
          seen_at: string | null
          snapshot_bfr: number | null
          unlocked_at: string
          user_id: string
        }
        Insert: {
          badge_key: string
          id?: string
          organization_id?: string | null
          seen_at?: string | null
          snapshot_bfr?: number | null
          unlocked_at?: string
          user_id: string
        }
        Update: {
          badge_key?: string
          id?: string
          organization_id?: string | null
          seen_at?: string | null
          snapshot_bfr?: number | null
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_card_badge_unlocks_badge_key_fkey"
            columns: ["badge_key"]
            isOneToOne: false
            referencedRelation: "player_card_badge_definitions"
            referencedColumns: ["key"]
          },
        ]
      }
      player_card_benchmarks: {
        Row: {
          anchors: Json
          attribute_key: string
          created_at: string
          direction: string
          id: string
          metric_key: string
          sport: string
          updated_at: string
          weight: number
        }
        Insert: {
          anchors: Json
          attribute_key: string
          created_at?: string
          direction: string
          id?: string
          metric_key: string
          sport: string
          updated_at?: string
          weight?: number
        }
        Update: {
          anchors?: Json
          attribute_key?: string
          created_at?: string
          direction?: string
          id?: string
          metric_key?: string
          sport?: string
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      player_card_design: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean
          layout_json: Json
          name: string | null
          organization_slug: string | null
          published_at: string | null
          scope: string
          template_uploaded_at: string | null
          template_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          layout_json?: Json
          name?: string | null
          organization_slug?: string | null
          published_at?: string | null
          scope?: string
          template_uploaded_at?: string | null
          template_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          layout_json?: Json
          name?: string | null
          organization_slug?: string | null
          published_at?: string | null
          scope?: string
          template_uploaded_at?: string | null
          template_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      player_card_history: {
        Row: {
          acc: number | null
          agi: number | null
          attributes_detail: Json
          bfr: number | null
          created_at: string
          end_score: number | null
          id: string
          is_provisional: boolean
          organization_id: string | null
          position_key: string | null
          pow: number | null
          snapshot_at: string
          spd: number | null
          sport: string
          str: number | null
          tier: string | null
          user_id: string
        }
        Insert: {
          acc?: number | null
          agi?: number | null
          attributes_detail?: Json
          bfr?: number | null
          created_at?: string
          end_score?: number | null
          id?: string
          is_provisional?: boolean
          organization_id?: string | null
          position_key?: string | null
          pow?: number | null
          snapshot_at?: string
          spd?: number | null
          sport?: string
          str?: number | null
          tier?: string | null
          user_id: string
        }
        Update: {
          acc?: number | null
          agi?: number | null
          attributes_detail?: Json
          bfr?: number | null
          created_at?: string
          end_score?: number | null
          id?: string
          is_provisional?: boolean
          organization_id?: string | null
          position_key?: string | null
          pow?: number | null
          snapshot_at?: string
          spd?: number | null
          sport?: string
          str?: number | null
          tier?: string | null
          user_id?: string
        }
        Relationships: []
      }
      player_card_monthly_awards: {
        Row: {
          award_kind: string
          bfr_at_award: number
          bfr_delta: number
          created_at: string
          finalized_by: string | null
          id: string
          metadata: Json
          month: number
          organization_id: string
          team_id: string | null
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          award_kind?: string
          bfr_at_award: number
          bfr_delta?: number
          created_at?: string
          finalized_by?: string | null
          id?: string
          metadata?: Json
          month: number
          organization_id: string
          team_id?: string | null
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          award_kind?: string
          bfr_at_award?: number
          bfr_delta?: number
          created_at?: string
          finalized_by?: string | null
          id?: string
          metadata?: Json
          month?: number
          organization_id?: string
          team_id?: string | null
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_card_monthly_awards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_card_monthly_awards_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "organization_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      player_card_position_weights: {
        Row: {
          created_at: string
          id: string
          label: string
          position_key: string
          sport: string
          updated_at: string
          w_acc: number
          w_agi: number
          w_end: number
          w_pow: number
          w_spd: number
          w_str: number
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          position_key: string
          sport: string
          updated_at?: string
          w_acc: number
          w_agi: number
          w_end: number
          w_pow: number
          w_spd: number
          w_str: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          position_key?: string
          sport?: string
          updated_at?: string
          w_acc?: number
          w_agi?: number
          w_end?: number
          w_pow?: number
          w_spd?: number
          w_str?: number
        }
        Relationships: []
      }
      player_cards: {
        Row: {
          acc: number | null
          agi: number | null
          attributes_detail: Json
          bfr: number | null
          computed_at: string
          created_at: string
          custom_card_image_url: string | null
          end_score: number | null
          id: string
          is_provisional: boolean
          is_published: boolean
          manual_overrides: Json
          missing_tests: Json
          organization_id: string | null
          position_key: string | null
          pow: number | null
          spd: number | null
          sport: string
          str: number | null
          strongest_attribute: string | null
          tier: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          acc?: number | null
          agi?: number | null
          attributes_detail?: Json
          bfr?: number | null
          computed_at?: string
          created_at?: string
          custom_card_image_url?: string | null
          end_score?: number | null
          id?: string
          is_provisional?: boolean
          is_published?: boolean
          manual_overrides?: Json
          missing_tests?: Json
          organization_id?: string | null
          position_key?: string | null
          pow?: number | null
          spd?: number | null
          sport?: string
          str?: number | null
          strongest_attribute?: string | null
          tier?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          acc?: number | null
          agi?: number | null
          attributes_detail?: Json
          bfr?: number | null
          computed_at?: string
          created_at?: string
          custom_card_image_url?: string | null
          end_score?: number | null
          id?: string
          is_provisional?: boolean
          is_published?: boolean
          manual_overrides?: Json
          missing_tests?: Json
          organization_id?: string | null
          position_key?: string | null
          pow?: number | null
          spd?: number | null
          sport?: string
          str?: number | null
          strongest_attribute?: string | null
          tier?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string
          activity_level: string | null
          athlete_profile_updated_at: string | null
          avatar_cutout_source: string | null
          avatar_cutout_url: string | null
          avatar_url: string | null
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
          is_course_instructor: boolean
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
          avatar_cutout_source?: string | null
          avatar_cutout_url?: string | null
          avatar_url?: string | null
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
          is_course_instructor?: boolean
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
          avatar_cutout_source?: string | null
          avatar_cutout_url?: string | null
          avatar_url?: string | null
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
          is_course_instructor?: boolean
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
      roster_pending_athletes: {
        Row: {
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          first_name: string
          height_cm: number | null
          id: string
          jersey_number: number | null
          last_name: string
          linked_user_id: string | null
          note: string | null
          organization_id: string
          primary_position: string | null
          secondary_position: string | null
          team_id: string | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          first_name: string
          height_cm?: number | null
          id?: string
          jersey_number?: number | null
          last_name: string
          linked_user_id?: string | null
          note?: string | null
          organization_id: string
          primary_position?: string | null
          secondary_position?: string | null
          team_id?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          first_name?: string
          height_cm?: number | null
          id?: string
          jersey_number?: number | null
          last_name?: string
          linked_user_id?: string | null
          note?: string | null
          organization_id?: string
          primary_position?: string | null
          secondary_position?: string | null
          team_id?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "roster_pending_athletes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_pending_athletes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "organization_teams"
            referencedColumns: ["id"]
          },
        ]
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
          mode: string
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
          mode?: string
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
          mode?: string
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
          function_label: string | null
          id: string
          onboarding_completed_at: string | null
          organization_id: string
          permissions: string[]
          role: Database["public"]["Enums"]["organization_role"]
          team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          function_label?: string | null
          id?: string
          onboarding_completed_at?: string | null
          organization_id: string
          permissions?: string[]
          role?: Database["public"]["Enums"]["organization_role"]
          team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          function_label?: string | null
          id?: string
          onboarding_completed_at?: string | null
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
      team_join_links: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          organization_id: string
          team_id: string
          token: string
          updated_at: string
          uses_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          organization_id: string
          team_id: string
          token: string
          updated_at?: string
          uses_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          organization_id?: string
          team_id?: string
          token?: string
          updated_at?: string
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_join_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_join_links_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "organization_teams"
            referencedColumns: ["id"]
          },
        ]
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
      training_day_completions: {
        Row: {
          client_id: string
          completed_at: string
          completion_date: string
          created_at: string
          day_id: string
          exercises_evaluated: number
          id: string
        }
        Insert: {
          client_id: string
          completed_at?: string
          completion_date: string
          created_at?: string
          day_id: string
          exercises_evaluated?: number
          id?: string
        }
        Update: {
          client_id?: string
          completed_at?: string
          completion_date?: string
          created_at?: string
          day_id?: string
          exercises_evaluated?: number
          id?: string
        }
        Relationships: []
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
          added_by_user: string | null
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
          set_type: string
          smart_lock: Database["public"]["Enums"]["training_smart_lock"]
          sort_order: number
          target_reps: string | null
          target_rir: number | null
          target_sets: number | null
          target_weights: string | null
        }
        Insert: {
          added_by_user?: string | null
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
          set_type?: string
          smart_lock?: Database["public"]["Enums"]["training_smart_lock"]
          sort_order?: number
          target_reps?: string | null
          target_rir?: number | null
          target_sets?: number | null
          target_weights?: string | null
        }
        Update: {
          added_by_user?: string | null
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
          set_type?: string
          smart_lock?: Database["public"]["Enums"]["training_smart_lock"]
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
      training_plan_templates: {
        Row: {
          created_at: string
          current_version: number
          description: string | null
          id: string
          is_archived: boolean
          name: string
          organization_id: string | null
          owner_user_id: string
          tags: string[]
          updated_at: string
          weeks_count: number
        }
        Insert: {
          created_at?: string
          current_version?: number
          description?: string | null
          id?: string
          is_archived?: boolean
          name: string
          organization_id?: string | null
          owner_user_id: string
          tags?: string[]
          updated_at?: string
          weeks_count?: number
        }
        Update: {
          created_at?: string
          current_version?: number
          description?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          organization_id?: string | null
          owner_user_id?: string
          tags?: string[]
          updated_at?: string
          weeks_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_plan_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_progression_events: {
        Row: {
          applied_to_exercise_id: string | null
          client_id: string
          created_at: string
          decision: string
          evaluated_at: string
          id: string
          next_load: number | null
          next_target_reps: string | null
          next_target_weights: string | null
          previous_load: number | null
          previous_target_reps: string | null
          previous_target_weights: string | null
          readiness_gate: string | null
          readiness_gate_reason: string | null
          reason: string
          source_day_id: string | null
          source_exercise_id: string
          source_session_date: string
        }
        Insert: {
          applied_to_exercise_id?: string | null
          client_id: string
          created_at?: string
          decision: string
          evaluated_at?: string
          id?: string
          next_load?: number | null
          next_target_reps?: string | null
          next_target_weights?: string | null
          previous_load?: number | null
          previous_target_reps?: string | null
          previous_target_weights?: string | null
          readiness_gate?: string | null
          readiness_gate_reason?: string | null
          reason: string
          source_day_id?: string | null
          source_exercise_id: string
          source_session_date: string
        }
        Update: {
          applied_to_exercise_id?: string | null
          client_id?: string
          created_at?: string
          decision?: string
          evaluated_at?: string
          id?: string
          next_load?: number | null
          next_target_reps?: string | null
          next_target_weights?: string | null
          previous_load?: number | null
          previous_target_reps?: string | null
          previous_target_weights?: string | null
          readiness_gate?: string | null
          readiness_gate_reason?: string | null
          reason?: string
          source_day_id?: string | null
          source_exercise_id?: string
          source_session_date?: string
        }
        Relationships: []
      }
      training_sessions: {
        Row: {
          actual_duration_minutes: number | null
          client_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          exercises: Json | null
          focus: string | null
          id: string
          intensity: number | null
          intensity_target: number | null
          load_category: string | null
          location: string | null
          mandatory: boolean
          name: string
          notes: string | null
          organization_id: string | null
          pain_reported: boolean | null
          progress: Json | null
          reps: string | null
          session_date: string
          session_rpe: number | null
          session_type: string
          sets: number | null
          source_ats_id: string | null
          source_week_session_id: string | null
          start_time: string | null
          status: string
          team_id: string | null
          template_id: string | null
          training_source: string
          training_type: string | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          actual_duration_minutes?: number | null
          client_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          exercises?: Json | null
          focus?: string | null
          id?: string
          intensity?: number | null
          intensity_target?: number | null
          load_category?: string | null
          location?: string | null
          mandatory?: boolean
          name: string
          notes?: string | null
          organization_id?: string | null
          pain_reported?: boolean | null
          progress?: Json | null
          reps?: string | null
          session_date?: string
          session_rpe?: number | null
          session_type: string
          sets?: number | null
          source_ats_id?: string | null
          source_week_session_id?: string | null
          start_time?: string | null
          status?: string
          team_id?: string | null
          template_id?: string | null
          training_source?: string
          training_type?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          actual_duration_minutes?: number | null
          client_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          exercises?: Json | null
          focus?: string | null
          id?: string
          intensity?: number | null
          intensity_target?: number | null
          load_category?: string | null
          location?: string | null
          mandatory?: boolean
          name?: string
          notes?: string | null
          organization_id?: string | null
          pain_reported?: boolean | null
          progress?: Json | null
          reps?: string | null
          session_date?: string
          session_rpe?: number | null
          session_type?: string
          sets?: number | null
          source_ats_id?: string | null
          source_week_session_id?: string | null
          start_time?: string | null
          status?: string
          team_id?: string | null
          template_id?: string | null
          training_source?: string
          training_type?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "training_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_source_ats_fk"
            columns: ["source_ats_id"]
            isOneToOne: false
            referencedRelation: "athlete_training_session"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_source_week_session_fk"
            columns: ["source_week_session_id"]
            isOneToOne: false
            referencedRelation: "org_team_training_week_session"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "organization_teams"
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
          rpe: number | null
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
          rpe?: number | null
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
          rpe?: number | null
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
      training_template_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          structure: Json
          template_id: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          structure: Json
          template_id: string
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          structure?: Json
          template_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "training_plan_templates"
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
      user_foods: {
        Row: {
          allergens: Json | null
          barcode: string | null
          brand: string | null
          carbohydrates_g: number | null
          category: string | null
          created_at: string
          fat_g: number | null
          fiber_g: number | null
          id: string
          ingredients: Json | null
          ingredients_text: string | null
          kcal: number | null
          micronutrients: Json | null
          name: string
          name_normalized: string | null
          notes: string | null
          protein_g: number | null
          salt_g: number | null
          saturated_fat_g: number | null
          serving_size_g: number | null
          sodium_mg: number | null
          sugar_g: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allergens?: Json | null
          barcode?: string | null
          brand?: string | null
          carbohydrates_g?: number | null
          category?: string | null
          created_at?: string
          fat_g?: number | null
          fiber_g?: number | null
          id?: string
          ingredients?: Json | null
          ingredients_text?: string | null
          kcal?: number | null
          micronutrients?: Json | null
          name: string
          name_normalized?: string | null
          notes?: string | null
          protein_g?: number | null
          salt_g?: number | null
          saturated_fat_g?: number | null
          serving_size_g?: number | null
          sodium_mg?: number | null
          sugar_g?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allergens?: Json | null
          barcode?: string | null
          brand?: string | null
          carbohydrates_g?: number | null
          category?: string | null
          created_at?: string
          fat_g?: number | null
          fiber_g?: number | null
          id?: string
          ingredients?: Json | null
          ingredients_text?: string | null
          kcal?: number | null
          micronutrients?: Json | null
          name?: string
          name_normalized?: string | null
          notes?: string | null
          protein_g?: number | null
          salt_g?: number | null
          saturated_fat_g?: number | null
          serving_size_g?: number | null
          sodium_mg?: number | null
          sugar_g?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      user_meal_items: {
        Row: {
          amount_g: number | null
          central_food_id: number | null
          food_kind: string
          id: string
          meal_id: string
          note: string | null
          position: number
          recipe_id: string | null
          servings: number | null
          unit: string | null
          user_food_id: string | null
          user_id: string
        }
        Insert: {
          amount_g?: number | null
          central_food_id?: number | null
          food_kind: string
          id?: string
          meal_id: string
          note?: string | null
          position?: number
          recipe_id?: string | null
          servings?: number | null
          unit?: string | null
          user_food_id?: string | null
          user_id: string
        }
        Update: {
          amount_g?: number | null
          central_food_id?: number | null
          food_kind?: string
          id?: string
          meal_id?: string
          note?: string | null
          position?: number
          recipe_id?: string | null
          servings?: number | null
          unit?: string | null
          user_food_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_meal_items_central_food_id_fkey"
            columns: ["central_food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_meal_items_central_food_id_fkey"
            columns: ["central_food_id"]
            isOneToOne: false
            referencedRelation: "foods_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_meal_items_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "user_meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_meal_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "user_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_meal_items_user_food_id_fkey"
            columns: ["user_food_id"]
            isOneToOne: false
            referencedRelation: "user_foods"
            referencedColumns: ["id"]
          },
        ]
      }
      user_meals: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          slot: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          slot?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          slot?: string | null
          updated_at?: string
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
      user_recipe_items: {
        Row: {
          amount_g: number
          central_food_id: number | null
          food_kind: string
          id: string
          note: string | null
          position: number
          recipe_id: string
          unit: string | null
          user_food_id: string | null
          user_id: string
        }
        Insert: {
          amount_g: number
          central_food_id?: number | null
          food_kind: string
          id?: string
          note?: string | null
          position?: number
          recipe_id: string
          unit?: string | null
          user_food_id?: string | null
          user_id: string
        }
        Update: {
          amount_g?: number
          central_food_id?: number | null
          food_kind?: string
          id?: string
          note?: string | null
          position?: number
          recipe_id?: string
          unit?: string | null
          user_food_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_recipe_items_central_food_id_fkey"
            columns: ["central_food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_recipe_items_central_food_id_fkey"
            columns: ["central_food_id"]
            isOneToOne: false
            referencedRelation: "foods_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_recipe_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "user_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_recipe_items_user_food_id_fkey"
            columns: ["user_food_id"]
            isOneToOne: false
            referencedRelation: "user_foods"
            referencedColumns: ["id"]
          },
        ]
      }
      user_recipes: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          notes: string | null
          servings: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          notes?: string | null
          servings?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          notes?: string | null
          servings?: number
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
      foods_search: {
        Row: {
          barcode: string | null
          brand: string | null
          carbohydrates_g: number | null
          category: string | null
          fat_g: number | null
          fiber_g: number | null
          id: number | null
          kcal: number | null
          name: string | null
          protein_g: number | null
          quality_score: number | null
          salt_g: number | null
          saturated_fat_g: number | null
          sodium_mg: number | null
          source: string | null
          sugar_g: number | null
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          carbohydrates_g?: number | null
          category?: string | null
          fat_g?: number | null
          fiber_g?: number | null
          id?: number | null
          kcal?: number | null
          name?: string | null
          protein_g?: number | null
          quality_score?: number | null
          salt_g?: number | null
          saturated_fat_g?: number | null
          sodium_mg?: number | null
          source?: string | null
          sugar_g?: number | null
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          carbohydrates_g?: number | null
          category?: string | null
          fat_g?: number | null
          fiber_g?: number | null
          id?: number | null
          kcal?: number | null
          name?: string | null
          protein_g?: number | null
          quality_score?: number | null
          salt_g?: number | null
          saturated_fat_g?: number | null
          sodium_mg?: number | null
          source?: string | null
          sugar_g?: number | null
        }
        Relationships: []
      }
      nutrition_foods_public: {
        Row: {
          aliases: string[] | null
          carbs_per_100g: number | null
          category: string | null
          citation: string | null
          created_at: string | null
          default_state:
            | Database["public"]["Enums"]["nutrition_food_state"]
            | null
          density_g_per_ml: number | null
          fat_per_100g: number | null
          fiber_per_100g: number | null
          id: string | null
          is_active: boolean | null
          kcal_per_100g: number | null
          license: string | null
          name: string | null
          protein_per_100g: number | null
          safe_for_smart: boolean | null
          salt_per_100g: number | null
          source: Database["public"]["Enums"]["nutrition_food_source"] | null
          source_id: string | null
          source_name: string | null
          sugar_per_100g: number | null
          text_id: string | null
          unit_type: Database["public"]["Enums"]["nutrition_food_unit"] | null
          updated_at: string | null
          verified_at: string | null
          verified_by_coach: boolean | null
        }
        Insert: {
          aliases?: string[] | null
          carbs_per_100g?: number | null
          category?: string | null
          citation?: string | null
          created_at?: string | null
          default_state?:
            | Database["public"]["Enums"]["nutrition_food_state"]
            | null
          density_g_per_ml?: number | null
          fat_per_100g?: number | null
          fiber_per_100g?: number | null
          id?: string | null
          is_active?: boolean | null
          kcal_per_100g?: number | null
          license?: string | null
          name?: string | null
          protein_per_100g?: number | null
          safe_for_smart?: boolean | null
          salt_per_100g?: number | null
          source?: Database["public"]["Enums"]["nutrition_food_source"] | null
          source_id?: string | null
          source_name?: string | null
          sugar_per_100g?: number | null
          text_id?: string | null
          unit_type?: Database["public"]["Enums"]["nutrition_food_unit"] | null
          updated_at?: string | null
          verified_at?: string | null
          verified_by_coach?: boolean | null
        }
        Update: {
          aliases?: string[] | null
          carbs_per_100g?: number | null
          category?: string | null
          citation?: string | null
          created_at?: string | null
          default_state?:
            | Database["public"]["Enums"]["nutrition_food_state"]
            | null
          density_g_per_ml?: number | null
          fat_per_100g?: number | null
          fiber_per_100g?: number | null
          id?: string | null
          is_active?: boolean | null
          kcal_per_100g?: number | null
          license?: string | null
          name?: string | null
          protein_per_100g?: number | null
          safe_for_smart?: boolean | null
          salt_per_100g?: number | null
          source?: Database["public"]["Enums"]["nutrition_food_source"] | null
          source_id?: string | null
          source_name?: string | null
          sugar_per_100g?: number | null
          text_id?: string | null
          unit_type?: Database["public"]["Enums"]["nutrition_food_unit"] | null
          updated_at?: string | null
          verified_at?: string | null
          verified_by_coach?: boolean | null
        }
        Relationships: []
      }
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
      adjust_org_points_manual: {
        Args: {
          _category?: Database["public"]["Enums"]["org_point_category"]
          _event_date?: string
          _organization_id: string
          _points: number
          _reason: string
          _target_user_id: string
        }
        Returns: string
      }
      are_nutrition_partners: {
        Args: { _a: string; _b: string }
        Returns: boolean
      }
      attach_referral: {
        Args: { _slug: string; _user_id: string }
        Returns: undefined
      }
      attach_referral_by_code: {
        Args: { _code: string; _user_id: string }
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
      award_bulls_points: {
        Args: {
          _awarded_by?: string
          _category: Database["public"]["Enums"]["bulls_point_category"]
          _daily_cap?: number
          _event_date: string
          _event_kind: string
          _metadata?: Json
          _organization_id: string
          _points: number
          _reason?: string
          _source_id?: string
          _source_type?: string
          _team_id?: string
          _user_id: string
        }
        Returns: string
      }
      award_bulls_test_improvements: {
        Args: {
          _organization_id: string
          _session_id: string
          _user_id: string
        }
        Returns: number
      }
      award_org_points: {
        Args: {
          _awarded_by?: string
          _category: Database["public"]["Enums"]["org_point_category"]
          _daily_cap?: number
          _event_date: string
          _event_kind: string
          _metadata?: Json
          _organization_id: string
          _points: number
          _reason?: string
          _source_id?: string
          _source_type?: string
          _team_id?: string
          _user_id: string
        }
        Returns: string
      }
      award_org_test_improvements: {
        Args: {
          _organization_id: string
          _session_id: string
          _user_id: string
        }
        Returns: number
      }
      can_view_org_member_profile: {
        Args: { _target: string; _viewer: string }
        Returns: boolean
      }
      coach_can_access_user: {
        Args: { _coach_id: string; _target_user_id: string }
        Returns: boolean
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
      finalize_all_orgs_previous_month: { Args: never; Returns: undefined }
      finalize_bulls_month: {
        Args: { _month: number; _organization_id: string; _year: number }
        Returns: string
      }
      finalize_bulls_previous_month: { Args: never; Returns: undefined }
      finalize_org_month: {
        Args: { _month: number; _organization_id: string; _year: number }
        Returns: string
      }
      find_user_id_by_email: { Args: { _email: string }; Returns: string }
      get_bulls_month_ranking: {
        Args: { _month: number; _organization_id: string; _year: number }
        Returns: {
          active_days: number
          check_in_completion_rate: number
          check_in_days: number
          completed_trainings: number
          display_name: string
          nickname: string
          plan_completion_rate: number
          planned_trainings: number
          rank: number
          sport_position: string
          team_id: string
          total_points: number
          user_id: string
        }[]
      }
      get_bulls_monthly_winners: {
        Args: { _limit?: number; _organization_id: string }
        Returns: {
          finalized_at: string
          month: number
          winner_display_name: string
          winner_points: number
          winner_user_id: string
          year: number
        }[]
      }
      get_bulls_ranking: {
        Args: {
          _organization_id: string
          _position?: string
          _since?: string
          _team_id?: string
          _until?: string
        }
        Returns: {
          display_name: string
          nickname: string
          sport_position: string
          team_id: string
          total_points: number
          user_id: string
        }[]
      }
      get_bulls_score_breakdown: {
        Args: {
          _organization_id: string
          _since?: string
          _until?: string
          _user_id: string
        }
        Returns: {
          category: Database["public"]["Enums"]["bulls_point_category"]
          event_count: number
          total_points: number
        }[]
      }
      get_bulls_user_player_of_month_awards: {
        Args: { _organization_id: string; _user_id: string }
        Returns: {
          finalized_at: string
          month: number
          points: number
          year: number
        }[]
      }
      get_org_month_ranking: {
        Args: { _month: number; _organization_id: string; _year: number }
        Returns: {
          active_days: number
          check_in_completion_rate: number
          check_in_days: number
          completed_trainings: number
          display_name: string
          nickname: string
          plan_completion_rate: number
          planned_trainings: number
          rank: number
          sport_position: string
          team_id: string
          total_points: number
          user_id: string
        }[]
      }
      get_org_monthly_winners: {
        Args: { _limit?: number; _organization_id: string }
        Returns: {
          finalized_at: string
          month: number
          winner_display_name: string
          winner_points: number
          winner_user_id: string
          year: number
        }[]
      }
      get_org_ranking: {
        Args: {
          _organization_id: string
          _position?: string
          _since?: string
          _team_id?: string
          _until?: string
        }
        Returns: {
          display_name: string
          nickname: string
          sport_position: string
          team_id: string
          total_points: number
          user_id: string
        }[]
      }
      get_org_score_breakdown: {
        Args: {
          _organization_id: string
          _since?: string
          _until?: string
          _user_id: string
        }
        Returns: {
          category: Database["public"]["Enums"]["org_point_category"]
          event_count: number
          total_points: number
        }[]
      }
      get_org_user_potm_awards: {
        Args: { _organization_id: string; _user_id: string }
        Returns: {
          finalized_at: string
          month: number
          points: number
          year: number
        }[]
      }
      get_player_card_month_candidates: {
        Args: { _month: number; _organization_id: string; _year: number }
        Returns: {
          avatar_url: string
          bfr_delta: number
          bfr_end: number
          bfr_start: number
          display_name: string
          position_key: string
          user_id: string
        }[]
      }
      get_player_card_ranking: {
        Args: { _limit?: number; _organization_id: string; _team_id?: string }
        Returns: {
          acc: number
          agi: number
          avatar_url: string
          bfr: number
          computed_at: string
          display_name: string
          end_score: number
          is_provisional: boolean
          position_key: string
          pow: number
          rank_num: number
          spd: number
          str: number
          team_id: string
          team_name: string
          tier: string
          user_id: string
        }[]
      }
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
      get_team_of_the_month_candidates: {
        Args: { _month_start: string; _organization_id: string }
        Returns: {
          athlete_count: number
          avg_bfr_end: number
          avg_bfr_start: number
          avg_delta: number
          team_id: string
          team_name: string
        }[]
      }
      get_team_position_groups: {
        Args: { _team_id: string }
        Returns: {
          athlete_count: number
          position_group: string
        }[]
      }
      get_user_team_position: {
        Args: { _team_id: string; _user_id: string }
        Returns: string
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
      immutable_unaccent: { Args: { "": string }; Returns: string }
      is_bulls_coach: { Args: { _user_id: string }; Returns: boolean }
      is_bulls_org: { Args: { _org_id: string }; Returns: boolean }
      is_org_admin: { Args: { _org: string; _user: string }; Returns: boolean }
      is_org_member: { Args: { _org: string; _user: string }; Returns: boolean }
      is_org_staff: {
        Args: { _org: string; _permission?: string; _user: string }
        Returns: boolean
      }
      log_food_use: {
        Args: {
          p_central_food_id?: number
          p_kind: string
          p_user_food_id?: string
        }
        Returns: undefined
      }
      lookup_barcode: {
        Args: { code: string }
        Returns: {
          barcode: string | null
          brand: string | null
          carbohydrates_g: number | null
          category: string | null
          fat_g: number | null
          fiber_g: number | null
          id: number | null
          kcal: number | null
          name: string | null
          protein_g: number | null
          quality_score: number | null
          salt_g: number | null
          saturated_fat_g: number | null
          sodium_mg: number | null
          source: string | null
          sugar_g: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "foods_search"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      map_ats_status_to_ts: { Args: { _s: string }; Returns: string }
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
      recompute_bulls_nutrition_day: {
        Args: { _day: string; _organization_id: string; _user_id: string }
        Returns: undefined
      }
      recompute_bulls_streak: {
        Args: { _organization_id: string; _user_id: string }
        Returns: undefined
      }
      recompute_org_nutrition_day: {
        Args: { _day: string; _organization_id: string; _user_id: string }
        Returns: undefined
      }
      recompute_org_streak: {
        Args: { _organization_id: string; _user_id: string }
        Returns: undefined
      }
      recompute_user_points: { Args: { _user_id: string }; Returns: undefined }
      reverse_bulls_points_by_source: {
        Args: {
          _event_kind?: string
          _reason?: string
          _source_id: string
          _source_type: string
          _user_id: string
        }
        Returns: number
      }
      reverse_org_points_by_source: {
        Args: {
          _event_kind?: string
          _organization_id: string
          _reason?: string
          _source_id: string
          _source_type: string
          _user_id: string
        }
        Returns: number
      }
      search_foods: {
        Args: {
          include_private?: boolean
          lang?: string
          max_results?: number
          q: string
        }
        Returns: {
          barcode: string
          brand: string
          carbohydrates_g: number
          category: string
          fat_g: number
          fiber_g: number
          id: string
          is_bodyfuel_verified: boolean
          is_verified: boolean
          kcal: number
          kind: string
          language_code: string
          name: string
          protein_g: number
          salt_g: number
          saturated_fat_g: number
          score: number
          serving_size_g: number
          sodium_mg: number
          source: string
          sugar_g: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      app_group: "bulls" | "running_team" | "sgz" | "premium"
      app_role: "coach" | "client" | "free" | "platform_owner"
      bulls_goal: "fat_loss" | "muscle_gain" | "performance" | "general_fitness"
      bulls_point_category:
        | "training"
        | "team_training"
        | "nutrition"
        | "check_in"
        | "tasks"
        | "recovery"
        | "rehab"
        | "development"
        | "challenge"
        | "streak"
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
      org_point_category:
        | "training"
        | "team_training"
        | "nutrition"
        | "check_in"
        | "tasks"
        | "recovery"
        | "rehab"
        | "development"
        | "challenge"
        | "streak"
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
      organization_type:
        | "sports_club"
        | "team"
        | "gym"
        | "company"
        | "other"
        | "fitness_studio"
        | "solo_coach"
        | "coaching_company"
        | "custom"
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
      team_membership_status: "active" | "inactive" | "removed" | "pending"
      training_smart_lock:
        | "none"
        | "locked"
        | "weight_only"
        | "reps_only"
        | "volume_only"
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
      app_role: ["coach", "client", "free", "platform_owner"],
      bulls_goal: ["fat_loss", "muscle_gain", "performance", "general_fitness"],
      bulls_point_category: [
        "training",
        "team_training",
        "nutrition",
        "check_in",
        "tasks",
        "recovery",
        "rehab",
        "development",
        "challenge",
        "streak",
      ],
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
      org_point_category: [
        "training",
        "team_training",
        "nutrition",
        "check_in",
        "tasks",
        "recovery",
        "rehab",
        "development",
        "challenge",
        "streak",
      ],
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
      organization_type: [
        "sports_club",
        "team",
        "gym",
        "company",
        "other",
        "fitness_studio",
        "solo_coach",
        "coaching_company",
        "custom",
      ],
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
      team_membership_status: ["active", "inactive", "removed", "pending"],
      training_smart_lock: [
        "none",
        "locked",
        "weight_only",
        "reps_only",
        "volume_only",
      ],
    },
  },
} as const

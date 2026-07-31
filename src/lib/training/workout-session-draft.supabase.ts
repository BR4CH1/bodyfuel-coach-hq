import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RemoteSaveResult,
  WorkoutDraftEnvelope,
  WorkoutDraftRemoteAdapter,
} from "./workout-session-draft.types";

type RpcSaveResponse<TState extends Record<string, unknown>> = {
  applied: boolean;
  remote_revision: number;
  payload: WorkoutDraftEnvelope<TState>;
};

type DraftRow<TState extends Record<string, unknown>> = {
  payload: WorkoutDraftEnvelope<TState>;
  server_revision: number;
};

export function createSupabaseWorkoutDraftAdapter<TState extends Record<string, unknown>>(
  supabase: SupabaseClient,
  subjectUserId: string,
): WorkoutDraftRemoteAdapter<TState> {
  return {
    async load(draftKey) {
      const { data, error } = await supabase
        .from("workout_session_drafts")
        .select("payload, server_revision")
        .eq("session_key", draftKey)
        .eq("subject_user_id", subjectUserId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const row = data as unknown as DraftRow<TState>;
      return {
        ...row.payload,
        remoteRevision: row.server_revision,
      };
    },

    async save(draft) {
      const { data, error } = await supabase.rpc("save_workout_session_draft", {
        p_session_key: draft.draftKey,
        p_payload: draft,
        p_subject_user_id: subjectUserId,
        p_device_id: draft.deviceId,
        p_client_revision: draft.localRevision,
        p_expected_server_revision: draft.remoteRevision,
      });

      if (error) throw error;

      const response = (Array.isArray(data) ? data[0] : data) as RpcSaveResponse<TState> | null;
      if (!response) throw new Error("Supabase returned no workout draft result.");

      return {
        applied: response.applied,
        remoteRevision: response.remote_revision,
        current: {
          ...response.payload,
          remoteRevision: response.remote_revision,
        },
      } satisfies RemoteSaveResult<TState>;
    },

    async remove(draftKey) {
      const { error } = await supabase
        .from("workout_session_drafts")
        .delete()
        .eq("session_key", draftKey)
        .eq("subject_user_id", subjectUserId);

      if (error) throw error;
    },
  };
}

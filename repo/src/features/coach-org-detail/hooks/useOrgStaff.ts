import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listOrgStaffWithProfiles } from "@/lib/organizations/task-engine.functions";
import {
  addOrgStaff,
  listOrgStaffInvites,
  removeOrgStaff,
  revokeOrgStaffInvite,
  updateOrgStaffPermissions,
} from "@/lib/organizations/operating-loop.functions";
import {
  getAddStaffSuccessMessage,
  getPendingStaffInvites,
  getRemoveStaffSuccessMessage,
  normalizePermissionList,
} from "../lib/staff.logic";
import type {
  AddOrgStaffPayload,
  AddOrgStaffResult,
  OrgStaffInvite,
  OrgStaffMember,
  OrgStaffUpdatePatch,
  RemoveOrgStaffResult,
  StaffFeedback,
} from "../types";

export function useOrgStaff(orgId: string) {
  const queryClient = useQueryClient();
  const fetchStaff = useServerFn(listOrgStaffWithProfiles);
  const fetchInvites = useServerFn(listOrgStaffInvites);
  const addStaffFn = useServerFn(addOrgStaff);
  const updateStaffFn = useServerFn(updateOrgStaffPermissions);
  const removeStaffFn = useServerFn(removeOrgStaff);
  const revokeInviteFn = useServerFn(revokeOrgStaffInvite);
  const [feedback, setFeedback] = useState<StaffFeedback | null>(null);

  const staffQuery = useQuery({
    queryKey: ["org-staff", orgId],
    queryFn: async () => {
      const rows = (await fetchStaff({ data: { organization_id: orgId } })) as Array<
        Omit<OrgStaffMember, "permissions"> & { permissions?: string[] | null }
      >;

      return rows.map((row) => ({
        ...row,
        permissions: normalizePermissionList(row.permissions),
      }));
    },
  });

  const invitesQuery = useQuery({
    queryKey: ["org-staff-invites", orgId],
    queryFn: async () =>
      (await fetchInvites({ data: { organization_id: orgId } })) as OrgStaffInvite[],
  });

  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["org-staff", orgId] }),
      queryClient.invalidateQueries({ queryKey: ["org-staff-invites", orgId] }),
    ]);
  }, [orgId, queryClient]);

  const removeMutation = useMutation({
    mutationFn: async (values: { id: string; deleteAccount: boolean }) =>
      (await removeStaffFn({
        data: { id: values.id, delete_account: values.deleteAccount },
      })) as RemoveOrgStaffResult,
    onSuccess: async (result) => {
      await invalidate();
      setFeedback({ kind: "success", text: getRemoveStaffSuccessMessage(result) });
    },
    onError: (error) => {
      setFeedback({
        kind: "error",
        text: error instanceof Error ? error.message : "Fehler beim Entfernen.",
      });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeInviteFn({ data: { id } }),
    onSuccess: async () => {
      await invalidate();
      setFeedback({ kind: "success", text: "Einladung zurückgezogen." });
    },
    onError: (error) => {
      setFeedback({
        kind: "error",
        text:
          error instanceof Error ? error.message : "Einladung konnte nicht zurückgezogen werden.",
      });
    },
  });

  const addStaffMember = useCallback(
    async (payload: AddOrgStaffPayload) => {
      try {
        const result = (await addStaffFn({
          data: { organization_id: orgId, ...payload },
        })) as AddOrgStaffResult;

        await invalidate();
        setFeedback({
          kind: "success",
          text: getAddStaffSuccessMessage(result, payload.email),
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Staff konnte nicht hinzugefügt werden.";
        setFeedback({ kind: "error", text: message });
        throw error;
      }
    },
    [addStaffFn, invalidate, orgId],
  );

  const updateStaffMember = useCallback(
    async (id: string, patch: OrgStaffUpdatePatch) => {
      try {
        await updateStaffFn({ data: { id, ...patch } });
        await invalidate();
        setFeedback({ kind: "success", text: "Aktualisiert." });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Staff konnte nicht aktualisiert werden.";
        setFeedback({ kind: "error", text: message });
        throw error;
      }
    },
    [invalidate, updateStaffFn],
  );

  return {
    staff: staffQuery.data ?? [],
    invites: getPendingStaffInvites(invitesQuery.data ?? []),
    isLoading: staffQuery.isLoading || invitesQuery.isLoading,
    feedback,
    addStaffMember,
    updateStaffMember,
    removeStaffMember: (id: string, deleteAccount: boolean) =>
      removeMutation.mutate({ id, deleteAccount }),
    revokeInvite: (id: string) => revokeMutation.mutate(id),
    isRemoving: removeMutation.isPending,
    isRevoking: revokeMutation.isPending,
  };
}

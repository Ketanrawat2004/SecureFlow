import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Shield,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { z } from 'zod';
import { api, normalizeApiError } from '@/lib/api/client';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { Input } from '@/components/forms/Input';
import { Select } from '@/components/forms/Select';
import { Can } from '@/features/auth/Can';
import { useAuth } from '@/features/auth/AuthContext';
import { useAppStore } from '@/stores/useAppStore';
import { Membership, Role } from '@/types';

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  role_id: z.string().min(1, 'Please select a role'),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

export const MembersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { activeOrgId } = useAppStore();

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Membership | null>(null);
  const [removingMember, setRemovingMember] = useState<Membership | null>(null);
  const [selectedNewRole, setSelectedNewRole] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);

  // Fetch Members
  const {
    data: members,
    isLoading,
    error,
    refetch,
  } = useQuery<Membership[]>({
    queryKey: ['members', activeOrgId],
    queryFn: () => api.get<Membership[]>('/members'),
  });

  // Fetch Roles
  const { data: roles } = useQuery<Role[]>({
    queryKey: ['roles', activeOrgId],
    queryFn: () => api.get<Role[]>('/roles'),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      full_name: '',
      role_id: '',
    },
  });

  // Invite Mutation
  const inviteMutation = useMutation({
    mutationFn: (values: InviteFormValues) => api.post<Membership>('/members/invite', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      setIsInviteModalOpen(false);
      reset();
      setServerError(null);
    },
    onError: (err: any) => {
      setServerError(normalizeApiError(err, 'Failed to invite member'));
    },
  });

  // Role Update Mutation
  const roleUpdateMutation = useMutation({
    mutationFn: ({ memberId, roleId }: { memberId: string; roleId: string }) =>
      api.put<Membership>(`/members/${memberId}/role`, { role_id: roleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      setEditingMember(null);
      setServerError(null);
    },
    onError: (err: any) => {
      setServerError(normalizeApiError(err, 'Failed to update member role'));
    },
  });

  // Remove Mutation
  const removeMutation = useMutation({
    mutationFn: (memberId: string) => api.delete(`/members/${memberId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      setRemovingMember(null);
      setServerError(null);
    },
    onError: (err: any) => {
      setServerError(normalizeApiError(err, 'Failed to remove member'));
    },
  });

  const onInviteSubmit = (values: InviteFormValues) => {
    setServerError(null);
    inviteMutation.mutate(values);
  };

  const roleColors: Record<string, 'purple' | 'info' | 'success' | 'warning' | 'neutral'> = {
    Owner: 'purple',
    Admin: 'info',
    Developer: 'success',
    Auditor: 'warning',
    Viewer: 'neutral',
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-750">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-surface-100">
              Team Directory
            </h1>
            <span className="text-xs text-surface-400 font-mono">
              ({members?.length ?? 0})
            </span>
          </div>
          <p className="text-xs text-surface-400 mt-0.5">
            Manage authorized users, assign organizational roles, and enforce security policies
          </p>
        </div>

        <Can permission="member.invite">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<UserPlus className="w-3.5 h-3.5" />}
            onClick={() => setIsInviteModalOpen(true)}
          >
            Invite Member
          </Button>
        </Can>
      </div>

      {/* Members Directory Table */}
      {error ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="bg-surface-900 border border-surface-750 rounded-md p-4 space-y-2.5">
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-full" />
        </div>
      ) : members && members.length > 0 ? (
        <div className="bg-surface-900 border border-surface-750 rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-surface-750 bg-surface-950/40 text-[11px] font-medium text-surface-400">
                  <th className="py-2.5 px-3.5">Name</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 font-mono">Joined</th>
                  <th className="py-2.5 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                {members.map((mem) => (
                  <tr key={mem.id} className="hover:bg-surface-850/50 transition-colors">
                    <td className="py-2.5 px-3.5 font-medium text-surface-200">
                      <div className="flex items-center gap-1.5">
                        <span>{mem.user.full_name}</span>
                        {mem.user_id === currentUser?.id && (
                          <span className="text-[9px] bg-surface-800 text-brand-400 px-1 py-0.2 rounded font-mono">
                            YOU
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-2.5 px-3 font-mono text-[11px] text-surface-400">
                      {mem.user.email}
                    </td>

                    <td className="py-2.5 px-3">
                      <Badge variant={roleColors[mem.role?.name] || 'neutral'} size="xs">
                        {mem.role?.name || 'Member'}
                      </Badge>
                    </td>

                    <td className="py-2.5 px-3">
                      <Badge variant={mem.status === 'active' ? 'success' : 'warning'} size="xs" dot>
                        {mem.status.toUpperCase()}
                      </Badge>
                    </td>

                    <td className="py-2.5 px-3 font-mono text-[11px] text-surface-400">
                      {new Date(mem.created_at).toLocaleDateString()}
                    </td>

                    <td className="py-2.5 px-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Can permission="role.assign">
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => {
                              setEditingMember(mem);
                              setSelectedNewRole(mem.role_id);
                            }}
                          >
                            Change Role
                          </Button>
                        </Can>

                        <Can permission="member.remove">
                          {mem.user_id !== currentUser?.id && (
                            <button
                              onClick={() => setRemovingMember(mem)}
                              aria-label="Remove member"
                              className="p-1 text-surface-400 hover:text-rose-400 rounded hover:bg-surface-800 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </Can>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<Users className="w-6 h-6" />}
          title="No members found"
          description="Invite your team members to collaborate on workflows and project reviews."
          actionLabel="Invite Member"
          onAction={() => setIsInviteModalOpen(true)}
        />
      )}

      {/* Invite Member Modal */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => {
          setIsInviteModalOpen(false);
          reset();
          setServerError(null);
        }}
        title="Invite New Team Member"
        description="Grant access to this workspace and assign their initial authorization role."
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsInviteModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit(onInviteSubmit)}
              isLoading={isSubmitting}
            >
              Send Invitation
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onInviteSubmit)} className="space-y-3">
          {serverError && (
            <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <Input
            label="Full Name"
            placeholder="Jordan Taylor"
            required
            error={errors.full_name?.message}
            {...register('full_name')}
          />

          <Input
            label="Work Email Address"
            type="email"
            placeholder="jordan.taylor@acmecloud.io"
            required
            error={errors.email?.message}
            {...register('email')}
          />

          <Select
            label="Workspace Role"
            required
            options={[
              { value: '', label: 'Select role' },
              ...(roles?.map((r) => ({
                value: r.id,
                label: `${r.name} - ${r.description}`,
              })) || []),
            ]}
            error={errors.role_id?.message}
            {...register('role_id')}
          />
        </form>
      </Modal>

      {/* Change Role Modal */}
      <Modal
        isOpen={editingMember !== null}
        onClose={() => {
          setEditingMember(null);
          setServerError(null);
        }}
        title={`Change Role: ${editingMember?.user.full_name}`}
        description="Update permissions and authorization level for this user."
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setEditingMember(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={roleUpdateMutation.isPending}
              onClick={() => {
                if (editingMember && selectedNewRole) {
                  roleUpdateMutation.mutate({
                    memberId: editingMember.id,
                    roleId: selectedNewRole,
                  });
                }
              }}
            >
              Update Role
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {serverError && (
            <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            {roles?.map((role) => (
              <label
                key={role.id}
                className={`flex items-start justify-between p-2.5 rounded border cursor-pointer transition-colors ${
                  selectedNewRole === role.id
                    ? 'bg-surface-850 border-brand-500 text-surface-100'
                    : 'bg-surface-950/60 border-surface-750 text-surface-300 hover:border-surface-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="role"
                    value={role.id}
                    checked={selectedNewRole === role.id}
                    onChange={() => setSelectedNewRole(role.id)}
                    className="text-brand-500 focus:ring-brand-500"
                  />
                  <div>
                    <span className="text-xs font-semibold block">{role.name}</span>
                    <span className="text-[11px] text-surface-400 block mt-0.5">
                      {role.description}
                    </span>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </Modal>

      {/* Remove Member Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={removingMember !== null}
        onClose={() => setRemovingMember(null)}
        title="Remove Member from Workspace"
        message={`Are you sure you want to remove ${removingMember?.user.full_name} (${removingMember?.user.email})? They will immediately lose access to all projects, workflows, and audit logs.`}
        confirmLabel="Remove Member"
        variant="danger"
        isLoading={removeMutation.isPending}
        onConfirm={() => {
          if (removingMember) {
            removeMutation.mutate(removingMember.id);
          }
        }}
      />
    </div>
  );
};

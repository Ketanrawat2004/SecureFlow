import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAppStore } from '@/stores/useAppStore';
import { Permission, Role } from '@/types';

interface RolePermissionMatrixResponse {
  roles: Role[];
  categories: {
    category: string;
    permissions: Permission[];
  }[];
}

export const RolesPage: React.FC = () => {
  const { activeOrgId } = useAppStore();

  const { data: matrix, isLoading, error, refetch } = useQuery<RolePermissionMatrixResponse>({
    queryKey: ['roles', 'matrix', activeOrgId],
    queryFn: () => api.get<RolePermissionMatrixResponse>('/roles/matrix'),
  });

  const categoryTitles: Record<string, string> = {
    workspace: 'Workspace Governance',
    project: 'Projects & Repositories',
    workflow: 'Workflows & Deployments',
    member: 'Team Members & Invitations',
    role: 'Roles & Permissions',
    audit: 'Audit Logs & Compliance',
    analytics: 'Analytics & Metrics',
  };

  const roleColors: Record<string, 'purple' | 'info' | 'success' | 'warning' | 'neutral'> = {
    Owner: 'purple',
    Admin: 'info',
    Developer: 'success',
    Auditor: 'warning',
    Viewer: 'neutral',
  };

  if (error) {
    return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="pb-3 border-b border-surface-750">
        <div className="flex items-center gap-2">
          <h1 className="text-base sm:text-lg font-semibold tracking-tight text-surface-100">
            Roles & Permissions Matrix
          </h1>
        </div>
        <p className="text-xs text-surface-400 mt-0.5">
          Role-based access control matrix enforced across all API endpoints and actions
        </p>
      </div>

      {/* Role Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {matrix?.roles.map((role) => (
          <div
            key={role.id}
            className="bg-surface-900 border border-surface-750 rounded-md p-2.5 space-y-1"
          >
            <div className="flex items-center justify-between">
              <Badge variant={roleColors[role.name] || 'neutral'} size="xs">
                {role.name}
              </Badge>
              {role.is_system && (
                <span className="text-[10px] text-surface-500 font-mono">System</span>
              )}
            </div>
            <p className="text-[11px] text-surface-400 leading-tight line-clamp-2">
              {role.description}
            </p>
          </div>
        ))}
      </div>

      {/* Permission Matrix Tables Grouped by Category */}
      {isLoading ? (
        <div className="bg-surface-900 border border-surface-750 rounded-md p-4 space-y-3">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : matrix ? (
        <div className="space-y-4">
          {matrix.categories.map((catGroup) => (
            <div
              key={catGroup.category}
              className="bg-surface-900 border border-surface-750 rounded-md overflow-hidden"
            >
              <div className="px-3.5 py-2 bg-surface-950/40 border-b border-surface-750 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase font-mono tracking-wider text-surface-300">
                  {categoryTitles[catGroup.category] || catGroup.category}
                </h3>
                <span className="text-[10px] font-mono text-surface-500">
                  {catGroup.permissions.length} actions
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-surface-750 bg-surface-900 text-[11px] font-medium text-surface-400">
                      <th className="py-2 px-3.5 w-2/5">Action / Permission</th>
                      {matrix.roles.map((role) => (
                        <th key={role.id} className="py-2 px-2 text-center font-medium">
                          <span className="text-surface-300 text-[11px]">{role.name}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-800">
                    {catGroup.permissions.map((perm) => (
                      <tr key={perm.id} className="hover:bg-surface-850/50 transition-colors">
                        <td className="py-2 px-3.5">
                          <div className="font-mono font-medium text-brand-400 text-[11px]">
                            {perm.code}
                          </div>
                          <div className="text-surface-400 text-[10px] mt-0.5">
                            {perm.description}
                          </div>
                        </td>

                        {matrix.roles.map((role) => {
                          const hasPerm = role.permissions.some((p) => p.code === perm.code);
                          return (
                            <td key={role.id} className="py-2 px-2 text-center">
                              {hasPerm ? (
                                <span className="inline-flex items-center justify-center text-emerald-400 font-mono text-xs" title="Allowed">
                                  ✓
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center text-surface-600 font-mono text-xs" title="Not Allowed">
                                  —
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

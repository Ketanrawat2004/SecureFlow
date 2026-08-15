import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Code,
  Lock,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/features/auth/AuthContext';
import { useAppStore } from '@/stores/useAppStore';
import { AuditLog, PaginatedResponse } from '@/types';

export const AuditLogsPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeOrgId } = useAppStore();
  const { hasPermission, activeRole } = useAuth();
  const canReadAudit = hasPermission('audit.read');

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Fetch Audit Logs ONLY if user has audit.read permission
  const {
    data: auditData,
    isLoading,
    error,
    refetch,
  } = useQuery<PaginatedResponse<AuditLog>>({
    queryKey: ['audit', activeOrgId, search, actionFilter, resourceFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: '20',
      });
      if (search) params.append('search', search);
      if (actionFilter !== 'all') params.append('action', actionFilter);
      if (resourceFilter !== 'all') params.append('resource_type', resourceFilter);
      return api.get<PaginatedResponse<AuditLog>>(`/audit-logs?${params.toString()}`);
    },
    enabled: canReadAudit && !!activeOrgId,
  });

  const getActionBadge = (action: string) => {
    if (action.includes('approved')) {
      return <Badge variant="success" size="xs">{action}</Badge>;
    }
    if (action.includes('rejected') || action.includes('removed')) {
      return <Badge variant="danger" size="xs">{action}</Badge>;
    }
    if (action.includes('changes_requested') || action.includes('changed')) {
      return <Badge variant="purple" size="xs">{action}</Badge>;
    }
    if (action.includes('created') || action.includes('invited')) {
      return <Badge variant="info" size="xs">{action}</Badge>;
    }
    return <Badge variant="neutral" size="xs">{action}</Badge>;
  };

  // If role is not authorized for audit logs, show clean access-restricted state
  if (!canReadAudit) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <div className="w-10 h-10 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
          <Lock className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-surface-100 uppercase font-mono tracking-wider">
            Audit Ledger Access Restricted
          </h2>
          <p className="text-xs text-surface-400 max-w-md mx-auto leading-relaxed">
            The security event audit ledger is restricted to Compliance Officers, Auditors, and Organization Administrators. Your role (<span className="text-surface-200 font-mono font-medium">{activeRole || 'Viewer'}</span>) has read-only access to projects and workflows.
          </p>
        </div>
        <div className="pt-2">
          <Button variant="secondary" size="sm" onClick={() => navigate('/')}>
            Return to Overview
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-750">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-surface-100">
              Security Audit Ledger
            </h1>
            <Badge variant="neutral" size="xs">
              {auditData?.total ?? 0} Events
            </Badge>
          </div>
          <p className="text-xs text-surface-400 mt-0.5">
            Immutable, chronological record of all authentication, pipeline approvals, and permission changes
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-surface-900 border border-surface-750 p-2.5 rounded-md flex flex-col md:flex-row items-center gap-2.5">
        <div className="relative flex-1 w-full">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            placeholder="Search by actor email, action, resource, or context..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-surface-950 border border-surface-750 rounded text-xs pl-8 pr-3 py-1.5 text-surface-200 placeholder-surface-500 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="bg-surface-950 border border-surface-750 rounded text-xs px-2.5 py-1.5 text-surface-300 focus:outline-none focus:border-brand-500"
          >
            <option value="all">All Actions</option>
            <option value="workflow.created">Workflow Created</option>
            <option value="workflow.approved">Workflow Approved</option>
            <option value="workflow.rejected">Workflow Rejected</option>
            <option value="workflow.changes_requested">Changes Requested</option>
            <option value="project.created">Project Created</option>
            <option value="project.updated">Project Updated</option>
            <option value="member.invited">Member Invited</option>
            <option value="role.changed">Role Changed</option>
            <option value="member.removed">Member Removed</option>
          </select>

          <select
            value={resourceFilter}
            onChange={(e) => {
              setResourceFilter(e.target.value);
              setPage(1);
            }}
            className="bg-surface-950 border border-surface-750 rounded text-xs px-2.5 py-1.5 text-surface-300 focus:outline-none focus:border-brand-500"
          >
            <option value="all">All Resources</option>
            <option value="workflow">Workflow</option>
            <option value="project">Project</option>
            <option value="member">Member</option>
            <option value="user">User</option>
          </select>
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="bg-surface-900 border border-surface-750 rounded-md overflow-hidden">
        {error ? (
          <div className="p-6">
            <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
          </div>
        ) : isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={8} columns={5} />
          </div>
        ) : auditData?.items && auditData.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-surface-750 bg-surface-950/40 text-[11px] font-medium text-surface-400">
                  <th className="py-2.5 px-3.5">Timestamp</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Actor</th>
                  <th className="py-2.5 px-3">Resource</th>
                  <th className="py-2.5 px-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                {auditData.items.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-850/50 transition-colors">
                    <td className="py-2.5 px-3.5 font-mono text-[11px] text-surface-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3">{getActionBadge(log.action)}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono text-[11px] text-surface-200">
                        {log.actor_email || 'system'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1 font-mono text-[10px] text-surface-400">
                        <span className="text-surface-300 font-semibold">{log.resource_type}:</span>
                        <span className="truncate max-w-[120px]">{log.resource_id}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3.5 text-right">
                      <Button
                        variant="secondary"
                        size="xs"
                        leftIcon={<Code className="w-3 h-3" />}
                        onClick={() => setSelectedLog(log)}
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Pagination
              page={page}
              pageSize={20}
              totalItems={auditData.total}
              totalPages={auditData.total_pages}
              onPageChange={setPage}
            />
          </div>
        ) : (
          <div className="p-8">
            <EmptyState
              icon={<ShieldAlert className="w-6 h-6" />}
              title="No audit events found"
              description="No recorded audit actions match your active filter criteria."
            />
          </div>
        )}
      </div>

      {/* Raw Payload Inspector Modal */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title={`Audit Payload: ${selectedLog.action}`}
          size="md"
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-[11px] p-2.5 rounded bg-surface-950 border border-surface-750">
              <div>
                <span className="text-surface-500 block font-mono text-[10px]">TIMESTAMP</span>
                <span className="text-surface-200 font-mono">
                  {new Date(selectedLog.created_at).toISOString()}
                </span>
              </div>
              <div>
                <span className="text-surface-500 block font-mono text-[10px]">ACTOR</span>
                <span className="text-surface-200 font-mono">{selectedLog.actor_email}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-mono uppercase text-surface-500 block mb-1">
                Context Payload:
              </span>
              <pre className="p-3 rounded bg-surface-950 border border-surface-750 text-[11px] font-mono text-brand-300 overflow-x-auto max-h-60 leading-relaxed">
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(selectedLog.context || '{}'), null, 2);
                  } catch {
                    return selectedLog.context || '{}';
                  }
                })()}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" size="xs" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAppStore } from '@/stores/useAppStore';
import { Approval, PaginatedResponse } from '@/types';

export const ApprovalQueuePage: React.FC = () => {
  const navigate = useNavigate();
  const { activeOrgId } = useAppStore();

  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [page, setPage] = useState(1);

  // Fetch Approvals
  const {
    data: approvalsData,
    isLoading,
    error,
    refetch,
  } = useQuery<PaginatedResponse<Approval>>({
    queryKey: ['approvals', activeOrgId, statusFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: '12',
      });
      if (statusFilter !== 'all') params.append('status', statusFilter);
      return api.get<PaginatedResponse<Approval>>(`/approvals?${params.toString()}`);
    },
  });

  const getRiskBadge = (risk?: string) => {
    switch (risk) {
      case 'critical':
        return <Badge variant="danger" size="xs">Critical</Badge>;
      case 'high':
        return <Badge variant="warning" size="xs">High</Badge>;
      case 'medium':
        return <Badge variant="neutral" size="xs">Medium</Badge>;
      default:
        return <Badge variant="neutral" size="xs">Low</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success" size="xs" dot>Approved</Badge>;
      case 'pending':
        return <Badge variant="warning" size="xs" dot>Pending Sign-off</Badge>;
      case 'rejected':
        return <Badge variant="danger" size="xs" dot>Rejected</Badge>;
      case 'changes_requested':
        return <Badge variant="purple" size="xs" dot>Changes Requested</Badge>;
      default:
        return <Badge variant="neutral" size="xs">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-750">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-surface-100">
              Approval Queue
            </h1>
            <span className="text-xs text-surface-400 font-mono">
              ({approvalsData?.total ?? 0})
            </span>
          </div>
          <p className="text-xs text-surface-400 mt-0.5">
            Engineering gate sign-offs and security review requests
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-surface-900 border border-surface-750 p-0.5 rounded">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => {
                setStatusFilter(filter);
                setPage(1);
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded capitalize transition-colors ${
                statusFilter === filter
                  ? 'bg-surface-800 text-brand-400 font-semibold border border-surface-700'
                  : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              {filter === 'pending' ? 'Needs Sign-off' : filter}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {error ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface-900 border border-surface-750 rounded-md p-3.5 space-y-2.5">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      ) : approvalsData?.items && approvalsData.items.length > 0 ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {approvalsData.items.map((appr) => {
              const wf = appr.workflow;
              return (
                <div
                  key={appr.id}
                  onClick={() => wf && navigate(`/workflows/${wf.id}`)}
                  className="bg-surface-900 border border-surface-750 hover:border-surface-600 rounded-md p-3.5 shadow-subtle transition-colors cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-surface-950 text-brand-400 border border-surface-750">
                          {wf?.project?.key || 'PRJ'}
                        </span>
                        <h3 className="text-xs font-semibold text-surface-100 group-hover:text-brand-400 transition-colors truncate">
                          {wf?.name || 'Workflow Item'}
                        </h3>
                      </div>
                      {getStatusBadge(appr.status)}
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      {getRiskBadge(wf?.risk_level)}
                      {appr.step && (
                        <span className="text-[10px] text-surface-400 font-mono">
                          Gate: {appr.step.name}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-surface-400 mt-2 line-clamp-2 leading-relaxed">
                      {wf?.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-surface-750 flex items-center justify-between text-[11px]">
                    <span className="text-surface-400 font-mono">
                      Requester: {appr.requester?.full_name?.split(' ')[0] || 'Dev'}
                    </span>

                    <div className="flex items-center gap-1 text-brand-400 font-medium group-hover:text-brand-300">
                      <span>Review & Decide</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Pagination
            page={approvalsData.page}
            totalPages={approvalsData.total_pages}
            totalItems={approvalsData.total}
            pageSize={approvalsData.page_size}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      ) : (
        <EmptyState
          icon={<CheckCircle2 className="w-6 h-6 text-emerald-400" />}
          title="All caught up"
          description={
            statusFilter === 'pending'
              ? 'There are no pending approvals requiring your sign-off.'
              : 'No approval requests match the current status filter.'
          }
        />
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Clock,
  GitPullRequest,
  ShieldAlert,
} from 'lucide-react';
import { api, normalizeApiError } from '@/lib/api/client';
import { Badge } from '@/components/ui/Badge';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { Input } from '@/components/forms/Input';
import { Textarea } from '@/components/forms/Textarea';
import { useAuth } from '@/features/auth/AuthContext';
import { useAppStore } from '@/stores/useAppStore';
import { Workflow } from '@/types';

export const WorkflowDetailPage: React.FC = () => {
  const { workflowId } = useParams<{ workflowId: string }>();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const { activeOrgId } = useAppStore();

  const [decisionType, setDecisionType] = useState<'approve' | 'reject' | 'request_changes' | null>(null);
  const [decisionComment, setDecisionComment] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [decisionError, setDecisionError] = useState<string | null>(null);

  // Fetch Workflow Detail
  const {
    data: workflow,
    isLoading,
    error,
    refetch,
  } = useQuery<Workflow>({
    queryKey: ['workflow', workflowId, activeOrgId],
    queryFn: () => api.get<Workflow>(`/workflows/${workflowId}`),
    enabled: !!workflowId,
  });

  // Decision Mutation
  const decisionMutation = useMutation({
    mutationFn: (payload: { decision: string; comments?: string; decision_reason?: string }) =>
      api.post<Workflow>(`/workflows/${workflowId}/decide`, payload),
    onSuccess: (updatedWf) => {
      queryClient.setQueryData(['workflow', workflowId, activeOrgId], updatedWf);
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      setDecisionType(null);
      setDecisionComment('');
      setDecisionReason('');
      setDecisionError(null);
    },
    onError: (err: any) => {
      setDecisionError(normalizeApiError(err, 'Failed to submit decision. Please try again.'));
    },
  });

  const handleDecisionSubmit = () => {
    if (!decisionType) return;
    setDecisionError(null);
    decisionMutation.mutate({
      decision: decisionType,
      comments: decisionComment,
      decision_reason: decisionReason,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
      case 'executed':
        return <Badge variant="success" size="xs" dot>Approved</Badge>;
      case 'pending_approval':
      case 'in_progress':
        return <Badge variant="warning" size="xs" dot>Pending Approval</Badge>;
      case 'rejected':
        return <Badge variant="danger" size="xs" dot>Rejected</Badge>;
      case 'changes_requested':
        return <Badge variant="purple" size="xs" dot>Changes Requested</Badge>;
      default:
        return <Badge variant="neutral" size="xs">{status}</Badge>;
    }
  };

  const getRiskBadge = (risk: string) => {
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

  if (error) {
    return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />;
  }

  if (isLoading || !workflow) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const canApprove = hasPermission('workflow.approve');
  const canReject = hasPermission('workflow.reject');
  const isPending = workflow.status === 'pending_approval' || workflow.status === 'in_progress';

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Workflows', href: '/workflows' },
          { label: workflow.name },
        ]}
      />

      {/* Header Overview Card */}
      <div className="bg-surface-900 border border-surface-750 rounded-md p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-surface-950 text-brand-400 border border-surface-750">
                {workflow.project?.key}
              </span>
              <h1 className="text-base font-semibold text-surface-100">{workflow.name}</h1>
              {getStatusBadge(workflow.status)}
              {getRiskBadge(workflow.risk_level)}
            </div>
            <p className="text-xs text-surface-400 mt-1 max-w-3xl leading-relaxed">
              {workflow.description || 'No detailed change description provided.'}
            </p>
          </div>

          {/* Action Decision Buttons */}
          {isPending && (
            <div className="flex items-center gap-1.5 shrink-0">
              {canReject && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDecisionType('request_changes');
                      setDecisionReason('Modifications required');
                    }}
                  >
                    Request Changes
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setDecisionType('reject');
                      setDecisionReason('Security policy rejection');
                    }}
                  >
                    Reject
                  </Button>
                </>
              )}
              {canApprove && (
                <Button
                  variant="success"
                  size="sm"
                  leftIcon={<Check className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setDecisionType('approve');
                    setDecisionReason('Approved by authorized reviewer');
                  }}
                >
                  Approve Stage
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Metadata Strip */}
        <div className="pt-3 border-t border-surface-750 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-[10px] text-surface-500 uppercase font-mono tracking-wider">Submitted By</span>
            <span className="text-surface-200 font-medium block truncate text-xs mt-0.5">
              {workflow.creator?.full_name || 'Author'}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-surface-500 uppercase font-mono tracking-wider">Domain / Project</span>
            <span className="text-surface-200 font-medium block text-xs mt-0.5">
              {workflow.project?.name}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-surface-500 uppercase font-mono tracking-wider">Created Date</span>
            <span className="text-surface-300 font-mono block text-xs mt-0.5">
              {new Date(workflow.created_at).toLocaleDateString()}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-surface-500 uppercase font-mono tracking-wider">Current Pipeline Stage</span>
            <span className="text-brand-400 font-mono font-semibold block text-xs mt-0.5">
              Stage {workflow.current_step_index + 1} of {workflow.steps.length}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Pipeline Step Tracker & Approvals History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Cols: Step Pipeline Visual Tracker */}
        <div className="lg:col-span-2 bg-surface-900 border border-surface-750 rounded-md p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-surface-750">
            <h2 className="text-xs font-semibold text-surface-100 uppercase font-mono tracking-wider flex items-center gap-1.5">
              <GitPullRequest className="w-3.5 h-3.5 text-brand-400" />
              Pipeline Approval Gates
            </h2>
            <span className="text-[10px] text-surface-400 font-mono">
              {workflow.steps.filter((s) => s.status === 'approved').length} of {workflow.steps.length} approved
            </span>
          </div>

          {/* Sequential Step Cards */}
          <div className="space-y-2">
            {workflow.steps.map((step, idx) => {
              const isCurrent = idx === workflow.current_step_index && isPending;
              const isApproved = step.status === 'approved';
              const isRejected = step.status === 'rejected';

              return (
                <div
                  key={step.id}
                  className={`p-3 rounded border transition-colors ${
                    isCurrent
                      ? 'bg-surface-850 border-brand-500/50'
                      : isApproved
                      ? 'bg-surface-950/60 border-emerald-900/30'
                      : isRejected
                      ? 'bg-rose-950/20 border-rose-900/40'
                      : 'bg-surface-950/30 border-surface-800 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center font-mono text-[10px] font-bold shrink-0 mt-0.5 ${
                          isApproved
                            ? 'bg-emerald-500 text-surface-950'
                            : isRejected
                            ? 'bg-rose-500 text-white'
                            : isCurrent
                            ? 'bg-brand-500 text-surface-950'
                            : 'bg-surface-800 text-surface-400'
                        }`}
                      >
                        {isApproved ? <Check className="w-3 h-3 stroke-[3]" /> : idx + 1}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-semibold text-surface-100">{step.name}</h3>
                          <Badge variant="neutral" size="xs">
                            Required: {step.required_role}
                          </Badge>
                        </div>
                        {step.description && (
                          <p className="text-[11px] text-surface-400 mt-0.5">{step.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {isApproved ? (
                        <div className="text-right">
                          <Badge variant="success" size="xs">Approved</Badge>
                          {step.approved_at && (
                            <span className="text-[10px] text-surface-500 block font-mono mt-0.5">
                              {new Date(step.approved_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      ) : isRejected ? (
                        <Badge variant="danger" size="xs">Rejected</Badge>
                      ) : isCurrent ? (
                        <Badge variant="warning" size="xs" dot>Awaiting Sign-off</Badge>
                      ) : (
                        <Badge variant="neutral" size="xs">Pending</Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 1 Col: Decision Audit History */}
        <div className="bg-surface-900 border border-surface-750 rounded-md p-4 space-y-3">
          <h2 className="text-xs font-semibold text-surface-100 uppercase font-mono tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-brand-400" />
            Decision Audit Trail
          </h2>

          <div className="divide-y divide-surface-800 text-xs space-y-2.5">
            {workflow.approvals && workflow.approvals.length > 0 ? (
              workflow.approvals.map((appr) => (
                <div key={appr.id} className="pt-2.5 first:pt-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-surface-200 text-xs">
                      {appr.status === 'approved' ? 'Stage Approved' : appr.status === 'rejected' ? 'Rejected' : 'Changes Requested'}
                    </span>
                    <span className="text-[10px] text-surface-500 font-mono">
                      {new Date(appr.decided_at || appr.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-surface-400 text-[11px]">
                    <span>Reviewer:</span>
                    <span className="text-surface-200 font-mono">{appr.approver?.full_name || 'Reviewer'}</span>
                  </div>

                  {appr.decision_reason && (
                    <p className="text-surface-400 text-[11px] italic">
                      "{appr.decision_reason}"
                    </p>
                  )}
                  {appr.comments && (
                    <p className="text-surface-300 bg-surface-950 p-2 rounded border border-surface-750 font-mono text-[10px]">
                      {appr.comments}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-surface-400 text-xs">
                No decisions recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Decision Review Modal */}
      <Modal
        isOpen={decisionType !== null}
        onClose={() => setDecisionType(null)}
        title={
          decisionType === 'approve'
            ? 'Approve Workflow Stage'
            : decisionType === 'reject'
            ? 'Reject Workflow Pipeline'
            : 'Request Modifications'
        }
        description={
          decisionType === 'approve'
            ? 'Advance this pipeline to the next stage in the authorization sequence.'
            : decisionType === 'reject'
            ? 'Permanently halt execution of this engineering pipeline.'
            : 'Provide change criteria for the author.'
        }
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDecisionType(null)}>
              Cancel
            </Button>
            <Button
              variant={decisionType === 'approve' ? 'success' : decisionType === 'reject' ? 'danger' : 'primary'}
              size="sm"
              onClick={handleDecisionSubmit}
              isLoading={decisionMutation.isPending}
            >
              {decisionType === 'approve'
                ? 'Confirm Approval'
                : decisionType === 'reject'
                ? 'Confirm Rejection'
                : 'Submit Request'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {decisionError && (
            <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>{decisionError}</span>
            </div>
          )}

          <Input
            label="Decision Rationale"
            placeholder={
              decisionType === 'approve'
                ? 'e.g., Rollback plan verified, tests passed'
                : 'e.g., Fails egress network policy'
            }
            value={decisionReason}
            onChange={(e) => setDecisionReason(e.target.value)}
          />

          <Textarea
            label="Reviewer Comments (Optional)"
            placeholder="Add detailed verification context..."
            value={decisionComment}
            onChange={(e) => setDecisionComment(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
};

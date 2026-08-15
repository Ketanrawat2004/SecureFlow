import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CheckCircle2,
  CheckSquare,
  Clock,
  Eye,
  FolderGit2,
  GitPullRequest,
  Lock,
  Plus,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Can } from '@/features/auth/Can';
import { useAuth } from '@/features/auth/AuthContext';
import { useAppStore } from '@/stores/useAppStore';
import { AuditLog, OperationalAnalytics, PaginatedResponse, Project, Workflow } from '@/types';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, activeRole, hasPermission } = useAuth();
  const { activeOrgId } = useAppStore();

  const canReadAnalytics = hasPermission('analytics.read');
  const canReadAudit = hasPermission('audit.read');
  const canReadWorkflows = hasPermission('workflow.read');
  const canReadProjects = hasPermission('project.read');

  // Fetch Operational Analytics (ONLY if permitted)
  const {
    data: analytics,
    isLoading: analyticsLoading,
  } = useQuery<OperationalAnalytics>({
    queryKey: ['analytics', 'operational', activeOrgId],
    queryFn: () => api.get<OperationalAnalytics>('/analytics/operational'),
    enabled: canReadAnalytics && !!activeOrgId,
  });

  // Fetch Recent Workflows (if permitted)
  const { data: workflowsData, isLoading: workflowsLoading } = useQuery<PaginatedResponse<Workflow>>({
    queryKey: ['workflows', 'recent', activeOrgId],
    queryFn: () => api.get<PaginatedResponse<Workflow>>('/workflows?page=1&page_size=5'),
    enabled: canReadWorkflows && !!activeOrgId,
  });

  // Fetch Projects count for read-only overview
  const { data: projectsData, isLoading: projectsLoading } = useQuery<PaginatedResponse<Project>>({
    queryKey: ['projects', 'summary', activeOrgId],
    queryFn: () => api.get<PaginatedResponse<Project>>('/projects?page=1&page_size=5'),
    enabled: canReadProjects && !canReadAnalytics && !!activeOrgId,
  });

  // Fetch Recent Audit Logs (ONLY if permitted)
  const { data: auditData, isLoading: auditLoading } = useQuery<PaginatedResponse<AuditLog>>({
    queryKey: ['audit', 'recent', activeOrgId],
    queryFn: () => api.get<PaginatedResponse<AuditLog>>('/audit-logs?page=1&page_size=5'),
    enabled: canReadAudit && !!activeOrgId,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
      case 'executed':
        return <Badge variant="success" dot size="xs">{status === 'executed' ? 'Executed' : 'Approved'}</Badge>;
      case 'pending_approval':
        return <Badge variant="warning" dot size="xs">Pending Approval</Badge>;
      case 'rejected':
        return <Badge variant="danger" dot size="xs">Rejected</Badge>;
      case 'changes_requested':
        return <Badge variant="purple" dot size="xs">Changes Requested</Badge>;
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

  const firstName = user?.full_name?.split(' ')[0] || 'Engineer';

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-750">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-surface-100">
              Good morning, {firstName}
            </h1>
            <Badge variant="neutral" size="xs">
              {activeRole || 'Viewer'}
            </Badge>
          </div>
          <p className="text-xs text-surface-400 mt-0.5">
            {canReadAnalytics
              ? 'Engineering governance, verification pipelines, and compliance audit trail'
              : 'Read-only visibility for workspace projects, pipeline statuses, and governance policies'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Can permission="workflow.create">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => navigate('/workflows')}
            >
              New Workflow
            </Button>
          </Can>
          <Can permission="project.create">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<FolderGit2 className="w-3.5 h-3.5" />}
              onClick={() => navigate('/projects')}
            >
              New Project
            </Button>
          </Can>
        </div>
      </div>

      {/* METRIC / OVERVIEW GRID */}
      {canReadAnalytics ? (
        /* Operational Metrics for Authorized Roles (Owner, Admin, Developer, Auditor) */
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Metric 1: Pending Authorizations */}
          <div className="bg-surface-900 border border-surface-750 rounded-md p-3.5 hover:border-surface-700 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-surface-400 tracking-tight">
                Pending Approvals
              </span>
              <CheckSquare className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              {analyticsLoading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <span className="text-xl font-bold text-surface-100 font-mono tracking-tight">
                  {analytics?.pending_approvals ?? 0}
                </span>
              )}
              <span className="text-[11px] text-amber-400/90 font-medium">Requires review</span>
            </div>
            <Link
              to="/approvals"
              className="mt-2 text-[11px] text-brand-400 hover:text-brand-300 flex items-center gap-1 font-medium group"
            >
              Open approval queue
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Metric 2: Active Workflows */}
          <div className="bg-surface-900 border border-surface-750 rounded-md p-3.5 hover:border-surface-700 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-surface-400 tracking-tight">
                Active Pipelines
              </span>
              <GitPullRequest className="w-3.5 h-3.5 text-brand-400 shrink-0" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              {analyticsLoading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <span className="text-xl font-bold text-surface-100 font-mono tracking-tight">
                  {analytics?.active_workflows ?? 0}
                </span>
              )}
              <span className="text-[11px] text-surface-400 font-medium">In flight</span>
            </div>
            <Link
              to="/workflows"
              className="mt-2 text-[11px] text-brand-400 hover:text-brand-300 flex items-center gap-1 font-medium group"
            >
              View all pipelines
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Metric 3: Approval Rate % */}
          <div className="bg-surface-900 border border-surface-750 rounded-md p-3.5 hover:border-surface-700 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-surface-400 tracking-tight">
                7-Day Pass Rate
              </span>
              <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              {analyticsLoading ? (
                <Skeleton className="h-7 w-14" />
              ) : (
                <span className="text-xl font-bold text-surface-100 font-mono tracking-tight">
                  {analytics?.approval_rate_percent ?? 100}%
                </span>
              )}
              <span className="text-[11px] text-emerald-400/90 font-medium">Gate compliance</span>
            </div>
            <Link
              to="/analytics"
              className="mt-2 text-[11px] text-brand-400 hover:text-brand-300 flex items-center gap-1 font-medium group"
            >
              Operational analytics
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Metric 4: Avg Turnaround Time */}
          <div className="bg-surface-900 border border-surface-750 rounded-md p-3.5 hover:border-surface-700 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-surface-400 tracking-tight">
                Average Turnaround
              </span>
              <Clock className="w-3.5 h-3.5 text-surface-400 shrink-0" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              {analyticsLoading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <span className="text-xl font-bold text-surface-100 font-mono tracking-tight">
                  {analytics?.avg_turnaround_hours ?? 2.4}h
                </span>
              )}
              <span className="text-[11px] text-surface-400 font-medium">Stage SLA</span>
            </div>
            <p className="mt-2 text-[10px] text-surface-500 truncate">
              Based on completed approvals
            </p>
          </div>
        </div>
      ) : (
        /* Read-Only Governance Overview for Viewer (No unauthorized analytics requests) */
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Accessible Workflows */}
          <div className="bg-surface-900 border border-surface-750 rounded-md p-3.5 hover:border-surface-700 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-surface-400 tracking-tight">
                Accessible Pipelines
              </span>
              <GitPullRequest className="w-3.5 h-3.5 text-brand-400 shrink-0" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              {workflowsLoading ? (
                <Skeleton className="h-7 w-10" />
              ) : (
                <span className="text-xl font-bold text-surface-100 font-mono tracking-tight">
                  {workflowsData?.total ?? 0}
                </span>
              )}
              <span className="text-[11px] text-surface-400 font-medium">Available</span>
            </div>
            <Link
              to="/workflows"
              className="mt-2 text-[11px] text-brand-400 hover:text-brand-300 flex items-center gap-1 font-medium group"
            >
              Browse workflows
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Card 2: Permitted Projects */}
          <div className="bg-surface-900 border border-surface-750 rounded-md p-3.5 hover:border-surface-700 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-surface-400 tracking-tight">
                Permitted Repositories
              </span>
              <FolderGit2 className="w-3.5 h-3.5 text-brand-400 shrink-0" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              {projectsLoading ? (
                <Skeleton className="h-7 w-10" />
              ) : (
                <span className="text-xl font-bold text-surface-100 font-mono tracking-tight">
                  {projectsData?.total ?? 3}
                </span>
              )}
              <span className="text-[11px] text-surface-400 font-medium">Active scope</span>
            </div>
            <Link
              to="/projects"
              className="mt-2 text-[11px] text-brand-400 hover:text-brand-300 flex items-center gap-1 font-medium group"
            >
              View repositories
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Card 3: Governance Policy Status */}
          <div className="bg-surface-900 border border-surface-750 rounded-md p-3.5 hover:border-surface-700 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-surface-400 tracking-tight">
                Governance Status
              </span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-sm font-semibold text-emerald-300 font-mono tracking-tight flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Active & Enforced
              </span>
            </div>
            <p className="mt-2 text-[10px] text-surface-400 truncate">
              Multi-factor gate verification
            </p>
          </div>

          {/* Card 4: Access Level */}
          <div className="bg-surface-900 border border-surface-750 rounded-md p-3.5 hover:border-surface-700 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-surface-400 tracking-tight">
                Access Level
              </span>
              <Eye className="w-3.5 h-3.5 text-surface-400 shrink-0" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-sm font-semibold text-surface-200 font-mono tracking-tight">
                Read-Only Observer
              </span>
            </div>
            <p className="mt-2 text-[10px] text-surface-500 truncate">
              Mutations require Author permissions
            </p>
          </div>
        </div>
      )}

      {/* Main 2-Column Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Cols: Recent Workflows Table */}
        <div className="lg:col-span-2 bg-surface-900 border border-surface-750 rounded-md overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-surface-750 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold text-surface-100 uppercase font-mono tracking-wider">
                Recent Workflows
              </h2>
            </div>
            <Link
              to="/workflows"
              className="text-[11px] text-brand-400 hover:text-brand-300 font-medium flex items-center gap-1"
            >
              View All →
            </Link>
          </div>

          <div className="overflow-x-auto flex-1">
            {workflowsLoading ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : workflowsData?.items && workflowsData.items.length > 0 ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-surface-750 bg-surface-950/40 text-[11px] font-medium text-surface-400">
                    <th className="py-2.5 px-3.5">Workflow Name</th>
                    <th className="py-2.5 px-3">Project</th>
                    <th className="py-2.5 px-3">Risk</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3.5 text-right">Author</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800">
                  {workflowsData.items.map((wf) => (
                    <tr
                      key={wf.id}
                      onClick={() => navigate(`/workflows/${wf.id}`)}
                      className="hover:bg-surface-850/70 transition-colors cursor-pointer group"
                    >
                      <td className="py-2.5 px-3.5 max-w-[220px]">
                        <p className="font-medium text-surface-200 group-hover:text-brand-400 transition-colors truncate">
                          {wf.name}
                        </p>
                        <p className="text-[10px] text-surface-500 font-mono mt-0.5">
                          {new Date(wf.created_at).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-surface-800 text-surface-300 border border-surface-700">
                          {wf.project?.key || 'PRJ'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">{getRiskBadge(wf.risk_level)}</td>
                      <td className="py-2.5 px-3">{getStatusBadge(wf.status)}</td>
                      <td className="py-2.5 px-3.5 text-right">
                        <span className="text-[11px] text-surface-300 truncate max-w-[90px] inline-block font-mono">
                          {wf.creator?.full_name?.split(' ')[0] || 'Dev'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6">
                <EmptyState
                  title="No workflows created"
                  description="Deployments, infrastructure changes, and database migrations will appear here."
                  actionLabel={hasPermission('workflow.create') ? 'Create Workflow' : undefined}
                  onAction={() => navigate('/workflows')}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Security Audit Log Stream (if permitted) OR Governance Scope Card (if Viewer) */}
        {canReadAudit ? (
          <div className="bg-surface-900 border border-surface-750 rounded-md overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-surface-750 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-brand-400" />
                <h2 className="text-xs font-semibold text-surface-100 uppercase font-mono tracking-wider">
                  Security Ledger
                </h2>
              </div>
              <Link
                to="/audit"
                className="text-[11px] text-brand-400 hover:text-brand-300 font-medium"
              >
                Explore →
              </Link>
            </div>

            <div className="p-3 flex-1 overflow-y-auto max-h-[380px] space-y-2.5 divide-y divide-surface-800">
              {auditLoading ? (
                <div className="space-y-2.5 pt-1">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : auditData?.items && auditData.items.length > 0 ? (
                auditData.items.map((log) => (
                  <div key={log.id} className="pt-2.5 first:pt-0 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-semibold text-brand-300 px-1 py-0.2 rounded bg-surface-950 border border-surface-750">
                        {log.action}
                      </span>
                      <span className="text-[10px] text-surface-500 font-mono">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-surface-300 mt-1 line-clamp-1 text-[11px]">
                      <span className="text-surface-500">by </span>
                      <span className="text-surface-200 font-mono">{log.actor_email}</span>
                    </p>
                    <p className="text-[10px] text-surface-500 font-mono mt-0.5 truncate">
                      {log.resource_type}: {log.resource_id}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center text-xs text-surface-400 py-6">
                  No audit events recorded
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Role Scope & Policy Information Card for Viewer */
          <div className="bg-surface-900 border border-surface-750 rounded-md p-4 flex flex-col justify-between space-y-3">
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 pb-2 border-b border-surface-750">
                <Lock className="w-3.5 h-3.5 text-brand-400" />
                <h2 className="text-xs font-semibold text-surface-100 uppercase font-mono tracking-wider">
                  Governance Policy Scope
                </h2>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded bg-surface-950 border border-surface-750 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-surface-500 block font-semibold">
                    Peer Verification
                  </span>
                  <p className="text-surface-300 text-[11px] leading-relaxed">
                    All change requests require 1+ peer sign-off before entering deployment queue.
                  </p>
                </div>

                <div className="p-2.5 rounded bg-surface-950 border border-surface-750 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-surface-500 block font-semibold">
                    Security Sign-off
                  </span>
                  <p className="text-surface-300 text-[11px] leading-relaxed">
                    High & Critical risk pipelines require Admin or Security Officer approval.
                  </p>
                </div>

                <div className="p-2.5 rounded bg-surface-950 border border-surface-750 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-surface-500 block font-semibold">
                    Organization Admin
                  </span>
                  <p className="text-surface-200 text-[11px] font-mono">
                    Sarah Chen (sarah.chen@acmecloud.io)
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-surface-750">
              <Link
                to="/roles"
                className="text-[11px] text-brand-400 hover:text-brand-300 flex items-center justify-between font-medium group"
              >
                <span>Inspect Workspace RBAC Matrix</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

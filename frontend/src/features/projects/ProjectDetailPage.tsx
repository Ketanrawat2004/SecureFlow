import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FolderGit2,
  GitPullRequest,
  Plus,
  Shield,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { Badge } from '@/components/ui/Badge';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { Can } from '@/features/auth/Can';
import { useAppStore } from '@/stores/useAppStore';
import { AuditLog, PaginatedResponse, Project, Workflow } from '@/types';

export const ProjectDetailPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { activeOrgId } = useAppStore();
  const [activeTab, setActiveTab] = useState('workflows');

  // Fetch Project
  const {
    data: project,
    isLoading: projectLoading,
    error: projectError,
  } = useQuery<Project>({
    queryKey: ['project', projectId, activeOrgId],
    queryFn: () => api.get<Project>(`/projects/${projectId}`),
    enabled: !!projectId,
  });

  // Fetch Project's Workflows
  const { data: workflowsData, isLoading: workflowsLoading } = useQuery<PaginatedResponse<Workflow>>({
    queryKey: ['workflows', 'project', projectId, activeOrgId],
    queryFn: () => api.get<PaginatedResponse<Workflow>>(`/workflows?project_id=${projectId}&page=1&page_size=20`),
    enabled: !!projectId,
  });

  // Fetch Project's Audit logs
  const { data: auditData, isLoading: auditLoading } = useQuery<PaginatedResponse<AuditLog>>({
    queryKey: ['audit', 'project', projectId, activeOrgId],
    queryFn: () => api.get<PaginatedResponse<AuditLog>>(`/audit-logs?search=${project?.key || ''}&page=1&page_size=15`),
    enabled: !!project?.key,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
      case 'executed':
        return <Badge variant="success" size="xs" dot>Approved</Badge>;
      case 'pending_approval':
        return <Badge variant="warning" size="xs" dot>Pending Approval</Badge>;
      case 'rejected':
        return <Badge variant="danger" size="xs" dot>Rejected</Badge>;
      case 'changes_requested':
        return <Badge variant="purple" size="xs" dot>Changes Requested</Badge>;
      default:
        return <Badge variant="neutral" size="xs">{status}</Badge>;
    }
  };

  if (projectError) {
    return <ErrorState message={(projectError as Error).message} onRetry={() => navigate('/projects')} />;
  }

  if (projectLoading || !project) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const tabs = [
    { id: 'workflows', label: 'Workflows', count: workflowsData?.total || 0, icon: <GitPullRequest className="w-3.5 h-3.5" /> },
    { id: 'overview', label: 'Overview', icon: <FolderGit2 className="w-3.5 h-3.5" /> },
    { id: 'activity', label: 'Audit Activity', count: auditData?.total || 0, icon: <Shield className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Breadcrumb Navigation */}
      <Breadcrumb
        items={[
          { label: 'Projects', href: '/projects' },
          { label: `${project.name} (${project.key})` },
        ]}
      />

      {/* Project Header Banner */}
      <div className="bg-surface-900 border border-surface-750 rounded-md p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded bg-surface-950 border border-surface-750 flex items-center justify-center text-brand-400 font-mono font-bold text-xs shrink-0">
              {project.key}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-surface-100">{project.name}</h1>
                <Badge variant={project.status === 'active' ? 'success' : 'neutral'} size="xs" dot>
                  {project.status.toUpperCase()}
                </Badge>
              </div>
              <p className="text-xs text-surface-400 mt-0.5 max-w-2xl leading-relaxed">
                {project.description || 'No project description provided.'}
              </p>
            </div>
          </div>

          <Can permission="workflow.create">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => navigate(`/workflows?new=true&projectId=${project.id}`)}
            >
              New Workflow
            </Button>
          </Can>
        </div>

        {/* Project Metadata Stats Strip */}
        <div className="pt-3 border-t border-surface-750 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-[10px] text-surface-500 uppercase font-mono tracking-wider">Total Workflows</span>
            <span className="text-surface-200 font-mono font-semibold text-xs mt-0.5 block">
              {project.workflow_count || 0}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-surface-500 uppercase font-mono tracking-wider">Active Pipelines</span>
            <span className="text-amber-400 font-mono font-semibold text-xs mt-0.5 block">
              {project.active_workflow_count || 0}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-surface-500 uppercase font-mono tracking-wider">Project Lead</span>
            <span className="text-surface-200 font-medium truncate text-xs mt-0.5 block">
              {project.lead?.full_name || 'Unassigned'}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-surface-500 uppercase font-mono tracking-wider">Created Date</span>
            <span className="text-surface-300 font-mono text-xs mt-0.5 block">
              {new Date(project.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab 1: Workflows */}
      {activeTab === 'workflows' && (
        <div className="bg-surface-900 border border-surface-750 rounded-md overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-surface-750 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-surface-100 uppercase font-mono tracking-wider">
              Project Pipelines
            </h3>
            <Can permission="workflow.create">
              <Button
                variant="secondary"
                size="xs"
                leftIcon={<Plus className="w-3 h-3" />}
                onClick={() => navigate(`/workflows?new=true&projectId=${project.id}`)}
              >
                Create Workflow
              </Button>
            </Can>
          </div>

          <div className="overflow-x-auto">
            {workflowsLoading ? (
              <div className="p-4 space-y-2.5">
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-7 w-full" />
              </div>
            ) : workflowsData?.items && workflowsData.items.length > 0 ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-surface-750 bg-surface-950/40 text-[11px] font-medium text-surface-400">
                    <th className="py-2.5 px-3.5">Workflow Name</th>
                    <th className="py-2.5 px-3">Risk Level</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Created</th>
                    <th className="py-2.5 px-3.5 text-right">Author</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800">
                  {workflowsData.items.map((wf) => (
                    <tr
                      key={wf.id}
                      onClick={() => navigate(`/workflows/${wf.id}`)}
                      className="hover:bg-surface-850/50 transition-colors cursor-pointer group"
                    >
                      <td className="py-2.5 px-3.5 font-medium text-surface-200 group-hover:text-brand-400">
                        {wf.name}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={wf.risk_level === 'critical' ? 'danger' : wf.risk_level === 'high' ? 'warning' : 'neutral'}
                          size="xs"
                        >
                          {wf.risk_level.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3">{getStatusBadge(wf.status)}</td>
                      <td className="py-2.5 px-3 font-mono text-surface-400 text-[11px]">
                        {new Date(wf.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3.5 text-right text-[11px] text-surface-300 font-mono">
                        {wf.creator?.full_name?.split(' ')[0] || 'Dev'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6">
                <EmptyState
                  title="No workflows in this project"
                  description="Deployments and change requests created for this project will appear here."
                  actionLabel="Create First Workflow"
                  onAction={() => navigate(`/workflows?new=true&projectId=${project.id}`)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Overview */}
      {activeTab === 'overview' && (
        <div className="bg-surface-900 border border-surface-750 rounded-md p-4 space-y-3">
          <div>
            <h3 className="text-xs font-semibold text-surface-100 uppercase font-mono tracking-wider">
              Project Governance & Scope
            </h3>
            <p className="text-[11px] text-surface-400 mt-0.5">
              Configuration and compliance scope for repository identifier{' '}
              <span className="font-mono text-brand-400 font-bold">{project.key}</span>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded bg-surface-950 border border-surface-750 space-y-1">
              <span className="text-surface-500 font-mono uppercase tracking-wider block text-[10px]">
                Engineering Domain Scope
              </span>
              <p className="text-surface-200 text-xs leading-relaxed">
                {project.description || 'No detailed scope description provided.'}
              </p>
            </div>

            <div className="p-3 rounded bg-surface-950 border border-surface-750 space-y-1">
              <span className="text-surface-500 font-mono uppercase tracking-wider block text-[10px]">
                Security Baseline
              </span>
              <p className="text-surface-200 text-xs leading-relaxed">
                Requires minimum 1 peer review sign-off and Admin / Security Officer approval on high and critical changes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Activity */}
      {activeTab === 'activity' && (
        <div className="bg-surface-900 border border-surface-750 rounded-md p-4 space-y-3">
          <h3 className="text-xs font-semibold text-surface-100 uppercase font-mono tracking-wider">
            Project Audit Activity
          </h3>
          {auditLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : auditData?.items && auditData.items.length > 0 ? (
            <div className="divide-y divide-surface-800">
              {auditData.items.map((log) => (
                <div key={log.id} className="py-2.5 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-mono text-brand-400 font-medium text-[11px]">{log.action}</span>
                    <span className="text-surface-400 ml-2 text-[11px]">by {log.actor_email}</span>
                  </div>
                  <span className="text-surface-500 font-mono text-[10px]">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-surface-400">
              No recent audit activity for this project.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  GitPullRequest,
  Lock,
  Shield,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/features/auth/AuthContext';
import { useAppStore } from '@/stores/useAppStore';
import { OperationalAnalytics } from '@/types';

export const AnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeOrgId } = useAppStore();
  const { hasPermission, activeRole } = useAuth();
  const canReadAnalytics = hasPermission('analytics.read');

  const {
    data: analytics,
    isLoading,
    error,
    refetch,
  } = useQuery<OperationalAnalytics>({
    queryKey: ['analytics', 'operational', activeOrgId],
    queryFn: () => api.get<OperationalAnalytics>('/analytics/operational'),
    enabled: canReadAnalytics && !!activeOrgId,
  });

  // If role does not have analytics.read permission (Viewer)
  if (!canReadAnalytics) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <div className="w-10 h-10 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
          <Lock className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-surface-100 uppercase font-mono tracking-wider">
            Operational Analytics Restricted
          </h2>
          <p className="text-xs text-surface-400 max-w-md mx-auto leading-relaxed">
            Operational pipeline analytics and SLA telemetry require the <span className="text-brand-400 font-mono">analytics.read</span> permission. Your role (<span className="text-surface-200 font-mono font-medium">{activeRole || 'Viewer'}</span>) has read-only access to projects and workflows.
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

  if (error) {
    return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />;
  }

  if (isLoading || !analytics) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  // Calculate max volume for chart scaling
  const maxDayCount = Math.max(
    ...analytics.volume_timeline.map((d) => Math.max(d.created_count, d.approved_count, 1)),
    5
  );

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="pb-3 border-b border-surface-750">
        <div className="flex items-center gap-2">
          <h1 className="text-base sm:text-lg font-semibold tracking-tight text-surface-100">
            Operational Telemetry & Insights
          </h1>
        </div>
        <p className="text-xs text-surface-400 mt-0.5">
          Aggregated SLA turnaround, workflow throughput, and compliance velocity metrics
        </p>
      </div>

      {/* Top 4 Stat Widgets */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-surface-900 border border-surface-750 rounded-md p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-surface-400">Total Pipelines</span>
            <GitPullRequest className="w-3.5 h-3.5 text-brand-400" />
          </div>
          <p className="text-xl font-bold font-mono text-surface-100 mt-2">
            {analytics.total_workflows}
          </p>
          <p className="text-[10px] text-surface-500 mt-0.5">Total pipelines executed</p>
        </div>

        <div className="bg-surface-900 border border-surface-750 rounded-md p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-surface-400">Pass Rate</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-xl font-bold font-mono text-emerald-400 mt-2">
            {analytics.approval_rate_percent}%
          </p>
          <p className="text-[10px] text-surface-500 mt-0.5">Passed review gates</p>
        </div>

        <div className="bg-surface-900 border border-surface-750 rounded-md p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-surface-400">Average Turnaround</span>
            <Clock className="w-3.5 h-3.5 text-surface-400" />
          </div>
          <p className="text-xl font-bold font-mono text-surface-100 mt-2">
            {analytics.avg_turnaround_hours}h
          </p>
          <p className="text-[10px] text-surface-500 mt-0.5">Creation to sign-off</p>
        </div>

        <div className="bg-surface-900 border border-surface-750 rounded-md p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-surface-400">Security Events</span>
            <Shield className="w-3.5 h-3.5 text-brand-400" />
          </div>
          <p className="text-xl font-bold font-mono text-surface-100 mt-2">
            {analytics.recent_security_events_count}
          </p>
          <p className="text-[10px] text-surface-500 mt-0.5">Last 7 days audited</p>
        </div>
      </div>

      {/* 7-Day Change Volume Timeline */}
      <div className="bg-surface-900 border border-surface-750 rounded-md p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-surface-750">
          <div>
            <h2 className="text-xs font-semibold text-surface-100 uppercase font-mono tracking-wider">
              7-Day Execution Volume
            </h2>
            <p className="text-[11px] text-surface-400 mt-0.5">
              Daily workflow creation versus approval throughput
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-brand-500" />
              <span className="text-surface-400 text-[11px]">Created</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
              <span className="text-surface-400 text-[11px]">Approved</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
              <span className="text-surface-400 text-[11px]">Rejected</span>
            </div>
          </div>
        </div>

        {/* Bar Chart Container */}
        <div className="pt-4 pb-2">
          <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-44">
            {analytics.volume_timeline.map((day) => {
              const createdHeight = Math.max((day.created_count / maxDayCount) * 100, 4);
              const approvedHeight = Math.max((day.approved_count / maxDayCount) * 100, 4);
              const rejectedHeight = Math.max((day.rejected_count / maxDayCount) * 100, 4);

              return (
                <div key={day.date} className="flex flex-col items-center gap-2 group">
                  <div className="w-full flex items-end justify-center gap-1 h-32">
                    {/* Created Bar */}
                    <div
                      style={{ height: `${createdHeight}%` }}
                      className="w-2 sm:w-3 bg-brand-500/80 rounded-t-sm group-hover:bg-brand-400 transition-all relative group/bar"
                    >
                      <div className="hidden group-hover/bar:block absolute -top-6 left-1/2 -translate-x-1/2 bg-surface-950 text-surface-100 text-[9px] font-mono px-1 py-0.2 rounded border border-surface-700 whitespace-nowrap z-10">
                        {day.created_count}
                      </div>
                    </div>

                    {/* Approved Bar */}
                    <div
                      style={{ height: `${approvedHeight}%` }}
                      className="w-2 sm:w-3 bg-emerald-500/80 rounded-t-sm group-hover:bg-emerald-400 transition-all relative group/bar"
                    >
                      <div className="hidden group-hover/bar:block absolute -top-6 left-1/2 -translate-x-1/2 bg-surface-950 text-surface-100 text-[9px] font-mono px-1 py-0.2 rounded border border-surface-700 whitespace-nowrap z-10">
                        {day.approved_count}
                      </div>
                    </div>

                    {/* Rejected Bar */}
                    <div
                      style={{ height: `${rejectedHeight}%` }}
                      className="w-2 sm:w-3 bg-rose-500/80 rounded-t-sm group-hover:bg-rose-400 transition-all relative group/bar"
                    >
                      <div className="hidden group-hover/bar:block absolute -top-6 left-1/2 -translate-x-1/2 bg-surface-950 text-surface-100 text-[9px] font-mono px-1 py-0.2 rounded border border-surface-700 whitespace-nowrap z-10">
                        {day.rejected_count}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono text-surface-500 group-hover:text-surface-300">
                    {new Date(day.date).toLocaleDateString([], { weekday: 'short' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3-Column Breakdown Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Status Distribution */}
        <div className="bg-surface-900 border border-surface-750 rounded-md p-3.5 space-y-2.5">
          <h3 className="text-xs font-semibold uppercase font-mono tracking-wider text-surface-300">
            Pipeline Status Distribution
          </h3>
          <div className="space-y-2 text-xs">
            {analytics.workflows_by_status?.map((item) => {
              const percent = analytics.total_workflows > 0 ? (item.count / analytics.total_workflows) * 100 : 0;
              return (
                <div key={item.status} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-surface-300 capitalize">{item.status.replace('_', ' ')}</span>
                    <span className="font-mono text-surface-400">
                      {item.count} ({Math.round(percent)}%)
                    </span>
                  </div>
                  <div className="w-full bg-surface-950 rounded-full h-1 overflow-hidden">
                    <div style={{ width: `${percent}%` }} className="bg-brand-500 h-full rounded-full" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Risk Level Distribution */}
        <div className="bg-surface-900 border border-surface-750 rounded-md p-3.5 space-y-2.5">
          <h3 className="text-xs font-semibold uppercase font-mono tracking-wider text-surface-300">
            Risk Tier Distribution
          </h3>
          <div className="space-y-2 text-xs">
            {analytics.workflows_by_risk?.map((item) => {
              const percent = analytics.total_workflows > 0 ? (item.count / analytics.total_workflows) * 100 : 0;
              const colorClass =
                item.status === 'critical'
                  ? 'bg-rose-500'
                  : item.status === 'high'
                  ? 'bg-amber-500'
                  : item.status === 'medium'
                  ? 'bg-brand-500'
                  : 'bg-emerald-500';

              return (
                <div key={item.status} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-surface-300 capitalize">{item.status} Risk</span>
                    <span className="font-mono text-surface-400">
                      {item.count} ({Math.round(percent)}%)
                    </span>
                  </div>
                  <div className="w-full bg-surface-950 rounded-full h-1 overflow-hidden">
                    <div style={{ width: `${percent}%` }} className={`${colorClass} h-full rounded-full`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Active Repositories */}
        <div className="bg-surface-900 border border-surface-750 rounded-md p-3.5 space-y-2.5">
          <h3 className="text-xs font-semibold uppercase font-mono tracking-wider text-surface-300">
            Top Active Repositories
          </h3>
          <div className="space-y-2 text-xs divide-y divide-surface-800">
            {analytics.workflows_by_project?.map((proj) => (
              <div key={proj.project_id} className="pt-2 first:pt-0 flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-mono text-[9px] bg-surface-950 px-1 py-0.2 rounded border border-surface-750 font-bold text-brand-400">
                    {proj.project_key}
                  </span>
                  <span className="text-surface-200 truncate">{proj.project_name}</span>
                </div>
                <span className="font-mono text-surface-400 ml-2">
                  {proj.workflow_count} wfs
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

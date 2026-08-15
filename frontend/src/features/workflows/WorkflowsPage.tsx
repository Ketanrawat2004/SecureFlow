import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  GitPullRequest,
  Plus,
  Search,
  Shield,
  Trash2,
} from 'lucide-react';
import { z } from 'zod';
import { api, normalizeApiError } from '@/lib/api/client';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { Input } from '@/components/forms/Input';
import { Select } from '@/components/forms/Select';
import { Textarea } from '@/components/forms/Textarea';
import { Can } from '@/features/auth/Can';
import { useAppStore } from '@/stores/useAppStore';
import { PaginatedResponse, Project, Workflow } from '@/types';

const stepSchema = z.object({
  name: z.string().min(2, 'Step name required'),
  description: z.string().optional(),
  required_role: z.string().default('Admin'),
  step_order: z.number().default(0),
});

const workflowCreateSchema = z.object({
  project_id: z.string().min(1, 'Please select a project'),
  name: z.string().min(3, 'Workflow name must be at least 3 characters'),
  description: z.string().optional(),
  risk_level: z.enum(['low', 'medium', 'high', 'critical']),
  steps: z.array(stepSchema).min(1, 'At least 1 pipeline step is required'),
});

type WorkflowCreateFormValues = z.infer<typeof workflowCreateSchema>;

export const WorkflowsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { activeOrgId } = useAppStore();

  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Auto-open create modal if query parameter specifies ?new=true
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setIsCreateModalOpen(true);
    }
  }, [searchParams]);

  // Fetch Projects for dropdown
  const { data: projectsData } = useQuery<PaginatedResponse<Project>>({
    queryKey: ['projects', activeOrgId],
    queryFn: () => api.get<PaginatedResponse<Project>>('/projects?page_size=100'),
  });

  // Fetch Workflows
  const {
    data: workflowsData,
    isLoading,
    error,
    refetch,
  } = useQuery<PaginatedResponse<Workflow>>({
    queryKey: ['workflows', activeOrgId, projectFilter, statusFilter, riskFilter, search, page],
    queryFn: () => {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: '15',
      });
      if (projectFilter !== 'all') params.append('project_id', projectFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (riskFilter !== 'all') params.append('risk', riskFilter);
      if (search) params.append('search', search);
      return api.get<PaginatedResponse<Workflow>>(`/workflows?${params.toString()}`);
    },
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WorkflowCreateFormValues>({
    resolver: zodResolver(workflowCreateSchema),
    defaultValues: {
      project_id: searchParams.get('projectId') || '',
      name: '',
      description: '',
      risk_level: 'medium',
      steps: [
        {
          name: 'Security Architecture & Risk Gate',
          description: 'Validate compliance, secrets isolation, and rollback plan',
          required_role: 'Admin',
          step_order: 0,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'steps',
  });

  const createMutation = useMutation({
    mutationFn: (values: WorkflowCreateFormValues) => {
      const payload = {
        ...values,
        steps: values.steps.map((s, idx) => ({
          ...s,
          step_order: idx,
        })),
      };
      return api.post<Workflow>('/workflows', payload);
    },
    onSuccess: (newWf) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      setIsCreateModalOpen(false);
      reset();
      navigate(`/workflows/${newWf.id}`);
    },
    onError: (err: any) => {
      setServerError(normalizeApiError(err, 'Failed to submit workflow. Please verify all stages.'));
    },
  });

  const onSubmit = (values: WorkflowCreateFormValues) => {
    setServerError(null);
    createMutation.mutate(values);
  };

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

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-750">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-surface-100">
              Workflows
            </h1>
            <span className="text-xs text-surface-400 font-mono">
              ({workflowsData?.total ?? 0})
            </span>
          </div>
          <p className="text-xs text-surface-400 mt-0.5">
            Sequential approval pipelines, infrastructure changes, and compliance gates
          </p>
        </div>

        <Can permission="workflow.create">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            Create Workflow
          </Button>
        </Can>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 bg-surface-900 p-2.5 rounded-md border border-surface-750">
        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-surface-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search workflows..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-surface-950 border border-surface-750 rounded pl-8 pr-3 py-1 text-xs text-surface-200 placeholder-surface-500 focus:border-brand-500 h-8"
          />
        </div>

        {/* Project Filter */}
        <select
          value={projectFilter}
          onChange={(e) => {
            setProjectFilter(e.target.value);
            setPage(1);
          }}
          className="bg-surface-950 border border-surface-750 rounded px-2.5 h-8 text-xs text-surface-200 focus:border-brand-500"
        >
          <option value="all">All Projects</option>
          {projectsData?.items.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.key})
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="bg-surface-950 border border-surface-750 rounded px-2.5 h-8 text-xs text-surface-200 focus:border-brand-500"
        >
          <option value="all">All Statuses</option>
          <option value="pending_approval">Pending Approval</option>
          <option value="approved">Approved</option>
          <option value="changes_requested">Changes Requested</option>
          <option value="rejected">Rejected</option>
          <option value="executed">Executed</option>
        </select>

        {/* Risk Filter */}
        <select
          value={riskFilter}
          onChange={(e) => {
            setRiskFilter(e.target.value);
            setPage(1);
          }}
          className="bg-surface-950 border border-surface-750 rounded px-2.5 h-8 text-xs text-surface-200 focus:border-brand-500"
        >
          <option value="all">All Risk Levels</option>
          <option value="low">Low Risk</option>
          <option value="medium">Medium Risk</option>
          <option value="high">High Risk</option>
          <option value="critical">Critical Risk</option>
        </select>
      </div>

      {/* Table Area */}
      {error ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="bg-surface-900 border border-surface-750 rounded-md p-4 space-y-2.5">
          <div className="h-7 w-full bg-surface-800 rounded animate-pulse" />
          <div className="h-7 w-full bg-surface-800 rounded animate-pulse" />
          <div className="h-7 w-full bg-surface-800 rounded animate-pulse" />
        </div>
      ) : workflowsData?.items && workflowsData.items.length > 0 ? (
        <div className="space-y-3">
          <div className="bg-surface-900 border border-surface-750 rounded-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-surface-750 bg-surface-950/40 text-[11px] font-medium text-surface-400">
                    <th className="py-2.5 px-3.5">Workflow Name</th>
                    <th className="py-2.5 px-3">Project</th>
                    <th className="py-2.5 px-3">Pipeline Stage</th>
                    <th className="py-2.5 px-3">Risk</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3.5 text-right">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800">
                  {workflowsData.items.map((wf) => {
                    const completedSteps = wf.steps.filter((s) => s.status === 'approved').length;
                    const totalSteps = wf.steps.length;

                    return (
                      <tr
                        key={wf.id}
                        onClick={() => navigate(`/workflows/${wf.id}`)}
                        className="hover:bg-surface-850/70 transition-colors cursor-pointer group"
                      >
                        <td className="py-2.5 px-3.5 max-w-sm">
                          <p className="font-semibold text-surface-200 group-hover:text-brand-400 transition-colors truncate">
                            {wf.name}
                          </p>
                          <p className="text-[10px] text-surface-500 font-mono mt-0.5">
                            by {wf.creator?.full_name || 'Author'}
                          </p>
                        </td>

                        <td className="py-2.5 px-3">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-surface-950 text-surface-300 border border-surface-750">
                            {wf.project?.key || 'PRJ'}
                          </span>
                        </td>

                        <td className="py-2.5 px-3">
                          <span className="font-mono text-[11px] text-surface-300">
                            {completedSteps}/{totalSteps} signed off
                          </span>
                        </td>

                        <td className="py-2.5 px-3">{getRiskBadge(wf.risk_level)}</td>
                        <td className="py-2.5 px-3">{getStatusBadge(wf.status)}</td>
                        <td className="py-2.5 px-3.5 text-right font-mono text-[11px] text-surface-400">
                          {new Date(wf.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination
            page={workflowsData.page}
            totalPages={workflowsData.total_pages}
            totalItems={workflowsData.total}
            pageSize={workflowsData.page_size}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      ) : (
        <EmptyState
          icon={<GitPullRequest className="w-6 h-6" />}
          title="No workflows found"
          description={search ? `No workflows match "${search}". Try adjusting your filters.` : 'Submit an engineering change workflow to begin approval review.'}
          actionLabel="Create Workflow"
          onAction={() => setIsCreateModalOpen(true)}
        />
      )}

      {/* Create Workflow Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          reset();
          setServerError(null);
        }}
        title="Create Engineering Workflow"
        description="Define pipeline verification gates, target domain, and risk classification."
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit(onSubmit)}
              isLoading={isSubmitting}
            >
              Submit for Approval
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
          {serverError && (
            <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Target Project"
              required
              options={[
                { value: '', label: 'Select a project' },
                ...(projectsData?.items.map((p) => ({
                  value: p.id,
                  label: `${p.name} (${p.key})`,
                })) || []),
              ]}
              error={errors.project_id?.message}
              {...register('project_id')}
            />

            <Select
              label="Risk Classification"
              options={[
                { value: 'low', label: 'Low (Minor configuration)' },
                { value: 'medium', label: 'Medium (Standard feature rollout)' },
                { value: 'high', label: 'High (Infrastructure / core service)' },
                { value: 'critical', label: 'Critical (Database DDL / perimeter rule)' },
              ]}
              error={errors.risk_level?.message}
              {...register('risk_level')}
            />
          </div>

          <Input
            label="Workflow Title"
            placeholder="Production Canary Deployment - Payments Engine v2.15"
            required
            error={errors.name?.message}
            {...register('name')}
          />

          <Textarea
            label="Description & Scope"
            placeholder="Overview of changes, test coverage, and rollback plan..."
            error={errors.description?.message}
            {...register('description')}
          />

          {/* Dynamic Pipeline Steps */}
          <div className="pt-2 border-t border-surface-750 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-surface-200">Pipeline Approval Gates</h4>
                <p className="text-[10px] text-surface-400">
                  Sequential authorization stages required before execution.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                leftIcon={<Plus className="w-3 h-3" />}
                onClick={() =>
                  append({
                    name: 'Principal Engineer Security & Review Gate',
                    description: 'Verify security best practices and test coverage',
                    required_role: 'Admin',
                    step_order: fields.length,
                  })
                }
              >
                Add Gate
              </Button>
            </div>

            <div className="space-y-2">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="p-2.5 rounded bg-surface-950 border border-surface-750 space-y-2 relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-brand-400">
                      STAGE #{index + 1}
                    </span>
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="text-surface-500 hover:text-rose-400 p-0.5"
                        aria-label="Remove step"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      label="Stage Name"
                      placeholder="Security Officer Review"
                      required
                      error={errors.steps?.[index]?.name?.message}
                      {...register(`steps.${index}.name`)}
                    />

                    <Select
                      label="Required Sign-off Role"
                      options={[
                        { value: 'Admin', label: 'Admin' },
                        { value: 'Owner', label: 'Owner' },
                        { value: 'Auditor', label: 'Auditor' },
                        { value: 'Developer', label: 'Developer (Peer Review)' },
                      ]}
                      error={errors.steps?.[index]?.required_role?.message}
                      {...register(`steps.${index}.required_role`)}
                    />
                  </div>

                  <Input
                    label="Gate Instructions"
                    placeholder="Specific criteria required for sign-off..."
                    error={errors.steps?.[index]?.description?.message}
                    {...register(`steps.${index}.description`)}
                  />
                </div>
              ))}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

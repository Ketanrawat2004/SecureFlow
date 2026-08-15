import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  FolderGit2,
  Grid,
  List,
  Plus,
  Search,
  Shield,
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
import { Membership, PaginatedResponse, Project } from '@/types';

const projectFormSchema = z.object({
  name: z.string().min(2, 'Project name must be at least 2 characters'),
  key: z
    .string()
    .min(2, 'Key must be at least 2 characters')
    .max(10, 'Key must be at most 10 characters')
    .regex(/^[A-Z0-9_-]+$/, 'Key must consist of uppercase letters, digits, underscores, or dashes'),
  description: z.string().optional(),
  lead_id: z.string().optional(),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeOrgId } = useAppStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [page, setPage] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Fetch Projects
  const {
    data: projectsData,
    isLoading,
    error,
    refetch,
  } = useQuery<PaginatedResponse<Project>>({
    queryKey: ['projects', activeOrgId, search, statusFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: '12',
      });
      if (search) params.append('search', search);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      return api.get<PaginatedResponse<Project>>(`/projects?${params.toString()}`);
    },
  });

  // Fetch Members for Project Lead selection
  const { data: members } = useQuery<Membership[]>({
    queryKey: ['members', activeOrgId],
    queryFn: () => api.get<Membership[]>('/members'),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: '',
      key: '',
      description: '',
      lead_id: '',
    },
  });

  // Create Project Mutation
  const createMutation = useMutation({
    mutationFn: (values: ProjectFormValues) => api.post<Project>('/projects', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      setIsCreateModalOpen(false);
      reset();
      setServerError(null);
    },
    onError: (err: any) => {
      setServerError(normalizeApiError(err, 'Failed to create project. Please verify project key.'));
    },
  });

  const onSubmit = (values: ProjectFormValues) => {
    setServerError(null);
    createMutation.mutate(values);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success" size="xs" dot>Active</Badge>;
      case 'planning':
        return <Badge variant="info" size="xs" dot>Planning</Badge>;
      case 'archived':
        return <Badge variant="neutral" size="xs">Archived</Badge>;
      default:
        return <Badge variant="neutral" size="xs">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-750">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-surface-100">
              Projects
            </h1>
            <span className="text-xs text-surface-400 font-mono">
              ({projectsData?.total ?? 0})
            </span>
          </div>
          <p className="text-xs text-surface-400 mt-0.5">
            Engineering services, architecture domains, and access scopes
          </p>
        </div>

        <Can permission="project.create">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            Create Project
          </Button>
        </Can>
      </div>

      {/* Filter and View Mode Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-surface-900 p-2.5 rounded-md border border-surface-750">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-surface-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-surface-950 border border-surface-750 rounded pl-8 pr-3 py-1 text-xs text-surface-200 placeholder-surface-500 focus:border-brand-500 h-8"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-surface-950 border border-surface-750 rounded px-2.5 h-8 text-xs text-surface-200 focus:border-brand-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="planning">Planning</option>
            <option value="archived">Archived</option>
          </select>

          <div className="flex items-center border border-surface-750 rounded bg-surface-950 p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1 rounded text-xs ${
                viewMode === 'table' ? 'bg-surface-800 text-surface-100' : 'text-surface-400 hover:text-surface-200'
              }`}
              title="Table view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded text-xs ${
                viewMode === 'grid' ? 'bg-surface-800 text-surface-100' : 'text-surface-400 hover:text-surface-200'
              }`}
              title="Grid view"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content View */}
      {error ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="bg-surface-900 border border-surface-750 rounded-md p-4 space-y-3">
          <div className="h-7 w-full bg-surface-800 rounded animate-pulse" />
          <div className="h-7 w-full bg-surface-800 rounded animate-pulse" />
          <div className="h-7 w-full bg-surface-800 rounded animate-pulse" />
        </div>
      ) : projectsData?.items && projectsData.items.length > 0 ? (
        <div className="space-y-3">
          {viewMode === 'table' ? (
            <div className="bg-surface-900 border border-surface-750 rounded-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-surface-750 bg-surface-950/40 text-[11px] font-medium text-surface-400">
                      <th className="py-2.5 px-3.5 w-20">Key</th>
                      <th className="py-2.5 px-3">Project Name</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Lead</th>
                      <th className="py-2.5 px-3 text-center">Workflows</th>
                      <th className="py-2.5 px-3.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-800">
                    {projectsData.items.map((project) => (
                      <tr
                        key={project.id}
                        onClick={() => navigate(`/projects/${project.id}`)}
                        className="hover:bg-surface-850/70 transition-colors cursor-pointer group"
                      >
                        <td className="py-2.5 px-3.5">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-surface-950 text-brand-400 border border-surface-750">
                            {project.key}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-surface-200 group-hover:text-brand-400 transition-colors">
                          {project.name}
                        </td>
                        <td className="py-2.5 px-3 text-surface-400 max-w-xs truncate text-[11px]">
                          {project.description || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-surface-300 font-mono text-[11px]">
                          {project.lead?.full_name || 'Unassigned'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-surface-300 text-[11px]">
                          {project.workflow_count || 0}
                        </td>
                        <td className="py-2.5 px-3.5 text-right">
                          {getStatusBadge(project.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {projectsData.items.map((project) => (
                <div
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="bg-surface-900 border border-surface-750 hover:border-surface-600 rounded-md p-3.5 shadow-subtle transition-colors cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-surface-950 text-brand-400 border border-surface-750">
                        {project.key}
                      </span>
                      {getStatusBadge(project.status)}
                    </div>
                    <h3 className="text-xs font-semibold text-surface-100 group-hover:text-brand-400 transition-colors mt-2">
                      {project.name}
                    </h3>
                    <p className="text-[11px] text-surface-400 mt-1 line-clamp-2">
                      {project.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-surface-750 flex items-center justify-between text-[11px] text-surface-400">
                    <span className="font-mono text-surface-300">
                      {project.workflow_count || 0} workflows
                    </span>
                    <span className="truncate max-w-[100px] text-surface-400">
                      {project.lead?.full_name?.split(' ')[0] || 'Unassigned'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Pagination
            page={projectsData.page}
            totalPages={projectsData.total_pages}
            totalItems={projectsData.total}
            pageSize={projectsData.page_size}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      ) : (
        <EmptyState
          icon={<FolderGit2 className="w-6 h-6" />}
          title="No projects found"
          description={search ? `No projects match "${search}". Try adjusting your filters.` : 'Create an engineering project to start orchestrating workflows.'}
          actionLabel="Create Project"
          onAction={() => setIsCreateModalOpen(true)}
        />
      )}

      {/* Create Project Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          reset();
          setServerError(null);
        }}
        title="Create New Project"
        description="Define an engineering domain, service cluster, or repository."
        size="md"
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
              Create Project
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {serverError && (
            <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <Input
            label="Project Name"
            placeholder="Payments Platform"
            required
            error={errors.name?.message}
            {...register('name')}
          />

          <Input
            label="Key Identifier"
            placeholder="PAY"
            required
            helperText="Uppercase prefix for workflows (e.g., PAY, DEV, INFRA)"
            error={errors.key?.message}
            {...register('key', {
              onChange: (e) => {
                e.target.value = e.target.value.toUpperCase();
              },
            })}
          />

          <Textarea
            label="Description"
            placeholder="Overview of the service and governance scope..."
            error={errors.description?.message}
            {...register('description')}
          />

          <Select
            label="Lead Assignee"
            options={[
              { value: '', label: 'Select team lead (optional)' },
              ...(members?.map((m) => ({
                value: m.user_id,
                label: `${m.user.full_name} (${m.role.name})`,
              })) || []),
            ]}
            error={errors.lead_id?.message}
            {...register('lead_id')}
          />
        </form>
      </Modal>
    </div>
  );
};

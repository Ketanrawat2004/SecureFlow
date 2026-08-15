import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, AuthContextValue } from '@/features/auth/AuthContext';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { AuditLogsPage } from '@/features/audit/AuditLogsPage';
import { AnalyticsPage } from '@/features/analytics/AnalyticsPage';
import { api } from '@/lib/api/client';

vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Role-Aware Dashboard & Permission-Aware Pages', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it('Viewer receives intentional read-only dashboard and never requests analytics endpoint', async () => {
    const mockViewerAuth: AuthContextValue = {
      user: {
        id: 'u-viewer',
        email: 'maya.patel@acmecloud.io',
        full_name: 'Maya Patel',
        is_active: true,
        is_verified: true,
        is_sso: false,
        created_at: '',
        updated_at: '',
      },
      authContext: null,
      activeRole: 'Viewer',
      hasPermission: (perm: string) => ['workspace.read', 'member.read', 'project.read', 'workflow.read'].includes(perm),
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      devLogin: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    };

    (api.get as any).mockImplementation((url: string) => {
      if (url.includes('/workflows')) {
        return Promise.resolve({ items: [], total: 3, total_pages: 1 });
      }
      if (url.includes('/projects')) {
        return Promise.resolve({ items: [], total: 2, total_pages: 1 });
      }
      return Promise.reject(new Error(`Unexpected call to ${url}`));
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={mockViewerAuth}>
          <MemoryRouter>
            <DashboardPage />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );

    // Header & Greeting
    expect(screen.getByText(/Good morning, Maya/i)).toBeInTheDocument();
    expect(screen.getByText(/Viewer/i)).toBeInTheDocument();

    // Intentional Viewer Read-Only Cards
    expect(screen.getByText(/Accessible Pipelines/i)).toBeInTheDocument();
    expect(screen.getByText(/Permitted Repositories/i)).toBeInTheDocument();
    expect(screen.getByText(/Governance Status/i)).toBeInTheDocument();
    expect(screen.getByText(/Read-Only Observer/i)).toBeInTheDocument();

    // Viewer Governance Policy Card (instead of forbidden audit ledger)
    expect(screen.getByText(/Governance Policy Scope/i)).toBeInTheDocument();
    expect(screen.getByText(/Peer Verification/i)).toBeInTheDocument();

    // Verify analytics was NEVER called
    const apiGetCalls = (api.get as any).mock.calls.map((c: any) => c[0]);
    expect(apiGetCalls).not.toContain('/analytics/operational');
    expect(apiGetCalls).not.toContain('/audit-logs?page=1&page_size=5');
  });

  it('Owner dashboard queries operational analytics and renders operational metric widgets', async () => {
    const mockOwnerAuth: AuthContextValue = {
      user: {
        id: 'u-owner',
        email: 'sarah.chen@acmecloud.io',
        full_name: 'Sarah Chen',
        is_active: true,
        is_verified: true,
        is_sso: false,
        created_at: '',
        updated_at: '',
      },
      authContext: null,
      activeRole: 'Owner',
      hasPermission: () => true, // Owner has all permissions
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      devLogin: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    };

    (api.get as any).mockImplementation((url: string) => {
      if (url.includes('/analytics/operational')) {
        return Promise.resolve({
          total_workflows: 12,
          active_workflows: 4,
          pending_approvals: 2,
          approval_rate_percent: 94.5,
          avg_turnaround_hours: 2.1,
          audit_events_count: 55,
          volume_timeline: [],
          status_distribution: [],
          risk_distribution: [],
          top_projects: [],
        });
      }
      if (url.includes('/workflows')) {
        return Promise.resolve({ items: [], total: 12, total_pages: 1 });
      }
      if (url.includes('/audit-logs')) {
        return Promise.resolve({ items: [], total: 55, total_pages: 1 });
      }
      return Promise.resolve({});
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={mockOwnerAuth}>
          <MemoryRouter>
            <DashboardPage />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );

    expect(screen.getByText(/Good morning, Sarah/i)).toBeInTheDocument();
    expect(screen.getByText(/Pending Approvals/i)).toBeInTheDocument();
    expect(screen.getByText(/Active Pipelines/i)).toBeInTheDocument();
    expect(screen.getByText(/7-Day Pass Rate/i)).toBeInTheDocument();
    expect(screen.getByText(/Security Ledger/i)).toBeInTheDocument();

    // Verify analytics WAS requested
    await waitFor(() => {
      const apiGetCalls = (api.get as any).mock.calls.map((c: any) => c[0]);
      expect(apiGetCalls).toContain('/analytics/operational');
    });
  });

  it('AuditLogsPage displays clean Access Restricted state when viewed by unauthorized role', () => {
    const mockViewerAuth: AuthContextValue = {
      user: {
        id: 'u-viewer',
        email: 'maya.patel@acmecloud.io',
        full_name: 'Maya Patel',
        is_active: true,
        is_verified: true,
        is_sso: false,
        created_at: '',
        updated_at: '',
      },
      authContext: null,
      activeRole: 'Viewer',
      hasPermission: (perm: string) => perm === 'workspace.read',
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      devLogin: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    };

    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={mockViewerAuth}>
          <MemoryRouter>
            <AuditLogsPage />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );

    expect(screen.getByText(/Audit Ledger Access Restricted/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Return to Overview/i })).toBeInTheDocument();
  });

  it('AnalyticsPage displays clean Access Restricted state when viewed by unauthorized role', () => {
    const mockViewerAuth: AuthContextValue = {
      user: {
        id: 'u-viewer',
        email: 'maya.patel@acmecloud.io',
        full_name: 'Maya Patel',
        is_active: true,
        is_verified: true,
        is_sso: false,
        created_at: '',
        updated_at: '',
      },
      authContext: null,
      activeRole: 'Viewer',
      hasPermission: (perm: string) => perm === 'workspace.read',
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      devLogin: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    };

    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={mockViewerAuth}>
          <MemoryRouter>
            <AnalyticsPage />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );

    expect(screen.getByText(/Operational Analytics Restricted/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Return to Overview/i })).toBeInTheDocument();
  });
});

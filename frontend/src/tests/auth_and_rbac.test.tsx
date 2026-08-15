import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Can } from '@/features/auth/Can';
import { SignInPage } from '@/features/auth/SignInPage';
import { AuthContext, AuthContextValue } from '@/features/auth/AuthContext';

describe('Auth and RBAC Frontend Integration', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  it('renders SignInPage with email form, Google SSO, and 1-Click Role Switcher', () => {
    const mockAuthContext: AuthContextValue = {
      user: null,
      authContext: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      devLogin: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn(),
      activeRole: null,
    };

    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={mockAuthContext}>
          <MemoryRouter>
            <SignInPage />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );

    expect(screen.getByRole('heading', { name: /Sign in to SecureFlow/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue with Google \(SSO\)/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Work Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In with Email/i })).toBeInTheDocument();
    expect(screen.getByText(/Sarah Chen/i)).toBeInTheDocument();
    expect(screen.getByText(/Elena Rostova/i)).toBeInTheDocument();
  });

  it('Can component renders children when permission is present', () => {
    const mockAuthContext: AuthContextValue = {
      user: { id: '1', email: 'owner@test.io', full_name: 'Owner User', is_active: true, is_verified: true, is_sso: false, created_at: '', updated_at: '' },
      authContext: null,
      activeRole: 'Owner',
      hasPermission: (perm: string) => ['project.create', 'workflow.approve'].includes(perm),
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      devLogin: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    };

    render(
      <AuthContext.Provider value={mockAuthContext}>
        <Can permission="project.create">
          <button>Create New Project</button>
        </Can>
      </AuthContext.Provider>
    );

    expect(screen.getByRole('button', { name: /Create New Project/i })).toBeInTheDocument();
  });

  it('Can component hides children when permission is absent', () => {
    const mockAuthContext: AuthContextValue = {
      user: { id: '2', email: 'viewer@test.io', full_name: 'Viewer User', is_active: true, is_verified: true, is_sso: false, created_at: '', updated_at: '' },
      authContext: null,
      activeRole: 'Viewer',
      hasPermission: (perm: string) => perm === 'project.read',
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      devLogin: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    };

    render(
      <AuthContext.Provider value={mockAuthContext}>
        <Can permission="project.delete" fallback={<p>Unauthorized</p>}>
          <button>Delete Project</button>
        </Can>
      </AuthContext.Provider>
    );

    expect(screen.queryByRole('button', { name: /Delete Project/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Unauthorized/i)).toBeInTheDocument();
  });
});

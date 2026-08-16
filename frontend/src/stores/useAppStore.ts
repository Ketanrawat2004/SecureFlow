import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark';

interface AppState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  activeOrgId: string | null;
  setActiveOrgId: (orgId: string) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  activeDevRolePreview: string | null;
  setActiveDevRolePreview: (role: string | null) => void;
}

export const applyTheme = (theme: ThemeMode) => {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    const body = document.body;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
      if (body) {
        body.classList.add('dark');
        body.classList.remove('light');
      }
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
      if (body) {
        body.classList.remove('dark');
        body.classList.add('light');
      }
    }
  }
};

const getInitialTheme = (): ThemeMode => {
  const saved = localStorage.getItem('secureflow_theme');
  if (saved === 'dark' || saved === 'light') {
    applyTheme(saved);
    return saved;
  }
  // Default ALWAYS to light mode
  applyTheme('light');
  localStorage.setItem('secureflow_theme', 'light');
  return 'light';
};

export const useAppStore = create<AppState>((set) => ({
  theme: getInitialTheme(),
  setTheme: (theme: ThemeMode) => {
    localStorage.setItem('secureflow_theme', theme);
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    set((state) => {
      const nextTheme: ThemeMode = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('secureflow_theme', nextTheme);
      applyTheme(nextTheme);
      return { theme: nextTheme };
    });
  },
  activeOrgId: localStorage.getItem('secureflow_active_org_id') || 'org-acme-corp',
  setActiveOrgId: (orgId: string) => {
    localStorage.setItem('secureflow_active_org_id', orgId);
    set({ activeOrgId: orgId });
  },
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed: boolean) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  mobileMenuOpen: false,
  setMobileMenuOpen: (open: boolean) => set({ mobileMenuOpen: open }),
  activeDevRolePreview: null,
  setActiveDevRolePreview: (role: string | null) => set({ activeDevRolePreview: role }),
}));


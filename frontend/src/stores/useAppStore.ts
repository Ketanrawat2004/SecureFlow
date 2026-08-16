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

const getInitialTheme = (): ThemeMode => {
  const saved = localStorage.getItem('secureflow_theme');
  if (saved === 'dark' || saved === 'light') {
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return saved;
  }
  // Default ALWAYS to light mode
  document.documentElement.classList.remove('dark');
  localStorage.setItem('secureflow_theme', 'light');
  return 'light';
};

export const useAppStore = create<AppState>((set) => ({
  theme: getInitialTheme(),
  setTheme: (theme: ThemeMode) => {
    localStorage.setItem('secureflow_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    set({ theme });
  },
  toggleTheme: () => {
    set((state) => {
      const nextTheme: ThemeMode = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('secureflow_theme', nextTheme);
      if (nextTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
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


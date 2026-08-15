import { create } from 'zustand';

interface AppState {
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

export const useAppStore = create<AppState>((set) => ({
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

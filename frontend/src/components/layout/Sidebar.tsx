import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BarChart3,
  CheckSquare,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  FolderGit2,
  GitPullRequest,
  Lock,
  LogOut,
  Settings,
  Shield,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/features/auth/AuthContext';
import { useAppStore } from '@/stores/useAppStore';
import { Organization } from '@/types';

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const { user, activeRole, logout } = useAuth();
  const { activeOrgId, setActiveOrgId, sidebarCollapsed, toggleSidebar, setMobileMenuOpen } = useAppStore();
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);

  // Fetch workspaces
  const { data: orgs } = useQuery<Organization[]>({
    queryKey: ['organizations'],
    queryFn: () => api.get<Organization[]>('/organizations'),
    staleTime: 1000 * 60 * 5,
  });

  // Fetch pending approvals count for badge
  const { data: approvalsData } = useQuery<{ total: number }>({
    queryKey: ['approvals', 'count', activeOrgId],
    queryFn: () => api.get<{ total: number }>('/approvals?status=pending&page_size=1'),
    refetchInterval: 15000,
  });

  const activeOrg = orgs?.find((o) => o.id === activeOrgId) || orgs?.[0];
  const pendingCount = approvalsData?.total || 0;

  const navigationSections = [
    {
      title: 'Governance',
      items: [
        { label: 'Overview', href: '/', icon: Activity },
        { label: 'Projects', href: '/projects', icon: FolderGit2 },
        { label: 'Workflows', href: '/workflows', icon: GitPullRequest },
        {
          label: 'Approvals',
          href: '/approvals',
          icon: CheckSquare,
          badge: pendingCount > 0 ? pendingCount : undefined,
          badgeVariant: 'warning' as const,
        },
      ],
    },
    {
      title: 'Security & Access',
      items: [
        { label: 'Team Directory', href: '/members', icon: Users },
        { label: 'Roles & Matrix', href: '/roles', icon: Shield },
        { label: 'Audit Ledger', href: '/audit', icon: ShieldAlert },
        { label: 'Analytics', href: '/analytics', icon: BarChart3 },
      ],
    },
    {
      title: 'System',
      items: [{ label: 'Settings', href: '/settings', icon: Settings }],
    },
  ];

  const roleColors: Record<string, 'purple' | 'info' | 'success' | 'warning' | 'neutral'> = {
    Owner: 'purple',
    Admin: 'info',
    Developer: 'success',
    Auditor: 'warning',
    Viewer: 'neutral',
  };

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <aside
      className={`h-full flex flex-col bg-surface-900 border-r border-surface-750 transition-all duration-150 select-none z-30 ${
        sidebarCollapsed ? 'w-[60px]' : 'w-56'
      }`}
    >
      {/* Brand Header */}
      <div className="h-12 flex items-center justify-between px-3.5 border-b border-surface-750">
        <Link to="/" className="flex items-center gap-2 overflow-hidden group">
          <div className="w-6 h-6 rounded bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400 shrink-0 group-hover:border-brand-500 transition-colors">
            <Lock className="w-3.5 h-3.5" />
          </div>
          {!sidebarCollapsed && (
            <div className="truncate">
              <span className="text-xs font-semibold tracking-tight text-surface-100 flex items-center gap-1">
                SECURE<span className="text-brand-400">FLOW</span>
              </span>
            </div>
          )}
        </Link>

        {!sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            aria-label="Collapse sidebar"
            className="hidden md:flex p-1 rounded text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Workspace Selector */}
      {!sidebarCollapsed && (
        <div className="p-2 border-b border-surface-750 relative">
          <button
            onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
            className="w-full flex items-center justify-between p-1.5 rounded bg-surface-850 border border-surface-700/70 hover:border-surface-600 transition-colors text-left"
          >
            <div className="flex items-center gap-2 truncate">
              <div className="w-5 h-5 rounded bg-surface-750 text-surface-200 text-[10px] font-mono flex items-center justify-center font-bold shrink-0">
                {activeOrg?.name ? activeOrg.name[0] : 'A'}
              </div>
              <div className="truncate">
                <p className="text-[11px] font-medium text-surface-200 truncate leading-tight">
                  {activeOrg?.name || 'Acme Cloud'}
                </p>
              </div>
            </div>
            <ChevronDown className="w-3 h-3 text-surface-400 shrink-0" />
          </button>

          {/* Org Dropdown */}
          {orgDropdownOpen && (
            <div className="absolute top-full left-2 right-2 mt-1 bg-surface-900 border border-surface-700 rounded-md shadow-modal p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="text-[10px] uppercase font-mono text-surface-400 px-2 py-0.5 tracking-wider">
                Workspaces
              </div>
              {orgs?.map((org) => (
                <button
                  key={org.id}
                  onClick={() => {
                    setActiveOrgId(org.id);
                    setOrgDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-[11px] transition-colors text-left ${
                    org.id === activeOrgId
                      ? 'bg-brand-500/10 text-brand-300 font-medium'
                      : 'text-surface-300 hover:bg-surface-800 hover:text-surface-100'
                  }`}
                >
                  <span className="truncate">{org.name}</span>
                  {org.id === activeOrgId && <span className="text-[9px] font-mono text-brand-400">ACTIVE</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Navigation List */}
      <nav className="flex-1 px-2 py-2.5 space-y-3 overflow-y-auto" aria-label="Main Navigation">
        {navigationSections.map((sec) => (
          <div key={sec.title} className="space-y-0.5">
            {!sidebarCollapsed && (
              <div className="px-2 py-0.5 text-[10px] uppercase font-mono text-surface-500 tracking-wider">
                {sec.title}
              </div>
            )}
            {sec.items.map((item) => {
              const isActive =
                item.href === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={handleNavClick}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`flex items-center gap-2.5 px-2 py-1.5 rounded text-xs transition-colors ${
                    isActive
                      ? 'bg-surface-800 text-surface-100 font-medium border-l-2 border-brand-500 pl-[7px]'
                      : 'text-surface-400 hover:text-surface-200 hover:bg-surface-850'
                  } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-brand-400' : 'text-surface-400'}`} />
                  {!sidebarCollapsed && <span className="flex-1 truncate">{item.label}</span>}
                  {!sidebarCollapsed && item.badge !== undefined && (
                    <Badge variant={item.badgeVariant || 'neutral'} size="xs">
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Sidebar Expand Button (when collapsed) */}
      {sidebarCollapsed && (
        <div className="p-2 border-t border-surface-750 flex justify-center">
          <button
            onClick={toggleSidebar}
            aria-label="Expand sidebar"
            className="p-1.5 rounded text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* User Footer */}
      <div className="p-2 border-t border-surface-750 bg-surface-950/30">
        <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} gap-1.5`}>
          <div className="flex items-center gap-2 truncate">
            <Avatar name={user?.full_name || 'User'} src={user?.avatar_url} size="xs" />
            {!sidebarCollapsed && (
              <div className="truncate">
                <p className="text-[11px] font-medium text-surface-200 truncate leading-tight">
                  {user?.full_name || 'User'}
                </p>
                <div className="mt-0.5">
                  <Badge variant={roleColors[activeRole || 'Viewer'] || 'neutral'} size="xs">
                    {activeRole || 'Viewer'}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          {!sidebarCollapsed && (
            <button
              onClick={logout}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-1 rounded text-surface-400 hover:text-rose-400 hover:bg-surface-800 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

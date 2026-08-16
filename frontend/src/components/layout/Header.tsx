import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Check,
  CheckCheck,
  ChevronRight,
  Menu,
  Moon,
  Shield,
  Sun,
  User as UserIcon,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/features/auth/AuthContext';
import { useRealtime } from '@/features/realtime/RealtimeEventsContext';
import { useAppStore } from '@/stores/useAppStore';
import { NotificationCountResponse, NotificationItem } from '@/types';

export const Header: React.FC = () => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const { user, activeRole, devLogin, logout } = useAuth();
  const { activeOrgId, setMobileMenuOpen, theme, toggleTheme } = useAppStore();
  const { status: realtimeStatus } = useRealtime();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Fetch unread notifications count
  const { data: countData } = useQuery<NotificationCountResponse>({
    queryKey: ['notifications', 'count', activeOrgId],
    queryFn: () => api.get<NotificationCountResponse>('/notifications/unread-count'),
    refetchInterval: 15000,
  });

  // Fetch notifications list
  const { data: notifications } = useQuery<NotificationItem[]>({
    queryKey: ['notifications', 'list', activeOrgId],
    queryFn: () => api.get<NotificationItem[]>('/notifications?limit=8'),
    enabled: notifOpen,
  });

  // Mark single as read mutation
  const markReadMutation = useMutation({
    mutationFn: (notifId: string) => api.post(`/notifications/${notifId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: () => api.post('/notifications/mark-all-read'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const devRoles = [
    { role: 'Owner', name: 'Sarah Chen (Owner)', email: 'sarah.chen@acmecloud.io' },
    { role: 'Admin', name: 'Alex Rivera (Admin)', email: 'alex.rivera@acmecloud.io' },
    { role: 'Developer', name: 'Elena Rostova (Dev)', email: 'elena.rostova@acmecloud.io' },
    { role: 'Auditor', name: 'David Kim (Auditor)', email: 'david.kim@acmecloud.io' },
    { role: 'Viewer', name: 'Maya Patel (Viewer)', email: 'maya.patel@acmecloud.io' },
  ];

  const unreadCount = countData?.unread_count || 0;

  // Derive breadcrumb path
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const firstSegment = pathSegments[0] || '';
  const pageTitle = firstSegment ? firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1) : 'Overview';

  return (
    <header className="h-12 bg-surface-900 border-b border-surface-750 px-3 sm:px-4 flex items-center justify-between gap-3 sticky top-0 z-20">
      {/* Left Area: Mobile Menu & Breadcrumb Path */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open mobile navigation"
          className="md:hidden p-1.5 rounded text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1.5 text-xs text-surface-400">
          <Link to="/" className="hover:text-surface-200 transition-colors">
            SecureFlow
          </Link>
          <ChevronRight className="w-3 h-3 text-surface-600" />
          <span className="text-surface-200 font-medium">{pageTitle}</span>
          {pathSegments.length > 1 && (
            <>
              <ChevronRight className="w-3 h-3 text-surface-600" />
              <span className="text-surface-400 font-mono text-[11px] truncate max-w-[120px]">
                {pathSegments[1]}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Center: 1-Click Role Switcher Bar */}
      <div className="hidden lg:flex items-center gap-1 bg-surface-950 border border-surface-750 rounded px-1.5 py-0.5">
        <div className="flex items-center gap-1 text-[10px] font-mono text-surface-400 pr-1.5 border-r border-surface-800">
          <Shield className="w-3 h-3 text-brand-400" />
          <span>SIMULATE:</span>
        </div>
        {devRoles.map((dr) => {
          const isSelected = activeRole === dr.role;
          return (
            <button
              key={dr.role}
              onClick={() => devLogin(dr.role, dr.email)}
              className={`text-[11px] font-medium px-2 py-0.5 rounded transition-colors ${
                isSelected
                  ? 'bg-surface-800 text-brand-400 font-semibold border border-surface-700'
                  : 'text-surface-400 hover:text-surface-200 hover:bg-surface-850'
              }`}
              title={`Switch authorization context to ${dr.name}`}
            >
              {dr.role}
            </button>
          );
        })}
      </div>

      {/* Right Controls: Realtime Status, Notifications & User */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Realtime Stream Status Dot */}
        <div
          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-950/60 border border-surface-750/80 text-[10px] font-mono text-surface-400"
          title={
            realtimeStatus === 'connected'
              ? 'Real-time event stream active (SSE connected)'
              : realtimeStatus === 'reconnecting'
              ? 'Reconnecting to event stream...'
              : 'Real-time event stream disconnected'
          }
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              realtimeStatus === 'connected'
                ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse'
                : realtimeStatus === 'reconnecting'
                ? 'bg-amber-400 animate-ping'
                : 'bg-surface-500'
            }`}
          />
          <span className="hidden xl:inline text-[9px] uppercase tracking-wider text-surface-400">
            {realtimeStatus === 'connected' ? 'LIVE' : realtimeStatus === 'reconnecting' ? 'SYNC' : 'IDLE'}
          </span>
        </div>

        {/* Theme Toggle (Light / Dark Mode) */}
        <button
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          className="p-1.5 rounded text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors flex items-center justify-center border border-transparent hover:border-surface-750"
        >
          {theme === 'light' ? (
            <Moon className="w-3.5 h-3.5 text-surface-400 hover:text-brand-500 transition-colors" />
          ) : (
            <Sun className="w-3.5 h-3.5 text-amber-400 hover:text-amber-300 transition-colors" />
          )}
        </button>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            aria-label="Notifications"
            className="relative p-1.5 rounded text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors"
          >
            <Bell className="w-3.5 h-3.5" />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-brand-500 text-surface-950 text-[9px] font-mono font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-1 w-80 sm:w-96 bg-surface-900 border border-surface-700 rounded-md shadow-modal z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between px-3 py-2 border-b border-surface-750 bg-surface-950/40">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-semibold text-surface-100">Notifications</h4>
                  {unreadCount > 0 && (
                    <Badge variant="info" size="xs">
                      {unreadCount} new
                    </Badge>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllReadMutation.mutate()}
                    className="text-[10px] text-brand-400 hover:text-brand-300 flex items-center gap-1 font-medium"
                  >
                    <CheckCheck className="w-3 h-3" />
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-surface-800">
                {notifications && notifications.length > 0 ? (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-2.5 text-xs transition-colors hover:bg-surface-850 flex items-start gap-2.5 ${
                        !n.is_read ? 'bg-surface-850/50' : ''
                      }`}
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-brand-400"
                        style={{ opacity: n.is_read ? 0 : 1 }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-surface-200 leading-tight">{n.title}</p>
                        <p className="text-surface-400 mt-0.5 leading-normal text-[11px]">{n.message}</p>
                      </div>
                      {!n.is_read && (
                        <button
                          onClick={() => markReadMutation.mutate(n.id)}
                          aria-label="Mark read"
                          className="text-surface-500 hover:text-surface-300 p-0.5"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-xs text-surface-400">
                    No new notifications
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Account Dropdown */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 p-1 rounded hover:bg-surface-800 transition-colors"
          >
            <Avatar name={user?.full_name || 'User'} src={user?.avatar_url} size="xs" />
            <div className="hidden sm:block text-left">
              <span className="text-[11px] font-medium text-surface-200 block leading-tight truncate max-w-[100px]">
                {user?.full_name || 'User'}
              </span>
            </div>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-1 w-52 bg-surface-900 border border-surface-700 rounded-md shadow-modal py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2 border-b border-surface-750">
                <p className="text-xs font-semibold text-surface-100">{user?.full_name}</p>
                <p className="text-[10px] text-surface-400 truncate font-mono">{user?.email}</p>
              </div>
              <Link
                to="/settings"
                onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-800 hover:text-surface-100 transition-colors"
              >
                <UserIcon className="w-3.5 h-3.5 text-surface-400" />
                Account Settings
              </Link>
              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  logout();
                }}
                className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-950/30 transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

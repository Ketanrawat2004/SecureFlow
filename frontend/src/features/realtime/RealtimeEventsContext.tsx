import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthContext';
import { useAppStore } from '@/stores/useAppStore';

export type RealtimeStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface RealtimeContextValue {
  status: RealtimeStatus;
  lastEventTime: Date | null;
}

const RealtimeEventsContext = createContext<RealtimeContextValue>({
  status: 'disconnected',
  lastEventTime: null,
});

export const RealtimeEventsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const { isAuthenticated, authContext, hasPermission } = useAuth();
  const { activeOrgId } = useAppStore();
  const [status, setStatus] = useState<RealtimeStatus>('disconnected');
  const [lastEventTime, setLastEventTime] = useState<Date | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const hasPermissionRef = useRef(hasPermission);

  useEffect(() => {
    hasPermissionRef.current = hasPermission;
  }, [hasPermission]);

  useEffect(() => {
    const token = localStorage.getItem('secureflow_access_token');
    if (!token || !isAuthenticated) {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.onopen = null;
        eventSourceRef.current.onerror = null;
        eventSourceRef.current.onmessage = null;
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setStatus('disconnected');
      return;
    }

    let isMounted = true;

    const cleanupExistingConnection = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.onopen = null;
        eventSourceRef.current.onerror = null;
        eventSourceRef.current.onmessage = null;
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };

    const connectSSE = () => {
      if (!isMounted) return;

      cleanupExistingConnection();

      const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/+$/, '');
      const targetOrgId =
        authContext?.active_organization_id ||
        activeOrgId ||
        localStorage.getItem('secureflow_active_org_id') ||
        '';
      const orgParam = targetOrgId ? `&org_id=${encodeURIComponent(targetOrgId)}` : '';
      const streamUrl = `${apiBase}/realtime/stream?token=${encodeURIComponent(token)}${orgParam}`;

      try {
        const es = new EventSource(streamUrl);
        eventSourceRef.current = es;

        const markConnected = () => {
          if (!isMounted) return;
          setStatus('connected');
          retryCountRef.current = 0;
        };

        // 1. Native onopen handler
        es.onopen = markConnected;

        // 2. Open event listener
        es.addEventListener('open', markConnected);

        // 3. Custom "connected" event listener
        es.addEventListener('connected', markConnected);

        // 4. Heartbeat ping handler
        es.addEventListener('ping', markConnected);

        // 5. Domain event message handler
        es.addEventListener('message', (event: MessageEvent) => {
          markConnected();
          try {
            const data = JSON.parse(event.data);
            setLastEventTime(new Date());

            const eventType = data.event_type as string;
            const canReadAnalytics = hasPermissionRef.current ? hasPermissionRef.current('analytics.read') : false;
            const canReadAudit = hasPermissionRef.current ? hasPermissionRef.current('audit.read') : false;

            if (eventType?.startsWith('Workflow')) {
              queryClient.invalidateQueries({ queryKey: ['workflows'] });
              queryClient.invalidateQueries({ queryKey: ['approvals'] });
              if (canReadAnalytics) {
                queryClient.invalidateQueries({ queryKey: ['analytics'] });
              }
              queryClient.invalidateQueries({ queryKey: ['projects'] });
              if (canReadAudit) {
                queryClient.invalidateQueries({ queryKey: ['audit'] });
              }
            } else if (eventType?.startsWith('Project')) {
              queryClient.invalidateQueries({ queryKey: ['projects'] });
              if (canReadAnalytics) {
                queryClient.invalidateQueries({ queryKey: ['analytics'] });
              }
              if (canReadAudit) {
                queryClient.invalidateQueries({ queryKey: ['audit'] });
              }
            } else if (eventType?.startsWith('Member') || eventType === 'RoleChanged') {
              queryClient.invalidateQueries({ queryKey: ['members'] });
              queryClient.invalidateQueries({ queryKey: ['auth'] });
              if (canReadAudit) {
                queryClient.invalidateQueries({ queryKey: ['audit'] });
              }
            } else if (eventType === 'NotificationCreated') {
              queryClient.invalidateQueries({ queryKey: ['notifications'] });
            } else if (eventType === 'AuditEventCreated') {
              if (canReadAudit) {
                queryClient.invalidateQueries({ queryKey: ['audit'] });
              }
            }
          } catch (parseErr) {
            console.error('Error handling SSE event payload:', parseErr);
          }
        });

        // 6. Robust onerror handler
        es.onerror = () => {
          if (!isMounted) return;

          if (es.readyState === EventSource.CONNECTING) {
            // Browser is natively attempting to reconnect
            setStatus('reconnecting');
            return;
          }

          if (es.readyState === EventSource.CLOSED) {
            // Connection closed; schedule backoff reconnect
            setStatus('reconnecting');
            cleanupExistingConnection();

            const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 15000);
            retryCountRef.current += 1;

            reconnectTimeoutRef.current = setTimeout(() => {
              if (isMounted) {
                connectSSE();
              }
            }, delay);
          }
        };
      } catch (err) {
        if (!isMounted) return;
        setStatus('reconnecting');

        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 15000);
        retryCountRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMounted) {
            connectSSE();
          }
        }, delay);
      }
    };

    connectSSE();

    return () => {
      isMounted = false;
      cleanupExistingConnection();
    };
  }, [isAuthenticated, authContext?.active_organization_id, activeOrgId, queryClient]);

  return (
    <RealtimeEventsContext.Provider value={{ status, lastEventTime }}>
      {children}
    </RealtimeEventsContext.Provider>
  );
};

export const useRealtime = () => useContext(RealtimeEventsContext);


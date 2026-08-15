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
  const { isAuthenticated, hasPermission } = useAuth();
  const { activeOrgId } = useAppStore();
  const [status, setStatus] = useState<RealtimeStatus>('disconnected');
  const [lastEventTime, setLastEventTime] = useState<Date | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  useEffect(() => {
    if (!isAuthenticated || !activeOrgId) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setStatus('disconnected');
      return;
    }

    const token = localStorage.getItem('secureflow_access_token');
    if (!token) return;

    let isMounted = true;

    const connectSSE = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const streamUrl = `/api/v1/realtime/stream?token=${encodeURIComponent(token)}&org_id=${encodeURIComponent(activeOrgId)}`;
      
      try {
        const es = new EventSource(streamUrl);
        eventSourceRef.current = es;

        es.addEventListener('connected', () => {
          if (!isMounted) return;
          setStatus('connected');
          retryCountRef.current = 0;
        });

        es.addEventListener('ping', () => {
          if (!isMounted) return;
          setStatus('connected');
        });

        es.addEventListener('message', (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            setLastEventTime(new Date());

            const eventType = data.event_type as string;

            if (eventType?.startsWith('Workflow')) {
              queryClient.invalidateQueries({ queryKey: ['workflows'] });
              queryClient.invalidateQueries({ queryKey: ['approvals'] });
              if (hasPermission('analytics.read')) {
                queryClient.invalidateQueries({ queryKey: ['analytics'] });
              }
              queryClient.invalidateQueries({ queryKey: ['projects'] });
              if (hasPermission('audit.read')) {
                queryClient.invalidateQueries({ queryKey: ['audit'] });
              }
            } else if (eventType?.startsWith('Project')) {
              queryClient.invalidateQueries({ queryKey: ['projects'] });
              if (hasPermission('analytics.read')) {
                queryClient.invalidateQueries({ queryKey: ['analytics'] });
              }
              if (hasPermission('audit.read')) {
                queryClient.invalidateQueries({ queryKey: ['audit'] });
              }
            } else if (eventType?.startsWith('Member') || eventType === 'RoleChanged') {
              queryClient.invalidateQueries({ queryKey: ['members'] });
              queryClient.invalidateQueries({ queryKey: ['auth'] });
              if (hasPermission('audit.read')) {
                queryClient.invalidateQueries({ queryKey: ['audit'] });
              }
            } else if (eventType === 'NotificationCreated') {
              queryClient.invalidateQueries({ queryKey: ['notifications'] });
            } else if (eventType === 'AuditEventCreated') {
              if (hasPermission('audit.read')) {
                queryClient.invalidateQueries({ queryKey: ['audit'] });
              }
            }
          } catch (parseErr) {
            console.error('Error handling SSE event payload:', parseErr);
          }
        });

        es.onerror = () => {
          if (!isMounted) return;
          setStatus('reconnecting');
          es.close();
          eventSourceRef.current = null;

          // Exponential backoff reconnection
          const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
          retryCountRef.current += 1;

          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMounted) {
              connectSSE();
            }
          }, delay);
        };
      } catch (err) {
        if (!isMounted) return;
        setStatus('reconnecting');
      }
    };

    connectSSE();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [isAuthenticated, activeOrgId, queryClient, hasPermission]);

  return (
    <RealtimeEventsContext.Provider value={{ status, lastEventTime }}>
      {children}
    </RealtimeEventsContext.Provider>
  );
};

export const useRealtime = () => useContext(RealtimeEventsContext);

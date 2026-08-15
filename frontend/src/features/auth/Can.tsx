import React from 'react';
import { useAuth } from '@/features/auth/AuthContext';

interface CanProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Conditionally renders children if current user has the specified permission.
 * Note: Frontend checks are for UX only; backend API is the true security boundary.
 */
export const Can: React.FC<CanProps> = ({ permission, children, fallback = null }) => {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
};

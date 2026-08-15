import React from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: 'primary' | 'secondary';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionVariant = 'primary',
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-6 sm:p-10 text-center rounded-md border border-dashed border-surface-750 bg-surface-900/40">
      {icon && (
        <div className="p-2.5 rounded bg-surface-850 border border-surface-750 text-surface-400 mb-3">
          {icon}
        </div>
      )}
      <h3 className="text-xs font-semibold text-surface-100">{title}</h3>
      <p className="text-[11px] text-surface-400 max-w-sm mt-1 mb-4 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant={actionVariant} size="xs" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

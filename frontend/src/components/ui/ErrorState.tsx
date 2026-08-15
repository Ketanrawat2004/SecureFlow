import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Service Unavailable',
  message = 'An unexpected error occurred while communicating with the service.',
  onRetry,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center rounded-md border border-rose-900/40 bg-rose-950/20 my-3">
      <div className="p-2 rounded bg-rose-950 border border-rose-800/60 text-rose-300 mb-2.5">
        <AlertCircle className="w-4 h-4" />
      </div>
      <h3 className="text-xs font-semibold text-rose-200">{title}</h3>
      <p className="text-[11px] text-surface-400 max-w-sm mt-0.5 mb-3">{message}</p>
      {onRetry && (
        <Button
          variant="secondary"
          size="xs"
          leftIcon={<RefreshCw className="w-3 h-3" />}
          onClick={onRetry}
        >
          Try Again
        </Button>
      )}
    </div>
  );
};

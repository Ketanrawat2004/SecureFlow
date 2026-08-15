import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => {
  return (
    <div
      className={`animate-pulse bg-surface-800/70 rounded-md ${className}`}
      aria-hidden="true"
    />
  );
};

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 5,
}) => {
  return (
    <div className="w-full divide-y divide-surface-800/80">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="py-3.5 px-4 flex items-center justify-between gap-4">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton
              key={c}
              className={`h-4 ${c === 0 ? 'w-1/3' : c === columns - 1 ? 'w-16' : 'w-1/5'}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

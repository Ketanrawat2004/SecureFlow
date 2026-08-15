import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  className = '',
}) => {
  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  if (totalPages <= 1 && totalItems <= pageSize) return null;

  return (
    <div className={`flex items-center justify-between px-3 py-2 border-t border-surface-750 ${className}`}>
      <div className="text-[11px] text-surface-400">
        Showing <span className="font-medium text-surface-200">{startItem}</span> to{' '}
        <span className="font-medium text-surface-200">{endItem}</span> of{' '}
        <span className="font-medium text-surface-200">{totalItems}</span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="secondary"
          size="xs"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
          leftIcon={<ChevronLeft className="w-3 h-3" />}
        >
          Prev
        </Button>
        <div className="text-[11px] font-mono px-2 text-surface-400">
          {page} / {totalPages || 1}
        </div>
        <Button
          variant="secondary"
          size="xs"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
          rightIcon={<ChevronRight className="w-3 h-3" />}
        >
          Next
        </Button>
      </div>
    </div>
  );
};

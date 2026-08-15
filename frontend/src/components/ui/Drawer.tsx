import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  side?: 'left' | 'right';
  width?: 'sm' | 'md' | 'lg';
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  side = 'right',
  width = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthStyles = {
    sm: 'max-w-[260px]',
    md: 'max-w-sm',
    lg: 'max-w-md',
  };

  const sideStyles = {
    left: 'left-0 animate-in slide-in-from-left duration-150',
    right: 'right-0 animate-in slide-in-from-right duration-150',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-surface-950/80 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`fixed inset-y-0 ${sideStyles[side]} flex w-full ${widthStyles[width]} bg-surface-900 border-${
          side === 'left' ? 'r' : 'l'
        } border-surface-750 shadow-modal flex-col z-10`}
      >
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-surface-750">
          <h3 className="text-xs font-semibold text-surface-100">{title || 'Navigation'}</h3>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="text-surface-400 hover:text-surface-200 p-1 rounded hover:bg-surface-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

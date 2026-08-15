import React from 'react';
import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
}) => {
  const icons = {
    danger: <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0" />,
    warning: <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />,
    primary: <Info className="w-6 h-6 text-brand-400 shrink-0" />,
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-4 pt-1">
        <div className="p-2.5 rounded-xl bg-surface-800/80 border border-surface-700/60 h-fit">
          {icons[variant]}
        </div>
        <div className="space-y-1.5">
          <h4 className="text-sm font-semibold text-surface-100">{title}</h4>
          <p className="text-xs text-surface-400 leading-relaxed">{message}</p>
        </div>
      </div>
    </Modal>
  );
};

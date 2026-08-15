import React from 'react';
import { Check } from 'lucide-react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, id, className = '', checked, onChange, ...props }, ref) => {
    const checkboxId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <label htmlFor={checkboxId} className="flex items-start gap-2.5 cursor-pointer select-none group">
        <div className="relative flex items-center justify-center mt-0.5">
          <input
            id={checkboxId}
            ref={ref}
            type="checkbox"
            checked={checked}
            onChange={onChange}
            className="peer sr-only"
            {...props}
          />
          <div className="w-4 h-4 rounded border border-surface-700 bg-surface-900 peer-checked:bg-brand-500 peer-checked:border-brand-500 transition-colors flex items-center justify-center group-hover:border-surface-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500">
            <Check className="w-3 h-3 text-surface-950 stroke-[3] opacity-0 peer-checked:opacity-100 transition-opacity" />
          </div>
        </div>
        {(label || description) && (
          <div className="text-xs">
            {label && <span className="font-medium text-surface-200 block">{label}</span>}
            {description && <span className="text-surface-400 block mt-0.5">{description}</span>}
          </div>
        )}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';

import React from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  helperText?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, helperText, id, className = '', ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1">
        {label && (
          <label htmlFor={selectId} className="block text-[11px] font-medium text-surface-300">
            {label}
            {props.required && <span className="text-rose-400 ml-0.5">*</span>}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={`w-full bg-surface-900 border text-surface-100 rounded-md text-xs transition-colors px-2.5 h-8
            ${
              error
                ? 'border-rose-500/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30'
                : 'border-surface-700 hover:border-surface-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30'
            }
            disabled:opacity-40 disabled:cursor-not-allowed
            ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-surface-900 text-surface-100">
              {opt.label}
            </option>
          ))}
        </select>
        {error ? (
          <p className="text-[11px] text-rose-400 mt-0.5">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-surface-400 mt-0.5">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';

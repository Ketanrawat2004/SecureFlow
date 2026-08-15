import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, id, className = '', rows = 3, ...props }, ref) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1">
        {label && (
          <label htmlFor={textareaId} className="block text-[11px] font-medium text-surface-300">
            {label}
            {props.required && <span className="text-rose-400 ml-0.5">*</span>}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          rows={rows}
          className={`w-full bg-surface-900 border text-surface-100 placeholder-surface-500 rounded-md text-xs transition-colors px-2.5 py-2
            ${
              error
                ? 'border-rose-500/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30'
                : 'border-surface-700 hover:border-surface-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30'
            }
            disabled:opacity-40 disabled:cursor-not-allowed
            ${className}`}
          {...props}
        />
        {error ? (
          <p className="text-[11px] text-rose-400 mt-0.5">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-surface-400 mt-0.5">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

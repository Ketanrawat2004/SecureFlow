import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'success'
    | 'warning'
    | 'danger'
    | 'info'
    | 'purple'
    | 'neutral'
    | 'outline'
    | 'brand';
  size?: 'xs' | 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  dot = false,
  className = '',
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center font-medium rounded transition-colors select-none tracking-tight';

  const sizeStyles = {
    xs: 'text-[10px] px-1.5 py-0.2 gap-1 font-mono uppercase tracking-wider',
    sm: 'text-[11px] px-2 py-0.5 gap-1.5 leading-tight',
    md: 'text-xs px-2.5 py-0.5 gap-1.5 leading-normal',
  };

  const variantStyles = {
    success:
      'bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60 font-semibold',
    warning:
      'bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60 font-semibold',
    danger:
      'bg-rose-50 text-rose-700 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60 font-semibold',
    info:
      'bg-sky-50 text-sky-700 border border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/60 font-semibold',
    brand:
      'bg-brand-50 text-brand-700 border border-brand-300 dark:bg-brand-950/60 dark:text-brand-300 dark:border-brand-800/60 font-semibold',
    purple:
      'bg-purple-50 text-purple-700 border border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/60 font-semibold',
    neutral:
      'bg-surface-800 text-surface-200 border border-surface-700 font-medium',
    outline:
      'bg-transparent text-surface-300 border border-surface-700 font-medium',
  };

  const dotStyles = {
    success: 'bg-emerald-600 dark:bg-emerald-400',
    warning: 'bg-amber-600 dark:bg-amber-400',
    danger: 'bg-rose-600 dark:bg-rose-400',
    info: 'bg-sky-600 dark:bg-sky-400',
    brand: 'bg-brand-600 dark:bg-brand-400',
    purple: 'bg-purple-600 dark:bg-purple-400',
    neutral: 'bg-surface-400',
    outline: 'bg-surface-400',
  };

  return (
    <span
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotStyles[variant]}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
};

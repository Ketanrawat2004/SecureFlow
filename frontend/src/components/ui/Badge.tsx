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
    success: 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/50',
    warning: 'bg-amber-950/50 text-amber-300 border border-amber-800/50',
    danger: 'bg-rose-950/50 text-rose-300 border border-rose-800/50',
    info: 'bg-sky-950/50 text-sky-300 border border-sky-800/50',
    brand: 'bg-brand-950/50 text-brand-300 border border-brand-800/50',
    purple: 'bg-purple-950/50 text-purple-300 border border-purple-800/50',
    neutral: 'bg-surface-800/90 text-surface-300 border border-surface-700/70',
    outline: 'bg-transparent text-surface-400 border border-surface-700',
  };

  const dotStyles = {
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-rose-400',
    info: 'bg-sky-400',
    brand: 'bg-brand-400',
    purple: 'bg-purple-400',
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

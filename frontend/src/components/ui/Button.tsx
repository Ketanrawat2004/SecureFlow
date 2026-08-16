import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-md transition-colors duration-120 select-none disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.99] text-center tracking-tight';

    const sizeStyles = {
      xs: 'text-[11px] h-6 px-2 gap-1.5',
      sm: 'text-xs h-7 px-2.5 gap-1.5',
      md: 'text-xs h-8 px-3 gap-2',
      lg: 'text-sm h-9 px-4 gap-2',
    };

    const variantStyles = {
      primary:
        'bg-brand-500 hover:bg-brand-400 text-white font-semibold shadow-subtle border border-brand-400/40',
      secondary:
        'bg-surface-850 hover:bg-surface-800 text-surface-100 hover:text-surface-50 border border-surface-700 shadow-subtle',
      outline:
        'bg-transparent hover:bg-surface-800 text-surface-200 hover:text-surface-100 border border-surface-700',
      ghost:
        'bg-transparent hover:bg-surface-800 text-surface-300 hover:text-surface-100 border border-transparent',
      danger:
        'bg-rose-600 hover:bg-rose-500 text-white font-medium shadow-subtle border border-rose-500/50',
      success:
        'bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-subtle border border-emerald-500/50',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-current shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

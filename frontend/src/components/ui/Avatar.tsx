import React, { useState } from 'react';

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  src,
  size = 'md',
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);

  const getInitials = (fullName: string): string => {
    if (!fullName) return '?';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return (parts[0]?.[0] || '?').toUpperCase();
    return ((parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '')).toUpperCase();
  };

  const getColorFromName = (str: string): string => {
    const colors = [
      'bg-teal-900/80 text-teal-200 border-teal-700/60',
      'bg-indigo-900/80 text-indigo-200 border-indigo-700/60',
      'bg-purple-900/80 text-purple-200 border-purple-700/60',
      'bg-amber-900/80 text-amber-200 border-amber-700/60',
      'bg-emerald-900/80 text-emerald-200 border-emerald-700/60',
      'bg-blue-900/80 text-blue-200 border-blue-700/60',
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index] || colors[0]!;
  };

  const sizeStyles = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base',
    xl: 'w-14 h-14 text-lg',
  };

  const showImage = src && !imageError;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full border overflow-hidden font-medium select-none ${sizeStyles[size]} ${
        !showImage ? getColorFromName(name) : 'border-surface-700'
      } ${className}`}
      title={name}
    >
      {showImage ? (
        <img
          src={src}
          alt={name}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  );
};

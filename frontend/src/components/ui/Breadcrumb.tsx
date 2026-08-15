import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className = '' }) => {
  return (
    <nav className={`flex items-center space-x-1.5 text-xs text-surface-400 ${className}`} aria-label="Breadcrumb">
      <Link
        to="/"
        className="hover:text-surface-200 transition-colors p-1 rounded hover:bg-surface-800 flex items-center"
      >
        <Home className="w-3.5 h-3.5" />
      </Link>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={index}>
            <ChevronRight className="w-3 h-3 text-surface-600 shrink-0" />
            {item.href && !isLast ? (
              <Link to={item.href} className="hover:text-surface-200 transition-colors truncate max-w-[140px] sm:max-w-none">
                {item.label}
              </Link>
            ) : (
              <span className="text-surface-200 font-medium truncate max-w-[140px] sm:max-w-none">
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

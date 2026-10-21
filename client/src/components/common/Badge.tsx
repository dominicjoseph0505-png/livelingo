import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'cobalt' | 'neutral' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
  className?: string;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
  icon,
}) => {
  const baseStyles = 'inline-flex items-center font-medium rounded-full select-none';

  const sizeStyles = {
    sm: 'text-xs px-2.5 py-0.5 gap-1',
    md: 'text-xs px-3 py-1 gap-1.5',
  };

  const variantStyles = {
    cobalt: 'bg-[#3563E9]/10 text-[#3563E9] border border-[#3563E9]/20',
    neutral: 'bg-[#F2EFE8] text-[#5A6270] border border-[#E5E2D9]',
    success: 'bg-[#10B981]/10 text-[#059669] border border-[#10B981]/25',
    warning: 'bg-[#F59E0B]/10 text-[#D97706] border border-[#F59E0B]/25',
    danger: 'bg-[#EF4444]/10 text-[#DC2626] border border-[#EF4444]/25',
  };

  return (
    <span className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}>
      {icon}
      {children}
    </span>
  );
};

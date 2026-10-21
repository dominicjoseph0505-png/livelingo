import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'elevated' | 'flat' | 'muted';
  className?: string;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'elevated',
  hoverable = false,
  className = '',
  ...props
}) => {
  const baseStyles = 'rounded-2xl transition-all duration-200 border';

  const variantStyles = {
    elevated: 'bg-white border-[#E5E2D9] shadow-[0_4px_20px_-2px_rgba(32,36,44,0.05)]',
    flat: 'bg-white border-[#E5E2D9]',
    muted: 'bg-[#F2EFE8] border-[#E5E2D9]/70',
  };

  const hoverStyles = hoverable ? 'hover:border-[#D5D1C6] hover:shadow-[0_8px_30px_-4px_rgba(32,36,44,0.08)]' : '';

  return (
    <div className={`${baseStyles} ${variantStyles[variant]} ${hoverStyles} ${className}`} {...props}>
      {children}
    </div>
  );
};

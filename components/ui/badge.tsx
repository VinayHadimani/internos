"import * as React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors';
    
    const variants = {
      default: 'bg-blue-600 text-white border-transparent',
      secondary: 'bg-gray-800 text-gray-300 border-gray-700',
      outline: 'bg-transparent text-gray-400 border-gray-700',
      destructive: 'bg-red-600 text-white border-transparent',
    };

    return (
      <div
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${className || ''}`}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
"
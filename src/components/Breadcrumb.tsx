'use client';
import Link from 'next/link';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  isCurrent?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
  customStyle?: React.CSSProperties;
}

export default function Breadcrumb({ items, className = '', customStyle }: BreadcrumbProps) {
  return (
    <nav 
      className={`breadcrumb ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        fontSize: '0.875rem',
        color: 'var(--color-text-secondary)',
        marginBottom: '0.5rem',
        ...customStyle
      }}
    >
      {items.map((item, index) => (
        <div key={index} style={{ display: 'flex', alignItems: 'center' }}>
          {index > 0 && (
            <span style={{ 
              margin: '0 0.5rem', 
              color: customStyle?.color === 'white' ? 'rgba(255,255,255,0.6)' : 'var(--color-border)' 
            }}>
              /
            </span>
          )}
          
          {item.href && !item.isCurrent ? (
            <Link
              href={item.href}
              className="text-accent"
              style={{
                textDecoration: 'none',
                color: customStyle?.color === 'white' ? 'rgba(255,255,255,0.8)' : 'var(--color-accent)',
                transition: 'color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = customStyle?.color === 'white' ? 'white' : 'var(--color-accent-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = customStyle?.color === 'white' ? 'rgba(255,255,255,0.8)' : 'var(--color-accent)';
              }}
            >
              {item.label}
            </Link>
          ) : (
            <span style={{ 
              color: customStyle?.color === 'white' 
                ? (item.isCurrent ? 'white' : 'rgba(255,255,255,0.8)')
                : (item.isCurrent ? 'var(--color-text)' : 'var(--color-text-secondary)'),
              fontWeight: item.isCurrent ? '500' : 'normal'
            }}>
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}

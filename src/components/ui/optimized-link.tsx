'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startTransition, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  prefetch?: boolean | 'intent' | 'render';
  priority?: boolean;
  shallow?: boolean;
  replace?: boolean;
  onClick?: () => void;
  preload?: boolean;
  [key: string]: any;
}

/**
 * Optimized Link component with enhanced prefetching and performance
 * Based on modern routing performance best practices
 */
export function OptimizedLink({
  href,
  children,
  className,
  prefetch = 'intent', // More aggressive prefetching
  priority = false,
  shallow = false,
  replace = false,
  onClick,
  preload = true,
  ...props
}: OptimizedLinkProps) {
  const router = useRouter();

  // Optimized navigation handler with startTransition
  const handleNavigation = useCallback((e: React.MouseEvent) => {
    if (onClick) {
      onClick();
    }

    // For high-priority routes, use startTransition for smoother navigation
    if (priority) {
      e.preventDefault();
      startTransition(() => {
        if (replace) {
          router.replace(href);
        } else {
          router.push(href);
        }
      });
    }
  }, [onClick, priority, router, href, replace]);

  // Intent-based prefetching (prefetch on hover/focus)
  const handleMouseEnter = useCallback(() => {
    if (prefetch === 'intent' && preload) {
      router.prefetch(href);
    }
  }, [prefetch, preload, router, href]);

  const handleFocus = useCallback(() => {
    if (prefetch === 'intent' && preload) {
      router.prefetch(href);
    }
  }, [prefetch, preload, router, href]);

  // Determine prefetch strategy
  const shouldPrefetch = prefetch === 'render' || prefetch === true;

  return (
    <Link
      href={href}
      prefetch={shouldPrefetch}
      className={cn(className)}
      onClick={handleNavigation}
      onMouseEnter={handleMouseEnter}
      onFocus={handleFocus}
      {...props}
    >
      {children}
    </Link>
  );
}

/**
 * High-priority link for critical navigation paths
 */
export function PriorityLink(props: OptimizedLinkProps) {
  return <OptimizedLink {...props} priority={true} prefetch="render" />;
}

/**
 * Intent-based link for secondary navigation
 */
export function IntentLink(props: OptimizedLinkProps) {
  return <OptimizedLink {...props} prefetch="intent" />;
} 
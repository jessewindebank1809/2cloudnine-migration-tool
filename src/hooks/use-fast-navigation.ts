'use client';

import { useRouter } from 'next/navigation';
import { useCallback, startTransition } from 'react';

export function useFastNavigation() {
  const router = useRouter();

  const navigate = useCallback((href: string, options?: { replace?: boolean }) => {
    startTransition(() => {
      if (options?.replace) {
        router.replace(href);
      } else {
        router.push(href);
      }
    });
  }, [router]);

  const prefetch = useCallback((href: string) => {
    router.prefetch(href);
  }, [router]);

  return { navigate, prefetch };
} 
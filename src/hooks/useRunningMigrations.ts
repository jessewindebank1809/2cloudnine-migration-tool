import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

export function useRunningMigrations(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const wasRunningRef = useRef(false);
  
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['running-migrations-check'],
    queryFn: async () => {
      const response = await fetch('/api/migrations');
      if (!response.ok) {
        throw new Error('Failed to fetch migration projects');
      }
      const data = await response.json();
      
      // Check if any project has a RUNNING status
      const hasRunningMigration = data.projects?.some((project: any) => 
        project.status === 'RUNNING'
      ) || false;
      
      return { hasRunningMigration };
    },
    refetchInterval: (query) => {
      const hasRunning = query.state.data?.hasRunningMigration;
      // If a migration just completed, use faster polling for a short period
      if (wasRunningRef.current && !hasRunning) {
        // Migration just completed - poll faster for 30 seconds
        setTimeout(() => {
          wasRunningRef.current = false;
        }, 30000);
        return 3000; // 3s for quick UI updates after completion
      }
      return hasRunning ? 10000 : 15000; // 10s if running, 15s if not
    },
    enabled: options?.enabled !== false,
  });

  // Track when migration status changes from running to not running
  useEffect(() => {
    if (data?.hasRunningMigration !== undefined) {
      if (wasRunningRef.current && !data.hasRunningMigration) {
        // Migration just completed - invalidate related queries
        queryClient.invalidateQueries({ queryKey: ['migrations'] });
      }
      wasRunningRef.current = data.hasRunningMigration;
    }
  }, [data?.hasRunningMigration, queryClient]);

  return {
    hasRunningMigration: data?.hasRunningMigration || false,
    isLoading,
    refetch,
  };
} 
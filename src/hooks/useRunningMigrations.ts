import { useQuery } from '@tanstack/react-query';

export function useRunningMigrations(options?: { enabled?: boolean }) {
  const { data, isLoading } = useQuery({
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
      // Only poll frequently if there's actually a running migration
      const hasRunning = query.state.data?.hasRunningMigration;
      return hasRunning ? 10000 : 30000; // 10s if running, 30s if not
    },
    enabled: options?.enabled !== false,
  });

  return {
    hasRunningMigration: data?.hasRunningMigration || false,
    isLoading,
  };
} 
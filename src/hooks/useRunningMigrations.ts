import { useQuery } from '@tanstack/react-query';

export function useRunningMigrations() {
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
    refetchInterval: 2000, // Check every 2 seconds
  });

  return {
    hasRunningMigration: data?.hasRunningMigration || false,
    isLoading,
  };
} 
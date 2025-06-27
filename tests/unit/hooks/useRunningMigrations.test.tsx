import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRunningMigrations } from '@/hooks/useRunningMigrations';
import React from 'react';

// Mock fetch
global.fetch = jest.fn();

describe('useRunningMigrations Hook - Unit Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { 
          retry: false,
          refetchOnWindowFocus: false,
        },
      },
    });
    jest.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  it('should return false when no migrations are running', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ 
        projects: [
          { id: '1', status: 'COMPLETED' },
          { id: '2', status: 'FAILED' }
        ] 
      }),
    });

    const { result } = renderHook(() => useRunningMigrations(), { wrapper });

    await waitFor(() => {
      expect(result.current.hasRunningMigration).toBe(false);
    });
  });

  it('should return true when at least one migration is running', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ 
        projects: [
          { id: '1', status: 'COMPLETED' },
          { id: '2', status: 'RUNNING' },
          { id: '3', status: 'FAILED' }
        ] 
      }),
    });

    const { result } = renderHook(() => useRunningMigrations(), { wrapper });

    await waitFor(() => {
      expect(result.current.hasRunningMigration).toBe(true);
    });
  });

  it('should handle empty migrations array', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ projects: [] }),
    });

    const { result } = renderHook(() => useRunningMigrations(), { wrapper });

    await waitFor(() => {
      expect(result.current.hasRunningMigration).toBe(false);
    });
  });

  it('should handle API errors gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useRunningMigrations(), { wrapper });

    await waitFor(() => {
      expect(result.current.hasRunningMigration).toBe(false);
    });
  });
});
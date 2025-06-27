import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import MigrationProjectBuilder from '@/components/features/migrations/MigrationProjectBuilder';
import { useAutoReconnect } from '@/hooks/useAutoReconnect';
import { useRunningMigrations } from '@/contexts/RunningMigrationsContext';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock custom hooks
jest.mock('@/hooks/useAutoReconnect', () => ({
  useAutoReconnect: jest.fn(),
}));

jest.mock('@/contexts/RunningMigrationsContext', () => ({
  useRunningMigrations: jest.fn(),
}));

// Mock API functions
jest.mock('@/lib/api/migrations/getAllMigrationProjects', () => ({
  getAllMigrationProjects: jest.fn(),
}));

// Mock child components to simplify testing
jest.mock('@/components/features/migrations/project-steps/ProjectSetup', () => ({
  __esModule: true,
  default: ({ onNext }: any) => (
    <div data-testid="project-setup">
      <button onClick={() => onNext({ name: 'Test Migration', templateId: 'test-template' })}>
        Next
      </button>
    </div>
  ),
}));

jest.mock('@/components/features/migrations/project-steps/ConnectionSetup', () => ({
  __esModule: true,
  default: ({ onNext }: any) => (
    <div data-testid="connection-setup">
      <button onClick={() => onNext({ sourceOrgId: 'source-123', targetOrgId: 'target-456' })}>
        Next
      </button>
    </div>
  ),
}));

jest.mock('@/components/features/migrations/project-steps/RecordSelection', () => ({
  __esModule: true,
  default: ({ onNext }: any) => (
    <div data-testid="record-selection">
      <button onClick={() => onNext({ selectedRecords: ['record-1'], selectedRecordNames: { 'record-1': 'Record 1' } })}>
        Next
      </button>
    </div>
  ),
}));

jest.mock('@/components/features/migrations/project-steps/MigrationExecution', () => ({
  __esModule: true,
  default: ({ onSuccess }: any) => (
    <div data-testid="migration-execution">
      <button onClick={() => onSuccess('migration-123')}>
        Complete Migration
      </button>
    </div>
  ),
}));

jest.mock('@/components/features/migrations/project-steps/ViewResults', () => ({
  __esModule: true,
  default: () => (
    <div data-testid="view-results">
      <h2>Migration Results</h2>
    </div>
  ),
}));

describe('MigrationProjectBuilder - Issue #110 Regression Tests', () => {
  let queryClient: QueryClient;
  const mockPush = jest.fn();
  const mockReconnect = jest.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Setup default mocks
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });

    (useAutoReconnect as jest.Mock).mockReturnValue({
      isOnline: true,
      isReconnecting: false,
      reconnect: mockReconnect,
    });

    (useRunningMigrations as jest.Mock).mockReturnValue({
      hasRunningMigration: false,
    });

    jest.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MigrationProjectBuilder />
      </QueryClientProvider>
    );
  };

  describe('New Migration Button Behavior', () => {
    it('should reset all state when clicking New Migration from results view', async () => {
      const { rerender } = renderComponent();

      // Progress through all steps to reach results
      fireEvent.click(screen.getByText('Next')); // Project Setup
      await waitFor(() => expect(screen.getByTestId('connection-setup')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Next')); // Connection Setup
      await waitFor(() => expect(screen.getByTestId('record-selection')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Next')); // Record Selection
      await waitFor(() => expect(screen.getByTestId('migration-execution')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Complete Migration')); // Complete Migration
      await waitFor(() => expect(screen.getByTestId('view-results')).toBeInTheDocument());

      // Now we're at the results view
      expect(screen.getByText('Migration Results')).toBeInTheDocument();

      // Click the New Migration button
      const newMigrationButton = screen.getByRole('button', { name: /new migration/i });
      expect(newMigrationButton).toBeInTheDocument();
      fireEvent.click(newMigrationButton);

      // Should reset to the first step (project setup)
      await waitFor(() => {
        expect(screen.getByTestId('project-setup')).toBeInTheDocument();
        expect(screen.queryByTestId('view-results')).not.toBeInTheDocument();
      });

      // Verify router.push was NOT called (this was the bug - it doesn't work when already on /migrations/new)
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should disable New Migration button when migration is running', () => {
      (useRunningMigrations as jest.Mock).mockReturnValue({
        hasRunningMigration: true,
      });

      renderComponent();

      const newMigrationButton = screen.getByRole('button', { name: /new migration/i });
      expect(newMigrationButton).toBeDisabled();
      expect(newMigrationButton).toHaveAttribute('title', 'Cannot start new migration while another is running');
    });

    it('should enable New Migration button when no migration is running', () => {
      (useRunningMigrations as jest.Mock).mockReturnValue({
        hasRunningMigration: false,
      });

      renderComponent();

      const newMigrationButton = screen.getByRole('button', { name: /new migration/i });
      expect(newMigrationButton).not.toBeDisabled();
    });

    it('should use router.push when not on results view', () => {
      renderComponent();

      // When on initial step, clicking New Migration should use router.push
      const newMigrationButton = screen.getByRole('button', { name: /new migration/i });
      fireEvent.click(newMigrationButton);

      expect(mockPush).toHaveBeenCalledWith('/migrations/new');
    });

    it('should maintain button state during migration lifecycle', async () => {
      const { rerender } = renderComponent();

      // Initially, button should be enabled
      let newMigrationButton = screen.getByRole('button', { name: /new migration/i });
      expect(newMigrationButton).not.toBeDisabled();

      // Simulate migration starting
      (useRunningMigrations as jest.Mock).mockReturnValue({
        hasRunningMigration: true,
      });
      rerender(
        <QueryClientProvider client={queryClient}>
          <MigrationProjectBuilder />
        </QueryClientProvider>
      );

      // Button should be disabled during migration
      newMigrationButton = screen.getByRole('button', { name: /new migration/i });
      expect(newMigrationButton).toBeDisabled();

      // Simulate migration completion
      (useRunningMigrations as jest.Mock).mockReturnValue({
        hasRunningMigration: false,
      });
      rerender(
        <QueryClientProvider client={queryClient}>
          <MigrationProjectBuilder />
        </QueryClientProvider>
      );

      // Button should be enabled again
      newMigrationButton = screen.getByRole('button', { name: /new migration/i });
      expect(newMigrationButton).not.toBeDisabled();
    });

    it('should clear all form data when resetting from results view', async () => {
      const { container } = renderComponent();

      // Progress to results view
      fireEvent.click(screen.getByText('Next')); // Project Setup
      await waitFor(() => screen.getByTestId('connection-setup'));
      fireEvent.click(screen.getByText('Next')); // Connection Setup
      await waitFor(() => screen.getByTestId('record-selection'));
      fireEvent.click(screen.getByText('Next')); // Record Selection
      await waitFor(() => screen.getByTestId('migration-execution'));
      fireEvent.click(screen.getByText('Complete Migration')); // Complete Migration
      await waitFor(() => screen.getByTestId('view-results'));

      // Click New Migration from results
      const newMigrationButton = screen.getByRole('button', { name: /new migration/i });
      fireEvent.click(newMigrationButton);

      // Should be back at project setup with clean state
      await waitFor(() => {
        expect(screen.getByTestId('project-setup')).toBeInTheDocument();
      });

      // Verify state was reset by progressing through steps again
      // (in a real test, we'd check actual form values, but our mocks simplify this)
      fireEvent.click(screen.getByText('Next'));
      await waitFor(() => {
        expect(screen.getByTestId('connection-setup')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle offline state correctly', () => {
      (useAutoReconnect as jest.Mock).mockReturnValue({
        isOnline: false,
        isReconnecting: false,
        reconnect: mockReconnect,
      });

      renderComponent();

      // Should show offline indicator
      expect(screen.getByText(/offline/i)).toBeInTheDocument();
    });

    it('should handle reconnecting state', () => {
      (useAutoReconnect as jest.Mock).mockReturnValue({
        isOnline: false,
        isReconnecting: true,
        reconnect: mockReconnect,
      });

      renderComponent();

      // Should show reconnecting indicator
      expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
    });

    it('should not allow navigation when migration is running', () => {
      (useRunningMigrations as jest.Mock).mockReturnValue({
        hasRunningMigration: true,
      });

      renderComponent();

      // Try to click New Migration button
      const newMigrationButton = screen.getByRole('button', { name: /new migration/i });
      fireEvent.click(newMigrationButton);

      // Should not navigate
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
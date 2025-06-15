import { UsageMonitoringDashboard } from '@/components/features/usage-monitoring/UsageMonitoringDashboard';

export default function UsageSimplePage() {
  // Temporary simple version without auth checks for debugging
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4 p-4 bg-yellow-100 border border-yellow-400 rounded">
        <p className="text-yellow-800">
          🚧 <strong>Debug Version:</strong> This is a temporary usage page without auth checks.
          <br />
          Use this to test the dashboard while we fix the authentication issue.
        </p>
      </div>
      <UsageMonitoringDashboard isAdmin={true} />
    </div>
  );
}
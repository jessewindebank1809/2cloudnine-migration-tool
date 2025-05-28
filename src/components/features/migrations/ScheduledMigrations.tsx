'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Calendar, 
  Clock, 
  Play, 
  Pause, 
  Trash2, 
  Plus,
  CheckCircle,
  XCircle,
  AlertCircle,
  Settings
} from 'lucide-react';

interface ScheduledMigration {
  id: string;
  name: string;
  description?: string;
  cronExpression: string;
  timezone: string;
  status: string;
  isActive: boolean;
  nextRunAt?: string;
  lastRunAt?: string;
  lastRunStatus?: string;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  project: {
    id: string;
    name: string;
    sourceOrg: string;
    targetOrg: string;
  };
  createdAt: string;
}

interface MigrationProject {
  id: string;
  name: string;
  sourceOrg: string;
  targetOrg: string;
}

export function ScheduledMigrations() {
  const [scheduledMigrations, setScheduledMigrations] = useState<ScheduledMigration[]>([]);
  const [projects, setProjects] = useState<MigrationProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    projectId: '',
    cronExpression: '0 2 * * *', // Default: daily at 2 AM
    timezone: 'UTC',
    isActive: true
  });

  useEffect(() => {
    fetchScheduledMigrations();
    fetchProjects();
  }, []);

  const fetchScheduledMigrations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/migrations/scheduled');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch scheduled migrations');
      }

      setScheduledMigrations(data.scheduledMigrations);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/migrations');
      const data = await response.json();

      if (response.ok) {
        const formattedProjects = data.projects.map((project: any) => ({
          id: project.id,
          name: project.name,
          sourceOrg: project.sourceOrg?.name || 'Unknown',
          targetOrg: project.targetOrg?.name || 'Unknown'
        }));
        setProjects(formattedProjects);
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    }
  };

  const handleCreateScheduled = async () => {
    try {
      setCreating(true);
      const response = await fetch('/api/migrations/scheduled', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create scheduled migration');
      }

      setShowCreateDialog(false);
      setFormData({
        name: '',
        description: '',
        projectId: '',
        cronExpression: '0 2 * * *',
        timezone: 'UTC',
        isActive: true
      });
      fetchScheduledMigrations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCreating(false);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'success';
      case 'PAUSED': return 'warning';
      case 'DISABLED': return 'pending';
      case 'ERROR': return 'error';
      default: return 'pending';
    }
  };

  const getLastRunStatusColor = (status?: string) => {
    switch (status) {
      case 'COMPLETED': return 'text-green-600';
      case 'FAILED': return 'text-red-600';
      case 'RUNNING': return 'text-blue-600';
      default: return 'text-grey-600';
    }
  };

  const formatCronExpression = (cron: string) => {
    // Simple cron expression formatter
    const parts = cron.split(' ');
    if (parts.length !== 5) return cron;

    const [minute, hour, day, month, weekday] = parts;
    
    if (minute === '0' && hour !== '*' && day === '*' && month === '*' && weekday === '*') {
      return `Daily at ${hour}:00`;
    }
    if (minute === '0' && hour !== '*' && day === '*' && month === '*' && weekday !== '*') {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return `Weekly on ${days[parseInt(weekday)]} at ${hour}:00`;
    }
    return cron;
  };

  const formatNextRun = (nextRunAt?: string) => {
    if (!nextRunAt) return 'Not scheduled';
    const date = new Date(nextRunAt);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 24) {
      return `In ${diffHours} hours`;
    }
    const diffDays = Math.round(diffHours / 24);
    return `In ${diffDays} days`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Scheduled Migrations</h2>
          <div className="w-32 h-10 bg-grey-200 animate-pulse rounded"></div>
        </div>
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <div className="w-48 h-6 bg-grey-200 animate-pulse rounded"></div>
                  <div className="w-32 h-4 bg-grey-200 animate-pulse rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Scheduled Migrations</h2>
          <p className="text-grey-600">Automate your migration workflows</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Schedule Migration
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Schedule New Migration</DialogTitle>
              <DialogDescription>
                Create a recurring migration schedule
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Weekly payroll sync"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Sync interpretation rules every week"
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="project">Migration Project</Label>
                <Select value={formData.projectId} onValueChange={(value) => setFormData({ ...formData, projectId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name} ({project.sourceOrg} → {project.targetOrg})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="cron">Schedule (Cron Expression)</Label>
                <Input
                  id="cron"
                  value={formData.cronExpression}
                  onChange={(e) => setFormData({ ...formData, cronExpression: e.target.value })}
                  placeholder="0 2 * * *"
                />
                <p className="text-xs text-grey-600 mt-1">
                  Format: minute hour day month weekday (e.g., &quot;0 2 * * *&quot; = daily at 2 AM)
                </p>
              </div>
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Select value={formData.timezone} onValueChange={(value) => setFormData({ ...formData, timezone: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">Eastern Time</SelectItem>
                    <SelectItem value="America/Chicago">Central Time</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                    <SelectItem value="Europe/London">London</SelectItem>
                    <SelectItem value="Europe/Paris">Paris</SelectItem>
                    <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateScheduled} disabled={creating || !formData.name || !formData.projectId}>
                  {creating ? 'Creating...' : 'Create Schedule'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scheduled Migrations List */}
      <div className="grid gap-4">
        {scheduledMigrations.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Calendar className="h-12 w-12 mx-auto text-grey-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">No scheduled migrations</h3>
              <p className="text-grey-600 mb-4">
                Create your first scheduled migration to automate your workflows
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Schedule Migration
              </Button>
            </CardContent>
          </Card>
        ) : (
          scheduledMigrations.map((scheduled) => (
            <Card key={scheduled.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-medium">{scheduled.name}</h3>
                      <Badge variant={getStatusVariant(scheduled.status) as any}>
                        {scheduled.status}
                      </Badge>
                      {!scheduled.isActive && (
                        <Badge variant="pending">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    
                    {scheduled.description && (
                      <p className="text-grey-600 mb-3">{scheduled.description}</p>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm font-medium text-grey-600">Project</p>
                        <p className="text-sm">{scheduled.project.name}</p>
                        <p className="text-xs text-grey-500">
                          {scheduled.project.sourceOrg} → {scheduled.project.targetOrg}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-grey-600">Schedule</p>
                        <p className="text-sm">{formatCronExpression(scheduled.cronExpression)}</p>
                        <p className="text-xs text-grey-500">{scheduled.timezone}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-grey-600">Next Run</p>
                        <p className="text-sm">{formatNextRun(scheduled.nextRunAt)}</p>
                        {scheduled.nextRunAt && (
                          <p className="text-xs text-grey-500">
                            {new Date(scheduled.nextRunAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-grey-600">Success Rate</p>
                        <p className="text-sm">
                          {scheduled.totalRuns > 0 
                            ? `${Math.round((scheduled.successfulRuns / scheduled.totalRuns) * 100)}%`
                            : 'No runs yet'
                          }
                        </p>
                        <p className="text-xs text-grey-500">
                          {scheduled.successfulRuns}/{scheduled.totalRuns} successful
                        </p>
                      </div>
                    </div>

                    {scheduled.lastRunAt && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-grey-600">Last run:</span>
                        <span className={getLastRunStatusColor(scheduled.lastRunStatus)}>
                          {scheduled.lastRunStatus}
                        </span>
                        <span className="text-grey-500">
                          {new Date(scheduled.lastRunAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      {scheduled.isActive ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
} 
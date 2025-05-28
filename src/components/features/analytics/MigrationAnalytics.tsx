'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Activity,
  Calendar,
  Database,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

interface MigrationAnalytics {
  overview: {
    totalMigrations: number;
    completedMigrations: number;
    failedMigrations: number;
    successRate: number;
    totalRecordsProcessed: number;
    totalRecordsSuccessful: number;
    recordSuccessRate: number;
    averageDuration: number;
  };
  trends: {
    daily: Array<{
      date: string;
      total: number;
      completed: number;
      failed: number;
      recordsProcessed: number;
      recordsSuccessful: number;
    }>;
    objectTypes: Array<{
      objectType: string;
      total: number;
      completed: number;
      failed: number;
      recordsProcessed: number;
      recordsSuccessful: number;
    }>;
  };
  recentActivity: Array<{
    id: string;
    projectName: string;
    objectType: string;
    status: string;
    recordsProcessed: number;
    recordsSuccessful: number;
    sourceOrg: string;
    targetOrg: string;
    createdAt: string;
    completedAt: string | null;
    duration: number | null;
  }>;
}

interface MigrationAnalyticsProps {
  orgId?: string;
}

export function MigrationAnalytics({ orgId }: MigrationAnalyticsProps) {
  const [analytics, setAnalytics] = useState<MigrationAnalytics | null>(null);
  const [timeRange, setTimeRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange, orgId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('timeRange', timeRange);
      if (orgId) params.set('orgId', orgId);

      const response = await fetch(`/api/analytics/migrations?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch analytics');
      }

      setAnalytics(data.analytics);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'completed';
      case 'FAILED': return 'failed';
      case 'RUNNING': return 'running';
      case 'PENDING': return 'pending';
      default: return 'pending';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Migration Analytics</h2>
          <div className="w-32 h-10 bg-grey-200 animate-pulse rounded"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <div className="w-24 h-4 bg-grey-200 animate-pulse rounded"></div>
                  <div className="w-16 h-8 bg-grey-200 animate-pulse rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Migration Analytics</h2>
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              <XCircle className="h-12 w-12 mx-auto mb-4" />
              <p className="text-lg font-medium">Failed to load analytics</p>
              <p className="text-sm text-grey-600 mt-2">{error}</p>
              <Button onClick={fetchAnalytics} className="mt-4">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Migration Analytics</h2>
          <p className="text-grey-600">Performance metrics and insights</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="1y">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-grey-600">Total Migrations</p>
                <p className="text-2xl font-bold">{analytics.overview.totalMigrations}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-grey-600">Success Rate</p>
                <p className="text-2xl font-bold">{analytics.overview.successRate}%</p>
                <div className="flex items-center mt-2">
                  {analytics.overview.successRate >= 90 ? (
                    <ArrowUpRight className="h-4 w-4 text-green-600" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-red-600" />
                  )}
                  <span className={`text-sm ml-1 ${analytics.overview.successRate >= 90 ? 'text-green-600' : 'text-red-600'}`}>
                    {analytics.overview.completedMigrations}/{analytics.overview.totalMigrations}
                  </span>
                </div>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-grey-600">Records Processed</p>
                <p className="text-2xl font-bold">{formatNumber(analytics.overview.totalRecordsProcessed)}</p>
                <p className="text-sm text-grey-600 mt-1">
                  {analytics.overview.recordSuccessRate}% success rate
                </p>
              </div>
              <Database className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-grey-600">Avg Duration</p>
                <p className="text-2xl font-bold">{formatDuration(analytics.overview.averageDuration)}</p>
                <p className="text-sm text-grey-600 mt-1">Per migration</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Object Types Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performance by Object Type
            </CardTitle>
            <CardDescription>
              Migration success rates across different object types
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.trends.objectTypes.slice(0, 5).map((objectType) => {
                const successRate = objectType.total > 0 ? (objectType.completed / objectType.total) * 100 : 0;
                return (
                  <div key={objectType.objectType} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{objectType.objectType}</span>
                      <span className="text-sm text-grey-600">
                        {objectType.completed}/{objectType.total} ({Math.round(successRate)}%)
                      </span>
                    </div>
                    <Progress value={successRate} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Latest migration executions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.recentActivity.slice(0, 5).map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{activity.projectName}</span>
                      <Badge variant={getStatusVariant(activity.status) as any}>
                        {activity.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-grey-600 mt-1">
                      {activity.objectType} • {activity.recordsProcessed} records
                      {activity.duration && ` • ${formatDuration(activity.duration / 1000)}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-grey-600">
                      {new Date(activity.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Daily Migration Trends
          </CardTitle>
          <CardDescription>
            Migration activity over the selected time period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.trends.daily.slice(-7).map((day) => {
              const successRate = day.total > 0 ? (day.completed / day.total) * 100 : 0;
              return (
                <div key={day.date} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <span className="font-medium text-sm w-20">
                      {new Date(day.date).toLocaleDateString('en-GB', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-grey-600">{day.total} migrations</span>
                      <Badge variant={successRate >= 90 ? 'success' : 'warning'}>
                        {Math.round(successRate)}% success
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatNumber(day.recordsProcessed)} records</p>
                    <p className="text-xs text-grey-600">{day.completed} completed, {day.failed} failed</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 
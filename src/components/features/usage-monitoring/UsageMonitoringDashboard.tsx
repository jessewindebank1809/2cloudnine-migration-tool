'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Users, 
  Activity, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  XCircle,
  BarChart3,
  RefreshCw,
  Download
} from 'lucide-react';

interface UsageSummary {
  totalMigrations: number;
  successfulMigrations: number;
  failedMigrations: number;
  totalRecordsProcessed: number;
  averageMigrationDuration: number;
  mostUsedFeatures: Array<{ feature: string; count: number }>;
}

interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  totalMigrations: number;
  totalRecordsProcessed: number;
  averageSuccessRate: number;
  topFeatures: Array<{ feature: string; count: number }>;
}

interface UsageMonitoringDashboardProps {
  isAdmin?: boolean;
}

export function UsageMonitoringDashboard({ isAdmin = false }: UsageMonitoringDashboardProps) {
  const [data, setData] = useState<UsageSummary | SystemStats | null>(null);
  const [timeRange, setTimeRange] = useState('30');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataType, setDataType] = useState<'user' | 'system'>('user');

  const fetchUsageData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('days', timeRange);
      if (isAdmin && dataType === 'system') {
        params.set('admin', 'true');
      }

      const response = await fetch(`/api/usage/summary?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch usage data');
      }

      setData(result.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [timeRange, isAdmin, dataType]);

  useEffect(() => {
    fetchUsageData();
  }, [fetchUsageData]);

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const isUserData = (data: any): data is UsageSummary => {
    return 'mostUsedFeatures' in data;
  };

  const isSystemData = (data: any): data is SystemStats => {
    return 'totalUsers' in data;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Usage Monitoring</h2>
          <div className="flex gap-2">
            <div className="w-32 h-10 bg-grey-200 animate-pulse rounded"></div>
            <div className="w-24 h-10 bg-grey-200 animate-pulse rounded"></div>
          </div>
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
        <h2 className="text-2xl font-bold">Usage Monitoring</h2>
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              <XCircle className="h-12 w-12 mx-auto mb-4" />
              <p className="text-lg font-medium">Failed to load usage data</p>
              <p className="text-sm text-grey-600 mt-2">{error}</p>
              <Button onClick={fetchUsageData} className="mt-4">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Usage Monitoring</h2>
          <p className="text-grey-600">
            {isAdmin && dataType === 'system' ? 'System-wide usage statistics' : 'Your usage statistics'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Select value={dataType} onValueChange={(value: 'user' | 'system') => setDataType(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Personal</SelectItem>
                <SelectItem value="system">System-wide</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchUsageData} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      {isUserData(data) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-grey-600">Total Migrations</p>
                  <p className="text-2xl font-bold">{data.totalMigrations}</p>
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
                  <p className="text-2xl font-bold">
                    {data.totalMigrations > 0 
                      ? Math.round((data.successfulMigrations / data.totalMigrations) * 100)
                      : 0}%
                  </p>
                  <p className="text-sm text-grey-600 mt-1">
                    {data.successfulMigrations} successful
                  </p>
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
                  <p className="text-2xl font-bold">{formatNumber(data.totalRecordsProcessed)}</p>
                </div>
                <Activity className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-grey-600">Avg Duration</p>
                  <p className="text-2xl font-bold">
                    {formatDuration(data.averageMigrationDuration)}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {isSystemData(data) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-grey-600">Total Users</p>
                  <p className="text-2xl font-bold">{data.totalUsers}</p>
                  <p className="text-sm text-grey-600 mt-1">
                    {data.activeUsers} active
                  </p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-grey-600">System Migrations</p>
                  <p className="text-2xl font-bold">{data.totalMigrations}</p>
                  <p className="text-sm text-grey-600 mt-1">
                    {Math.round(data.averageSuccessRate)}% success rate
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-grey-600">Records Processed</p>
                  <p className="text-2xl font-bold">{formatNumber(data.totalRecordsProcessed)}</p>
                </div>
                <Activity className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-grey-600">User Engagement</p>
                  <p className="text-2xl font-bold">
                    {Math.round((data.activeUsers / data.totalUsers) * 100)}%
                  </p>
                  <p className="text-sm text-grey-600 mt-1">
                    Active users
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Feature Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Most Used Features
            </CardTitle>
            <CardDescription>
              {isSystemData(data) ? 'Popular features across all users' : 'Your most used features'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(isUserData(data) ? data.mostUsedFeatures : data.topFeatures).slice(0, 5).map((feature, index) => (
                <div key={feature.feature} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{index + 1}</Badge>
                    <span className="font-medium">{feature.feature}</span>
                  </div>
                  <Badge>{feature.count} uses</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Export and manage usage data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                <Download className="h-4 w-4 mr-2" />
                Export Usage Report
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Data
              </Button>
              {isAdmin && (
                <Button variant="outline" className="w-full justify-start">
                  <Users className="h-4 w-4 mr-2" />
                  View User Details
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
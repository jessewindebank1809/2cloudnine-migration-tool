'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Clock, 
  Layers, 
  Shield, 
  CheckCircle, 
  AlertCircle,
  Info,
  ArrowRight,
  Database
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

interface TemplateMetadata {
  estimatedDuration: number;
  complexity: 'simple' | 'moderate' | 'complex';
  requiredPermissions: string[];
  author: string;
  supportedApiVersions: string[];
}

interface ETLStep {
  stepName: string;
  stepOrder: number;
  objectApiName: string;
  description: string;
  dependencies: string[];
}

interface MigrationTemplate {
  id: string;
  name: string;
  description: string;
  category: 'payroll' | 'time' | 'custom';
  version: string;
  metadata: TemplateMetadata;
  etlSteps: ETLStep[];
  stepCount: number;
  estimatedDuration: number;
  complexity: string;
  requiredPermissions: string[];
}

interface TemplatePreviewProps {
  templateId: string;
}

const COMPLEXITY_COLORS = {
  simple: 'bg-green-100 text-green-800 border-green-200',
  moderate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  complex: 'bg-red-100 text-red-800 border-red-200'
};

const CATEGORY_LABELS = {
  payroll: 'Payroll',
  time: 'Time Management',
  custom: 'Custom Objects'
};

export function TemplatePreview({ templateId }: TemplatePreviewProps) {
  const { data: templateData, isLoading, error } = useQuery({
    queryKey: ['template-details', templateId],
    queryFn: async () => {
      const response = await fetch(`/api/templates/${templateId}`);
      if (!response.ok) throw new Error('Failed to fetch template details');
      return response.json();
    },
    enabled: !!templateId,
  });

  const template: MigrationTemplate = templateData?.template;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load template details. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-2xl font-bold">{template.name}</h2>
          <Badge variant="secondary">
            {CATEGORY_LABELS[template.category] || template.category}
          </Badge>
          <Badge 
            className={COMPLEXITY_COLORS[template.complexity as keyof typeof COMPLEXITY_COLORS]}
            variant="outline"
          >
            {template.complexity}
          </Badge>
        </div>
        <p className="text-muted-foreground">{template.description}</p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Layers className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ETL Steps</p>
                <p className="text-2xl font-bold">{template.stepCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Est. Duration</p>
                <p className="text-2xl font-bold">~{template.estimatedDuration}min</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Permissions</p>
                <p className="text-2xl font-bold">{template.requiredPermissions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ETL Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Migration Steps
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {template.etlSteps.map((step, index) => (
            <div key={step.stepName}>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                  {step.stepOrder}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{step.stepName}</h4>
                    <Badge variant="outline" className="text-xs">
                      {step.objectApiName}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {step.description}
                  </p>
                  {step.dependencies.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Depends on:</span>
                      {step.dependencies.map((dep, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {dep}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {index < template.etlSteps.length - 1 && (
                <div className="flex justify-center my-3">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Requirements */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Required Permissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {template.requiredPermissions.map((permission, index) => (
                <div key={index} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-mono">{permission}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Template Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Version</span>
              <span className="text-sm font-medium">v{template.version}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Author</span>
              <span className="text-sm font-medium">{template.metadata.author}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">API Versions</span>
              <div className="flex gap-1">
                {template.metadata.supportedApiVersions.map((version, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {version}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Important Notes */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Before proceeding:</strong> Ensure you have the required permissions in both source and target organisations. 
          The migration will validate all dependencies before execution.
        </AlertDescription>
      </Alert>
    </div>
  );
}
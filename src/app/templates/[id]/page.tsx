'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  ArrowRight, 
  Clock, 
  Layers, 
  Shield, 
  CheckCircle,
  Database,
  Info,
  Play
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

interface TemplateDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

interface TemplateMetadata {
  estimatedDuration: number;
  complexity: 'simple' | 'moderate' | 'complex';
  requiredPermissions: string[];
  author: string;
  supportedApiVersions: string[];
}

interface TemplateStep {
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
  etlSteps: TemplateStep[];
  stepCount: number;
}

const CATEGORY_LABELS = {
  payroll: 'Payroll',
  time: 'Time Management',
  custom: 'Custom Objects'
};

const COMPLEXITY_COLORS = {
  simple: 'bg-green-100 text-green-800 border-green-200',
  moderate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  complex: 'bg-red-100 text-red-800 border-red-200'
};

export default function TemplateDetailPage({ params }: TemplateDetailPageProps) {
  const router = useRouter();
  
  // Unwrap the params promise
  const { id } = React.use(params);

  // Fetch template details with optimised caching
  const { data: templateData, isLoading, error } = useQuery({
    queryKey: ['template', id],
    queryFn: async () => {
      const response = await fetch(`/api/templates/${id}`);
      if (!response.ok) throw new Error('Failed to fetch template');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - templates don't change frequently
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
  });

  const template: MigrationTemplate = templateData?.template;

  const handleCreateMigration = () => {
    router.push(`/migrations/new?template=${id}`);
  };

  const handleBack = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="mb-6">
          <Skeleton className="h-10 w-32 mb-4" />
          <Skeleton className="h-8 w-96 mb-2" />
          <Skeleton className="h-6 w-64" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="container py-8">
        <Button variant="ghost" onClick={handleBack} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Templates
        </Button>
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load template details. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" onClick={handleBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Templates
        </Button>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-heading-xl text-foreground">{template.name}</h1>
              <Badge variant="outline">
                {CATEGORY_LABELS[template.category]}
              </Badge>
              <Badge 
                variant="outline" 
                className={COMPLEXITY_COLORS[template.metadata.complexity]}
              >
                {template.metadata.complexity}
              </Badge>
            </div>
            <p className="text-body-lg text-muted-foreground">
              {template.description}
            </p>
          </div>
          
          <Button 
            size="lg" 
            onClick={handleCreateMigration}
            className="bg-[#2491EB] hover:bg-[#2491EB]/90"
          >
            <Play className="h-4 w-4 mr-2" />
            Use This Template
          </Button>
        </div>
      </div>

      {/* Template Overview */}
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimated Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{template.metadata.estimatedDuration} min</div>
            <p className="text-xs text-muted-foreground">
              Typical migration time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Migration Steps</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{template.stepCount}</div>
            <p className="text-xs text-muted-foreground">
              Automated processing steps
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Template Version</CardTitle>
            <Info className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">v{template.version}</div>
            <p className="text-xs text-muted-foreground">
              Latest stable version
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Template Details */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        {/* Migration Steps */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Migration Steps
            </CardTitle>
            <CardDescription>
              Automated processing workflow for this template
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {template.etlSteps.map((step, index) => (
                <div key={index} className="flex gap-3">
                  <div className="w-8 h-8 bg-blue-100 text-[#2491EB] rounded-full flex items-center justify-center text-sm font-semibold">
                    {step.stepOrder}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{step.stepName}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {step.description}
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      <Database className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-mono text-muted-foreground">
                        {step.objectApiName}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Required Permissions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Required Permissions
            </CardTitle>
            <CardDescription>
              Salesforce permissions needed for this migration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {template.metadata.requiredPermissions.map((permission, index) => (
                <div key={index} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-mono">{permission}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Template Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Template Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Author</span>
                <span className="text-sm font-medium">{template.metadata.author}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Category</span>
                <span className="text-sm font-medium">{CATEGORY_LABELS[template.category]}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Complexity</span>
                <Badge 
                  variant="outline" 
                  className={COMPLEXITY_COLORS[template.metadata.complexity]}
                >
                  {template.metadata.complexity}
                </Badge>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Version</span>
                <span className="text-sm font-medium">v{template.version}</span>
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
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Field Mapping</span>
                <span className="text-sm font-medium text-green-600">Automatic</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Call to Action */}
      <div className="mt-8 text-center">
        <div className="max-w-2xl mx-auto">
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Ready to start your migration?
          </h3>
          <p className="text-muted-foreground mb-6">
            This template provides everything you need for a seamless migration. 
            All field mappings are handled automatically - just select your records and execute.
          </p>
          <Button 
            size="lg" 
            onClick={handleCreateMigration}
            className="bg-[#2491EB] hover:bg-[#2491EB]/90"
          >
            Create Migration with This Template
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
} 
'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  Filter, 
  Clock, 
  Layers, 
  ArrowRight,
  Database,
  Users,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TemplateMetadata {
  estimatedDuration: number;
  complexity: 'simple' | 'moderate' | 'complex';
  requiredPermissions: string[];
  author: string;
}

interface MigrationTemplate {
  id: string;
  name: string;
  description: string;
  category: 'payroll' | 'time' | 'custom';
  version: string;
  metadata: TemplateMetadata;
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

const CATEGORY_ICONS = {
  payroll: Database,
  time: Clock,
  custom: Layers
};

export default function TemplatesPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch available templates with optimised caching
  const { data: templatesData, isLoading, error } = useQuery({
    queryKey: ['templates', selectedCategory],
    queryFn: async () => {
      const url = selectedCategory === 'all' 
        ? '/api/templates'
        : `/api/templates?category=${selectedCategory}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - templates don't change frequently
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
  });

  const templates = templatesData?.templates || [];
  const categories = templatesData?.categories || [];

  // Filter templates based on search
  const filteredTemplates = templates.filter((template: MigrationTemplate) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      template.name.toLowerCase().includes(searchLower) ||
      template.description.toLowerCase().includes(searchLower)
    );
  });

  const handleCreateMigration = (templateId: string) => {
    router.push(`/migrations/new?template=${templateId}`);
  };

  const handleViewTemplate = (templateId: string) => {
    router.push(`/templates/${templateId}`);
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-heading-xl text-foreground mb-2">Migration Templates</h1>
          <p className="text-body-lg text-muted-foreground">
            Pre-configured templates for seamless 2cloudnine migrations
          </p>
        </div>
        <div className="flex gap-4 mb-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 flex-1" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-heading-xl text-foreground mb-2">Migration Templates</h1>
          <p className="text-body-lg text-muted-foreground">
            Pre-configured templates for seamless 2cloudnine migrations
          </p>
        </div>
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load migration templates. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-heading-xl text-foreground mb-2">Migration Templates</h1>
        <p className="text-body-lg text-muted-foreground">
          Pre-configured templates for seamless 2cloudnine migrations. Zero configuration required.
        </p>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category: string) => (
              <SelectItem key={category} value={category}>
                {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No templates found</h3>
          <p className="text-muted-foreground">
            {searchTerm ? 'Try adjusting your search terms.' : 'No templates available for the selected category.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template: MigrationTemplate) => {
            const CategoryIcon = CATEGORY_ICONS[template.category];
            
            return (
              <Card key={template.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <CategoryIcon className="h-5 w-5 text-[#2491EB]" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <Badge variant="outline" className="mt-1">
                          {CATEGORY_LABELS[template.category]}
                        </Badge>
                      </div>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={COMPLEXITY_COLORS[template.metadata.complexity]}
                    >
                      {template.metadata.complexity}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <CardDescription className="text-sm">
                    {template.description}
                  </CardDescription>
                  
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{template.metadata.estimatedDuration} min</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Layers className="h-4 w-4" />
                      <span>{template.stepCount} steps</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleViewTemplate(template.id)}
                      className="flex-1"
                    >
                      View Details
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => handleCreateMigration(template.id)}
                      className="flex-1 bg-[#2491EB] hover:bg-[#2491EB]/90"
                    >
                      Use Template
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Quick Stats */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates.length}</div>
            <p className="text-xs text-muted-foreground">
              Ready-to-use migration templates
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {templates.length > 0 
                ? Math.round(templates.reduce((sum: number, t: MigrationTemplate) => sum + t.metadata.estimatedDuration, 0) / templates.length)
                : 0
              } min
            </div>
            <p className="text-xs text-muted-foreground">
              Typical migration time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Zero Configuration</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">100%</div>
            <p className="text-xs text-muted-foreground">
              Invisible field mapping
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 
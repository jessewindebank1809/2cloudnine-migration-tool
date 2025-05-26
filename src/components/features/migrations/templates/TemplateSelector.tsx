'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, Users, Layers, ChevronRight, Filter, Search } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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

interface TemplateSelectorProps {
  onTemplateSelect: (template: MigrationTemplate) => void;
  selectedTemplateId?: string;
}

const CATEGORY_LABELS = {
  payroll: 'Payroll',
  time: 'Time Management',
  custom: 'Custom Objects'
};

const COMPLEXITY_COLORS = {
  simple: 'bg-green-100 text-green-800',
  moderate: 'bg-yellow-100 text-yellow-800',
  complex: 'bg-red-100 text-red-800'
};

export function TemplateSelector({ onTemplateSelect, selectedTemplateId }: TemplateSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch available templates
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 flex-1" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load migration templates. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Select Migration Template</h2>
        <p className="text-muted-foreground mt-1">
          Choose a pre-configured template to streamline your migration process
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category: string) => (
              <SelectItem key={category} value={category}>
                {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] || category}
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
            className="pl-9"
          />
        </div>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchTerm ? 'No templates match your search' : 'No templates available'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template: MigrationTemplate) => (
            <TemplateCard
              key={template.id}
              template={template}
              isSelected={template.id === selectedTemplateId}
              onSelect={() => onTemplateSelect(template)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({ 
  template, 
  isSelected, 
  onSelect 
}: { 
  template: MigrationTemplate; 
  isSelected: boolean; 
  onSelect: () => void; 
}) {
  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'border-primary bg-primary/5' : 'hover:border-gray-300'
      }`}
      onClick={onSelect}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{template.name}</CardTitle>
            <Badge variant="secondary" className="mt-1">
              {CATEGORY_LABELS[template.category] || template.category}
            </Badge>
          </div>
          <Badge 
            className={`ml-2 ${COMPLEXITY_COLORS[template.metadata.complexity]}`}
            variant="secondary"
          >
            {template.metadata.complexity}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {template.description}
        </p>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Layers className="h-3 w-3" />
            <span>{template.stepCount} steps</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>~{template.metadata.estimatedDuration}min</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            v{template.version}
          </span>
          <Button 
            size="sm" 
            variant={isSelected ? "default" : "outline"}
            className="h-8"
          >
            {isSelected ? 'Selected' : 'Select'}
            <ChevronRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 
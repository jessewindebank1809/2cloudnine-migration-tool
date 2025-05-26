'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ObjectSelection } from './ObjectSelection';

interface Organisation {
  id: string;
  name: string;
  orgType: 'PRODUCTION' | 'SANDBOX' | 'SCRATCH';
  instanceUrl: string;
  salesforceOrgId: string | null;
}

interface MigrationTemplate {
  id: string;
  name: string;
  description: string;
  category: 'payroll' | 'time' | 'custom';
  version: string;
}

type Step = 'project-info' | 'organisations' | 'record-selection' | 'review';

const STEPS: { id: Step; title: string; description: string }[] = [
  {
    id: 'project-info',
    title: 'Project Information',
    description: 'Name your migration project and select a template',
  },
  {
    id: 'organisations',
    title: 'Organisations',
    description: 'Select source and target organisations',
  },
  {
    id: 'record-selection',
    title: 'Record Selection',
    description: 'Choose which records to migrate',
  },
  {
    id: 'review',
    title: 'Review & Create',
    description: 'Review your configuration and create the project',
  },
];

export function MigrationProjectBuilder() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('project-info');
  const [projectData, setProjectData] = useState({
    name: '',
    templateId: '', // Will be set to interpretation rules template when templates load
    sourceOrgId: '',
    targetOrgId: '',
    selectedObjects: [] as string[],
  });

  // Fetch available organisations
  const { data: orgsData, isLoading: orgsLoading } = useQuery({
    queryKey: ['organisations'],
    queryFn: async () => {
      const response = await fetch('/api/organisations');
      if (!response.ok) throw new Error('Failed to fetch organisations');
      return response.json();
    },
  });

  // Fetch available templates
  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const response = await fetch('/api/templates');
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    },
  });

  // Set default template to interpretation rules when templates load
  React.useEffect(() => {
    if (templatesData?.templates && !projectData.templateId) {
      const interpretationRulesTemplate = templatesData.templates.find(
        (template: MigrationTemplate) => 
          template.name.toLowerCase().includes('interpretation') || 
          template.name.toLowerCase().includes('rules')
      );
      if (interpretationRulesTemplate) {
        setProjectData(prev => ({ ...prev, templateId: interpretationRulesTemplate.id }));
      } else if (templatesData.templates.length > 0) {
        // Fallback to first template if interpretation rules not found
        setProjectData(prev => ({ ...prev, templateId: templatesData.templates[0].id }));
      }
    }
  }, [templatesData, projectData.templateId]);

  // Create project mutation
  const createProject = useMutation({
    mutationFn: async (data: typeof projectData) => {
      // Transform the data to match the API schema
      const apiData = {
        name: data.name,
        sourceOrgId: data.sourceOrgId,
        targetOrgId: data.targetOrgId,
        templateId: data.templateId,
        selectedObjects: data.selectedObjects,
      };
      
      const response = await fetch('/api/migrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create project');
      }
      return response.json();
    },
    onSuccess: (data) => {
      router.push(`/migrations/${data.id}`);
    },
  });

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const canProceed = () => {
    switch (currentStep) {
      case 'project-info':
        return projectData.name.trim().length > 0 && projectData.templateId.length > 0;
      case 'organisations':
        return projectData.sourceOrgId.length > 0 && projectData.targetOrgId.length > 0 && projectData.targetOrgId !== projectData.sourceOrgId;
      case 'record-selection':
        return projectData.selectedObjects.length > 0;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const goToNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  };

  const goToPrevious = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  };

  const handleCreate = async () => {
    await createProject.mutateAsync(projectData);
  };

  const connectedOrgs = orgsData?.organisations?.filter(
    (org: Organisation) => org.salesforceOrgId !== null
  ) || [];

  const templates = templatesData?.templates || [];
  const selectedTemplate = templates.find((t: MigrationTemplate) => t.id === projectData.templateId);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress */}
      <div className="mb-8">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between mt-2">
          {STEPS.map((step, index) => (
            <div
              key={step.id}
              className={`text-xs ${
                index <= currentStepIndex ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              {step.title}
            </div>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[currentStepIndex].title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {STEPS[currentStepIndex].description}
          </p>
        </CardHeader>
        <CardContent>
          {/* Project Info Step */}
          {currentStep === 'project-info' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  value={projectData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setProjectData({ ...projectData, name: e.target.value })
                  }
                  placeholder="e.g., Q4 2024 Pay Code Migration"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="template">Migration Template</Label>
                <Select
                  value={projectData.templateId}
                  onValueChange={(value: string) =>
                    setProjectData({ ...projectData, templateId: value })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a migration template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templatesLoading ? (
                      <SelectItem value="loading" disabled>Loading templates...</SelectItem>
                    ) : (
                      templates.map((template: MigrationTemplate) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Organisations Step */}
          {currentStep === 'organisations' && (
            <div className="space-y-6">
              {orgsLoading ? (
                <div className="text-center py-8">Loading organisations...</div>
              ) : connectedOrgs.length < 2 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    At least two connected organisations are required to create a migration. Please connect more organisations first.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div>
                    <Label htmlFor="source-org">Source Organisation</Label>
                    <Select
                      value={projectData.sourceOrgId}
                      onValueChange={(value: string) =>
                        setProjectData({ ...projectData, sourceOrgId: value })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select source organisation" />
                      </SelectTrigger>
                      <SelectContent>
                        {connectedOrgs.map((org: Organisation) => (
                          <SelectItem key={org.id} value={org.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{org.name}</span>
                              <span className="text-xs text-muted-foreground">{org.instanceUrl}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="target-org">Target Organisation</Label>
                    <Select
                      value={projectData.targetOrgId}
                      onValueChange={(value: string) =>
                        setProjectData({ ...projectData, targetOrgId: value })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select target organisation" />
                      </SelectTrigger>
                      <SelectContent>
                        {connectedOrgs
                          .filter((org: Organisation) => org.id !== projectData.sourceOrgId)
                          .map((org: Organisation) => (
                            <SelectItem key={org.id} value={org.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{org.name}</span>
                                <span className="text-xs text-muted-foreground">{org.instanceUrl}</span>
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Record Selection Step */}
          {currentStep === 'record-selection' && (
            <div className="space-y-4">
              {projectData.sourceOrgId && projectData.targetOrgId ? (
                <ObjectSelection
                  sourceOrgId={projectData.sourceOrgId}
                  targetOrgId={projectData.targetOrgId}
                  templateId={projectData.templateId}
                  onSelectionChange={(selectedObjects: string[]) =>
                    setProjectData({ ...projectData, selectedObjects })
                  }
                />
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please select source and target organisations first.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Review Step */}
          {currentStep === 'review' && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-3">
                <div>
                  <div className="text-sm font-medium">Project Name</div>
                  <div className="text-sm text-muted-foreground">{projectData.name}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Migration Template</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedTemplate ? selectedTemplate.name : 'Loading...'}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium">Source Organisation</div>
                    <div className="text-sm text-muted-foreground">
                      {connectedOrgs.find((o: Organisation) => o.id === projectData.sourceOrgId)?.name}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Target Organisation</div>
                    <div className="text-sm text-muted-foreground">
                      {connectedOrgs.find((o: Organisation) => o.id === projectData.targetOrgId)?.name}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Selected Objects</div>
                  <div className="text-sm text-muted-foreground">
                    {projectData.selectedObjects.length > 0 
                      ? `${projectData.selectedObjects.length} objects selected`
                      : 'No objects selected'
                    }
                  </div>
                </div>
              </div>

              {createProject.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {createProject.error.message}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={goToPrevious}
            disabled={currentStepIndex === 0}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>
          
          {currentStep === 'review' ? (
            <Button
              onClick={handleCreate}
              disabled={createProject.isPending || !canProceed()}
            >
              {createProject.isPending ? (
                <>Creating...</>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Create Project
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={goToNext}
              disabled={!canProceed()}
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
} 
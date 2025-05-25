'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface Organisation {
  id: string;
  name: string;
  orgType: 'PRODUCTION' | 'SANDBOX' | 'SCRATCH';
  instanceUrl: string;
  salesforceOrgId: string | null;
}

type Step = 'project-info' | 'source-org' | 'target-org' | 'review';

const STEPS: { id: Step; title: string; description: string }[] = [
  {
    id: 'project-info',
    title: 'Project Information',
    description: 'Name and describe your migration project',
  },
  {
    id: 'source-org',
    title: 'Source Organisation',
    description: 'Select the org to migrate data from',
  },
  {
    id: 'target-org',
    title: 'Target Organisation',
    description: 'Select the org to migrate data to',
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
    description: '',
    sourceOrgId: '',
    targetOrgId: '',
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

  // Create project mutation
  const createProject = useMutation({
    mutationFn: async (data: typeof projectData) => {
      const response = await fetch('/api/migrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
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
        return projectData.name.trim().length > 0;
      case 'source-org':
        return projectData.sourceOrgId.length > 0;
      case 'target-org':
        return projectData.targetOrgId.length > 0 && projectData.targetOrgId !== projectData.sourceOrgId;
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
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={projectData.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setProjectData({ ...projectData, description: e.target.value })
                  }
                  placeholder="Describe the purpose and scope of this migration..."
                  className="mt-1"
                  rows={4}
                />
              </div>
            </div>
          )}

          {/* Source Org Step */}
          {currentStep === 'source-org' && (
            <div className="space-y-4">
              {orgsLoading ? (
                <div className="text-center py-8">Loading organisations...</div>
              ) : connectedOrgs.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No connected organisations found. Please connect at least two organisations before creating a migration.
                  </AlertDescription>
                </Alert>
              ) : (
                <RadioGroup
                  value={projectData.sourceOrgId}
                  onValueChange={(value: string) =>
                    setProjectData({ ...projectData, sourceOrgId: value })
                  }
                >
                  <div className="space-y-3">
                    {connectedOrgs.map((org: Organisation) => (
                      <label
                        key={org.id}
                        htmlFor={`source-${org.id}`}
                        className="flex items-center space-x-3 cursor-pointer"
                      >
                        <RadioGroupItem value={org.id} id={`source-${org.id}`} />
                        <Card className="flex-1 cursor-pointer hover:border-primary transition-colors">
                          <CardContent className="py-3">
                            <div className="font-medium">{org.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {org.instanceUrl}
                            </div>
                          </CardContent>
                        </Card>
                      </label>
                    ))}
                  </div>
                </RadioGroup>
              )}
            </div>
          )}

          {/* Target Org Step */}
          {currentStep === 'target-org' && (
            <div className="space-y-4">
              <RadioGroup
                value={projectData.targetOrgId}
                                 onValueChange={(value: string) =>
                   setProjectData({ ...projectData, targetOrgId: value })
                 }
              >
                <div className="space-y-3">
                  {connectedOrgs
                    .filter((org: Organisation) => org.id !== projectData.sourceOrgId)
                    .map((org: Organisation) => (
                      <label
                        key={org.id}
                        htmlFor={`target-${org.id}`}
                        className="flex items-center space-x-3 cursor-pointer"
                      >
                        <RadioGroupItem value={org.id} id={`target-${org.id}`} />
                        <Card className="flex-1 cursor-pointer hover:border-primary transition-colors">
                          <CardContent className="py-3">
                            <div className="font-medium">{org.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {org.instanceUrl}
                            </div>
                          </CardContent>
                        </Card>
                      </label>
                    ))}
                </div>
              </RadioGroup>
                              {connectedOrgs.filter((org: Organisation) => org.id !== projectData.sourceOrgId).length === 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No other organizations available. Please connect another organization to use as the target.
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
                {projectData.description && (
                  <div>
                    <div className="text-sm font-medium">Description</div>
                    <div className="text-sm text-muted-foreground">{projectData.description}</div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium">Source Organization</div>
                    <div className="text-sm text-muted-foreground">
                      {connectedOrgs.find((o: Organisation) => o.id === projectData.sourceOrgId)?.name}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Target Organization</div>
                    <div className="text-sm text-muted-foreground">
                      {connectedOrgs.find((o: Organisation) => o.id === projectData.targetOrgId)?.name}
                    </div>
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
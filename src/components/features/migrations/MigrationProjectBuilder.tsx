'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAutoReconnect } from '@/hooks/useAutoReconnect';
import { ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TemplateRecordSelection } from './TemplateRecordSelection';
import { DetailedMigrationResults } from './DetailedMigrationResults';

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

type Step = 'project-setup' | 'record-selection' | 'validation-review' | 'view-results';

const STEPS: { id: Step; title: string; description: string }[] = [
  {
    id: 'project-setup',
    title: 'Project Setup',
    description: 'Configure your migration project and select organisations',
  },
  {
    id: 'record-selection',
    title: 'Select Records',
    description: 'Choose which tc9_et__Interpretation_Rule__c records to migrate',
  },
  {
    id: 'validation-review',
    title: 'Validation Review',
    description: 'Review and resolve validation issues before migration',
  },
  {
    id: 'view-results',
    title: 'View Results',
    description: 'Review migration results and status',
  },
];

interface ValidationIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  recordId?: string;
  field?: string;
  suggestion?: string;
}

interface ValidationResult {
  isValid: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  issues: ValidationIssue[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
}

export function MigrationProjectBuilder() {
  const router = useRouter();
  const { apiCall } = useAutoReconnect();
  const [currentStep, setCurrentStep] = useState<Step>('project-setup');
  const [createdMigrationId, setCreatedMigrationId] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [currentOperation, setCurrentOperation] = useState<'idle' | 'validating' | 'creating' | 'migrating'>('idle');
  const [projectData, setProjectData] = useState({
    name: '',
    templateId: '', // Will be set to interpretation rules template when templates load
    sourceOrgId: '',
    targetOrgId: '',
    selectedRecords: [] as string[],
  });

  // Fetch available organisations
  const { data: orgsData, isLoading: orgsLoading } = useQuery({
    queryKey: ['organisations'],
    queryFn: async () => {
      const result = await apiCall<any>(() => fetch('/api/organisations'));
      if (!result) throw new Error('Failed to fetch organisations');
      return result;
    },
  });

  // Fetch available templates
  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const result = await apiCall<any>(() => fetch('/api/templates'));
      if (!result) throw new Error('Failed to fetch templates');
      return result;
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

  // Validation mutation
  const validateMigration = useMutation({
    mutationFn: async (data: typeof projectData) => {
      setCurrentOperation('validating');
      const response = await fetch('/api/migrations/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceOrgId: data.sourceOrgId,
          targetOrgId: data.targetOrgId,
          templateId: data.templateId,
          selectedRecords: data.selectedRecords,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Validation failed');
      }
      
      return response.json();
    },
    onSuccess: async (data) => {
      if (!data) return; // Skip if we redirected
      
      const validation = data.validation as ValidationResult;
      setValidationResult(validation);
      
      // If validation passes completely, skip to migration
      if (validation.isValid && !validation.hasWarnings) {
        try {
          // Don't change step here - createProject will handle moving to view-results
          await handleCreate();
        } catch (error) {
          console.error('Auto-migration after validation failed:', error);
          setCurrentOperation('idle');
        }
      } else {
        // Show validation review step
        setCurrentStep('validation-review');
        setCurrentOperation('idle');
      }
    },
    onError: () => {
      setCurrentOperation('idle');
    },
  });

  // Create project mutation
  const createProject = useMutation({
    mutationFn: async (data: typeof projectData) => {
      setCurrentOperation('creating');
      // Transform the data to match the API schema
      const apiData = {
        name: data.name,
        sourceOrgId: data.sourceOrgId,
        targetOrgId: data.targetOrgId,
        templateId: data.templateId,
        selectedRecords: data.selectedRecords,
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
    onSuccess: async (data) => {
      setCreatedMigrationId(data.id);
      // Move to view-results to show migration progress
      setCurrentStep('view-results');
      // Automatically execute the migration after project creation
      try {
        setCurrentOperation('migrating');
        await executeMigration.mutateAsync(data.id);
      } catch (error) {
        // Error will be handled by the executeMigration mutation's error handling
        console.error('Migration execution failed:', error);
        setCurrentOperation('idle');
      }
    },
    onError: () => {
      setCurrentStep('view-results'); // Show error details on the results page
      setCurrentOperation('idle');
    },
  });

  // Execute migration mutation
  const executeMigration = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await fetch(`/api/migrations/${projectId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // Template and records are read from project config
      });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        const error = new Error(responseData.error || 'Failed to execute migration');
        // Attach detailed error information for better debugging
        (error as any).details = responseData.details;
        (error as any).result = responseData.result;
        (error as any).sessionId = responseData.sessionId;
        (error as any).uniqueErrors = responseData.uniqueErrors;
        (error as any).recordResults = responseData.recordResults; // Add record results
        throw error;
      }
      
      // Check for warnings (partial migrations with significant errors)
      if (responseData.warning) {
        const warning = new Error(responseData.warning);
        (warning as any).isWarning = true;
        (warning as any).result = responseData.result;
        (warning as any).sessionId = responseData.sessionId;
        (warning as any).uniqueErrors = responseData.uniqueErrors;
        (warning as any).recordResults = responseData.recordResults; // Add record results
        throw warning;
      }
      
      return responseData;
    },
    onSuccess: (data) => {
      if (data) { // Only proceed if we didn't redirect
        setCurrentStep('view-results');
        setCurrentOperation('idle');
      }
    },
    onError: () => {
      setCurrentStep('view-results'); // Show error details on the results page
      setCurrentOperation('idle');
    },
  });

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const canProceed = () => {
    switch (currentStep) {
      case 'project-setup':
        return (
          projectData.name.trim().length > 0 && 
          projectData.sourceOrgId.length > 0 && 
          projectData.targetOrgId.length > 0 && 
          projectData.targetOrgId !== projectData.sourceOrgId &&
          projectData.templateId.length > 0 &&
          connectedOrgs.length >= 2
        );
      case 'record-selection':
        return projectData.selectedRecords.length > 0;
      case 'validation-review':
        return validationResult?.isValid || false;
      case 'view-results':
        return false; // No next step after results
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

  const handleValidate = () => {
    validateMigration.mutate(projectData);
  };

  const handleCreate = async () => {
    await createProject.mutateAsync(projectData);
  };

  const connectedOrgs = orgsData?.organisations?.filter(
    (org: Organisation) => org.salesforceOrgId !== null
  ) || [];

  const templates = templatesData?.templates || [];
  const selectedTemplate = templates.find((t: MigrationTemplate) => t.id === projectData.templateId);

  // Memoized callback to prevent infinite re-renders
  const handleRecordSelectionChange = useCallback((selectedRecords: string[]) => {
    setProjectData(prev => ({ ...prev, selectedRecords }));
  }, []);

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
          {/* Project Setup Step */}
          {currentStep === 'project-setup' && (
            <div className="space-y-8">
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
                    <Label htmlFor="name">Project Name *</Label>
                    <Input
                      id="name"
                      value={projectData.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setProjectData({ ...projectData, name: e.target.value })
                      }
                      placeholder="Enter project name"
                      className="mt-1"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-end">
                    <div>
                      <Label htmlFor="source-org">Source Organisation *</Label>
                      <Select
                        value={projectData.sourceOrgId}
                        onValueChange={(value: string) =>
                          setProjectData({ ...projectData, sourceOrgId: value })
                        }
                        required
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
                    <div className="flex justify-center pb-2">
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <Label htmlFor="target-org">Target Organisation *</Label>
                      <Select
                        value={projectData.targetOrgId}
                        onValueChange={(value: string) =>
                          setProjectData({ ...projectData, targetOrgId: value })
                        }
                        required
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
                  </div>
                  <div>
                    <Label htmlFor="template">Migration Template *</Label>
                    <Select
                      value={projectData.templateId}
                      onValueChange={(value: string) =>
                        setProjectData({ ...projectData, templateId: value })
                      }
                      required
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select a migration template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templatesLoading ? (
                          <SelectItem value="loading" disabled>Loading ...</SelectItem>
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
                </>
              )}
            </div>
          )}

          {/* Select Records Step */}
          {currentStep === 'record-selection' && (
            <div className="space-y-4">
              {projectData.sourceOrgId && projectData.templateId ? (
                <TemplateRecordSelection
                  sourceOrgId={projectData.sourceOrgId}
                  templateId={projectData.templateId}
                  onSelectionChange={handleRecordSelectionChange}
                  selectedRecords={projectData.selectedRecords}
                />
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please select source organisation and template first.
                  </AlertDescription>
                </Alert>
              )}

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

          {/* Validation Review Step */}
          {currentStep === 'validation-review' && (
            <div className="space-y-6">
              {validateMigration.isPending && (
                <Card className="border-blue-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                      Validating Migration
                    </CardTitle>
                    <CardDescription>
                      Checking data integrity and dependencies before migration
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span>Analysing source records...</span>
                        <div className="animate-pulse h-2 w-2 bg-blue-500 rounded-full"></div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Checking target organisation compatibility...</span>
                        <div className="animate-pulse h-2 w-2 bg-blue-500 rounded-full"></div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Validating field mappings...</span>
                        <div className="animate-pulse h-2 w-2 bg-blue-500 rounded-full"></div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Verifying relationships...</span>
                        <div className="animate-pulse h-2 w-2 bg-blue-500 rounded-full"></div>
                      </div>
                    </div>
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                      <div className="text-blue-800">
                        This process may take a few moments for large datasets. Please wait...
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {validationResult && (
                <>
                  {/* Overall Validation Status */}
                  <Card className={`border-2 ${
                    validationResult.hasErrors 
                      ? 'border-red-500 bg-red-50' 
                      : validationResult.hasWarnings 
                      ? 'border-yellow-500 bg-yellow-50' 
                      : 'border-green-500 bg-green-50'
                  }`}>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className={`rounded-full p-3 ${
                          validationResult.hasErrors 
                            ? 'bg-red-100' 
                            : validationResult.hasWarnings 
                            ? 'bg-yellow-100' 
                            : 'bg-green-100'
                        }`}>
                          {validationResult.hasErrors ? (
                            <AlertCircle className="h-8 w-8 text-red-600" />
                          ) : validationResult.hasWarnings ? (
                            <AlertTriangle className="h-8 w-8 text-yellow-600" />
                          ) : (
                            <CheckCircle2 className="h-8 w-8 text-green-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className={`text-xl font-bold ${
                            validationResult.hasErrors 
                              ? 'text-red-800' 
                              : validationResult.hasWarnings 
                              ? 'text-yellow-800' 
                              : 'text-green-800'
                          }`}>
                            {validationResult.hasErrors 
                              ? 'Validation Failed' 
                              : validationResult.hasWarnings 
                              ? 'Validation Passed with Warnings' 
                              : 'Validation Passed'}
                          </h3>
                          <p className={`text-sm mt-1 ${
                            validationResult.hasErrors 
                              ? 'text-red-700' 
                              : validationResult.hasWarnings 
                              ? 'text-yellow-700' 
                              : 'text-green-700'
                          }`}>
                            {validationResult.hasErrors 
                              ? 'Please resolve the errors below before proceeding with migration.' 
                              : validationResult.hasWarnings 
                              ? 'Review the warnings below. You can proceed but consider addressing these issues.' 
                              : 'All checks passed! Your migration is ready to proceed.'}
                          </p>
                        </div>
                        <div className={`text-right ${
                          validationResult.hasErrors 
                            ? 'text-red-600' 
                            : validationResult.hasWarnings 
                            ? 'text-yellow-600' 
                            : 'text-green-600'
                        }`}>
                          <div className="text-2xl font-bold">
                            {validationResult.hasErrors 
                              ? '✗' 
                              : validationResult.hasWarnings 
                              ? '⚠' 
                              : '✓'}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card className={validationResult.summary.errors > 0 ? 'border-destructive' : ''}>
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-2">
                          <AlertCircle className="h-5 w-5 text-destructive" />
                          <div>
                            <p className="text-sm font-medium">Errors</p>
                            <p className="text-2xl font-bold text-destructive">{validationResult.summary.errors}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className={validationResult.summary.warnings > 0 ? 'border-yellow-500' : ''}>
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-2">
                          <AlertTriangle className="h-5 w-5 text-yellow-500" />
                          <div>
                            <p className="text-sm font-medium">Warnings</p>
                            <p className="text-2xl font-bold text-yellow-600">{validationResult.summary.warnings}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-2">
                          <Info className="h-5 w-5 text-blue-500" />
                          <div>
                            <p className="text-sm font-medium">Info</p>
                            <p className="text-2xl font-bold text-blue-600">{validationResult.summary.info}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Issues List */}
                  {validationResult.issues.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Validation Issues</h3>
                      {validationResult.issues.map((issue) => (
                        <Alert 
                          key={issue.id} 
                          variant={issue.severity === 'error' ? 'destructive' : 'default'}
                          className={
                            issue.severity === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                            issue.severity === 'info' ? 'border-blue-500 bg-blue-50' : ''
                          }
                        >
                          {issue.severity === 'error' && <AlertCircle className="h-4 w-4" />}
                          {issue.severity === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-600" />}
                          {issue.severity === 'info' && <Info className="h-4 w-4 text-blue-600" />}
                          <div>
                            <AlertTitle>{issue.title}</AlertTitle>
                            <AlertDescription className="mt-2">
                              {issue.description}
                              {issue.suggestion && (
                                <div className="mt-2 p-2 bg-muted rounded text-sm">
                                  <strong>Suggestion:</strong> {issue.suggestion}
                                </div>
                              )}
                            </AlertDescription>
                          </div>
                        </Alert>
                      ))}
                    </div>
                  )}

                  {/* Action Required */}
                  {validationResult.hasErrors && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        You must resolve all errors before proceeding with the migration. Please address the issues above and try again.
                      </AlertDescription>
                    </Alert>
                  )}

                  {!validationResult.hasErrors && validationResult.hasWarnings && (
                    <Alert className="border-yellow-500 bg-yellow-50">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription>
                        There are warnings that should be reviewed. You can proceed with the migration, but consider addressing these issues for optimal results.
                      </AlertDescription>
                    </Alert>
                  )}

                  {validationResult.isValid && !validationResult.hasWarnings && (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertDescription>
                        All validations passed! Your migration is ready to proceed.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}

              {validateMigration.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {validateMigration.error.message}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* View Results Step */}
          {currentStep === 'view-results' && (
            <div className="space-y-4">
              {executeMigration.isPending ? (
                <div className="space-y-4">
                  <Alert>
                    <div className="flex items-center gap-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                      <div>
                        <AlertDescription className="font-medium">
                          Migration in progress...
                        </AlertDescription>
                        <div className="text-xs text-muted-foreground mt-1">
                          Please wait while your records are being migrated. This may take several minutes.
                        </div>
                      </div>
                    </div>
                  </Alert>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Migration Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Project Name:</span>
                          <div className="text-muted-foreground">{projectData.name}</div>
                        </div>
                        <div>
                          <span className="font-medium">Template:</span>
                          <div className="text-muted-foreground">{selectedTemplate?.name}</div>
                        </div>
                        <div>
                          <span className="font-medium">Records Selected:</span>
                          <div className="text-muted-foreground">{projectData.selectedRecords.length}</div>
                        </div>
                        <div>
                          <span className="font-medium">Status:</span>
                          <div className="text-blue-600 flex items-center gap-1">
                            <div className="animate-pulse h-2 w-2 bg-blue-500 rounded-full"></div>
                            Executing
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                        <div className="font-medium text-blue-800 mb-1">What&apos;s happening now:</div>
                        <ul className="text-blue-700 space-y-1 text-xs">
                          <li>• Extracting records from source organisation</li>
                          <li>• Transforming data according to template rules</li>
                          <li>• Loading records into target organisation</li>
                          <li>• Validating relationships and dependencies</li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : executeMigration.error || createProject.error ? (
                <div className="space-y-4">
                  {/* Check if we have detailed record results */}
                  {(executeMigration.error as any)?.recordResults ? (
                    <DetailedMigrationResults
                      recordResults={(executeMigration.error as any).recordResults}
                      sessionId={(executeMigration.error as any).sessionId || 'unknown'}
                      totalRecords={(executeMigration.error as any).result?.totalRecords || 0}
                      successfulRecords={(executeMigration.error as any).result?.successfulRecords || 0}
                      failedRecords={(executeMigration.error as any).result?.failedRecords || 0}
                      executionTimeMs={(executeMigration.error as any).result?.executionTimeMs || 0}
                      status={(executeMigration.error as any).result?.status || 'failed'}
                      onRetry={() => {
                        // Reset error state and retry
                        executeMigration.reset();
                        handleValidate();
                      }}
                    />
                  ) : (
                    <>
                      {/* Error notification with rollback information */}
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          {(executeMigration.error as any)?.isWarning 
                            ? 'Migration completed with errors. Successfully inserted records have been automatically rolled back to maintain data integrity.' 
                            : executeMigration.error 
                            ? 'Migration execution failed. Any successfully inserted records have been automatically rolled back.' 
                            : 'Project creation failed'}
                        </AlertDescription>
                      </Alert>
                      
                      {/* Detailed Error Information */}
                      <Card className="border-red-200">
                        <CardHeader>
                          <CardTitle className="text-red-800 text-base">
                            Error Details
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="p-3 bg-red-50 border border-red-200 rounded">
                            <div className="text-sm text-red-800 font-mono">
                              {(executeMigration.error || createProject.error)?.message}
                            </div>
                          </div>

                          {/* Show unique errors grouped by interpretation rule if available */}
                          {executeMigration.error && (executeMigration.error as any)?.uniqueErrors && (
                            <div className="space-y-2">
                              <h4 className="font-medium text-sm">Unique Error Types:</h4>
                              {(executeMigration.error as any).uniqueErrors.map((uniqueError: any, index: number) => (
                                <div key={index} className="p-3 bg-red-50 border border-red-200 rounded text-sm">
                                  <div className="font-medium text-red-800 mb-2">
                                    {uniqueError.message}
                                  </div>
                                  <div className="text-red-700 text-xs">
                                    <strong>Affected records:</strong> {uniqueError.count}
                                    {uniqueError.examples.length > 0 && (
                                      <>
                                        <br />
                                        <strong>Examples:</strong> {uniqueError.examples.join(', ')}
                                        {uniqueError.count > uniqueError.examples.length && ` (and ${uniqueError.count - uniqueError.examples.length} more)`}
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Show step-by-step errors if available (only for execution errors) */}
                          {executeMigration.error && (executeMigration.error as any)?.details && !(executeMigration.error as any)?.uniqueErrors && (
                            <div className="space-y-2">
                              <h4 className="font-medium text-sm">Step Results:</h4>
                              {(executeMigration.error as any).details.map((step: any, index: number) => (
                                <div key={index} className={`p-2 border rounded text-sm ${
                                  step.status === 'failed' 
                                    ? 'bg-red-50 border-red-200' 
                                    : step.status === 'success'
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-yellow-50 border-yellow-200'
                                }`}>
                                  <div className={`font-medium flex items-center gap-2 ${
                                    step.status === 'failed' 
                                      ? 'text-red-800' 
                                      : step.status === 'success'
                                      ? 'text-green-800'
                                      : 'text-yellow-800'
                                  }`}>
                                    {step.stepName}
                                  </div>
                                  {step.errors && step.errors.length > 0 && (
                                    <div className="mt-1 text-xs">
                                      {step.errors.slice(0, 3).map((error: any, errorIndex: number) => (
                                        <div key={errorIndex} className="mt-1">
                                          {error.error}
                                        </div>
                                      ))}
                                      {step.errors.length > 3 && (
                                        <div className="mt-1 font-medium">
                                          ... and {step.errors.length - 3} more errors
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Check if we have detailed record results from successful migration */}
                  {executeMigration.data?.recordResults ? (
                    <DetailedMigrationResults
                      recordResults={executeMigration.data.recordResults}
                      sessionId={executeMigration.data.sessionId || 'unknown'}
                      totalRecords={executeMigration.data.result?.totalRecords || 0}
                      successfulRecords={executeMigration.data.result?.successfulRecords || 0}
                      failedRecords={executeMigration.data.result?.failedRecords || 0}
                      executionTimeMs={executeMigration.data.result?.executionTimeMs || 0}
                      status={executeMigration.data.result?.status || 'success'}
                    />
                  ) : (
                    <>
                      <Alert>
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertDescription>
                          Migration completed successfully!
                        </AlertDescription>
                      </Alert>
                      
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Migration Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-center py-4">
                            <div className="text-2xl font-bold text-green-600 mb-2">✓</div>
                            <div className="text-lg font-medium mb-1">Migration Complete</div>
                            <div className="text-sm text-muted-foreground">
                              Your records have been successfully migrated to the target organisation.
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={goToPrevious}
            disabled={currentStepIndex === 0 || currentOperation !== 'idle'}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          
          <div className="flex gap-2">
            {currentStep === 'record-selection' && (
              <Button
                onClick={handleValidate}
                disabled={!canProceed() || currentOperation !== 'idle'}
                className="min-w-32"
              >
                {currentOperation === 'validating' ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Validating...
                  </>
                ) : currentOperation === 'creating' ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating Project...
                  </>
                ) : currentOperation === 'migrating' ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Migrating...
                  </>
                ) : (
                  'Validate & Migrate'
                )}
              </Button>
            )}
            
            {currentStep === 'validation-review' && validationResult?.isValid && (
              <Button
                onClick={handleCreate}
                disabled={currentOperation !== 'idle'}
                className="min-w-32"
              >
                {currentOperation === 'creating' || currentOperation === 'migrating' ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {currentOperation === 'creating' ? 'Creating...' : 'Migrating...'}
                  </>
                ) : (
                  'Start Migration'
                )}
              </Button>
            )}
            
            {currentStep === 'view-results' && (
              <Button
                onClick={() => router.push('/migrations')}
                variant="outline"
              >
                View All Migrations
              </Button>
            )}
            
            {currentStep !== 'record-selection' && currentStep !== 'validation-review' && currentStep !== 'view-results' && (
              <Button
                onClick={goToNext}
                disabled={!canProceed() || currentOperation !== 'idle'}
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
} 
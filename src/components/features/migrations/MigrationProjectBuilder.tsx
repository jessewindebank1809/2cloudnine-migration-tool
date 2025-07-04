'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAutoReconnect } from '@/hooks/useAutoReconnect';
import { useRunningMigrations } from '@/hooks/useRunningMigrations';
import { ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, AlertTriangle, Info, RefreshCw, ExternalLink } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { EnhancedValidationReport } from './templates/EnhancedValidationReport';
import type { MigrationExecutionError, MigrationStepError, MigrationUniqueError } from '@/types/api';

interface Organisation {
  id: string;
  name: string;
  org_type: 'PRODUCTION' | 'SANDBOX' | 'SCRATCH';
  instance_url: string;
  salesforce_org_id: string | null;
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
  recordLink?: string;
  field?: string;
  suggestion?: string;
  parentRecordId?: string;
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
  selectedRecordNames?: Record<string, string>;
}

interface MigrationProjectBuilderProps {
  defaultTemplateId?: string | null;
}

export function MigrationProjectBuilder({ defaultTemplateId }: MigrationProjectBuilderProps) {
  const router = useRouter();
  const { apiCall } = useAutoReconnect();
  const { hasRunningMigration } = useRunningMigrations();
  const [currentStep, setCurrentStep] = useState<Step>('project-setup');
  const [createdMigrationId, setCreatedMigrationId] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [currentOperation, setCurrentOperation] = useState<'idle' | 'validating' | 'creating' | 'migrating'>('idle');
  const [orgConnectionErrors, setOrgConnectionErrors] = useState<{[key: string]: string}>({});
  const [isValidating, setIsValidating] = useState<{[key: string]: boolean}>({});
  const validationTimeoutRef = useRef<{[key: string]: NodeJS.Timeout}>({});
  const [projectData, setProjectData] = useState({
    name: '',
    templateId: '', // Will be set based on defaultTemplateId or interpretation rules template when templates load
    sourceOrgId: '',
    targetOrgId: '',
    selectedRecords: [] as string[],
    selectedRecordNames: {} as Record<string, string>, // Map of record ID to name
  });
  
  // Track if we've attempted to set default template
  const [hasSetDefaultTemplate, setHasSetDefaultTemplate] = useState(false);

  // Fetch available organisations
  const { data: orgsData, isLoading: orgsLoading, error: orgsError, refetch: refetchOrgs } = useQuery({
    queryKey: ['organisations'],
    queryFn: async () => {
      const result = await apiCall<{ orgs: Organisation[] }>(() => fetch('/api/organisations'));
      // If API call fails, return empty orgs array instead of throwing
      // This allows users to continue and use the manual reconnection flow
      if (!result) {
        console.warn('Failed to fetch organisations, returning empty array');
        return { orgs: [] };
      }
      return result;
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Fetch available templates
  const { data: templatesData, isLoading: templatesLoading, error: templatesError, refetch: refetchTemplates } = useQuery({
    queryKey: ['templates'],
    queryFn: async (): Promise<{ templates: MigrationTemplate[] }> => {
      const result = await apiCall<{ templates: MigrationTemplate[] }>(() => fetch('/api/templates'));
      if (!result) throw new Error('Failed to fetch templates');
      
      // Additional validation to ensure templates are actually loaded
      if (!result.templates || result.templates.length === 0) {
        console.warn('Templates API returned empty or no templates array, retrying...');
        throw new Error('No templates available - registry may still be loading');
      }
      
      return result;
    },
    retry: (failureCount, error) => {
      // Retry up to 3 times for empty templates (likely due to timing issues)
      if (failureCount < 3 && error.message.includes('registry may still be loading')) {
        return true;
      }
      // Standard retry logic for other errors
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000), // Exponential backoff: 1s, 2s, 3s
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Set default template when templates load
  React.useEffect(() => {
    // Only attempt to set default template once, and only when templates are loaded
    if (templatesData?.templates && templatesData.templates.length > 0 && !hasSetDefaultTemplate) {
      console.log('Setting default template. Available templates:', templatesData.templates.map(t => t.name));
      
      // First priority: Use the template ID from URL if provided and valid
      if (defaultTemplateId) {
        const requestedTemplate = templatesData.templates.find(
          (template: MigrationTemplate) => template.id === defaultTemplateId
        );
        
        if (requestedTemplate) {
          console.log('Using requested template from URL:', requestedTemplate.name);
          setProjectData(prev => ({ ...prev, templateId: requestedTemplate.id }));
          setHasSetDefaultTemplate(true);
          return;
        } else {
          console.warn('Requested template ID not found:', defaultTemplateId);
        }
      }
      
      // Second priority: Fall back to interpretation rules template
      const interpretationRulesTemplate = templatesData.templates.find(
        (template: MigrationTemplate) => 
          template.name.toLowerCase().includes('interpretation') || 
          template.name.toLowerCase().includes('rules')
      );
      
      if (interpretationRulesTemplate) {
        console.log('Found interpretation rules template:', interpretationRulesTemplate.name);
        setProjectData(prev => ({ ...prev, templateId: interpretationRulesTemplate.id }));
        setHasSetDefaultTemplate(true);
      } else if (templatesData.templates.length > 0) {
        // Final fallback: Use first template if interpretation rules not found
        console.log('Interpretation rules template not found, using first template:', templatesData.templates[0].name);
        setProjectData(prev => ({ ...prev, templateId: templatesData.templates[0].id }));
        setHasSetDefaultTemplate(true);
      }
    }
  }, [templatesData, hasSetDefaultTemplate, defaultTemplateId]);

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
          selectedRecordNames: data.selectedRecordNames,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Validation failed');
      }
      
      return response.json();
    },
    onSuccess: async (data) => {
      try {
        if (!data) return; // Skip if we redirected
        
        const validation = data.validation as ValidationResult;
        setValidationResult(validation);
        
        // Always show validation review step, even if validation passes
        // This ensures users can review what will be migrated before proceeding
        setCurrentStep('validation-review');
        setCurrentOperation('idle');
      } catch (error) {
        console.error('Error in validation success handler:', error);
        setCurrentOperation('idle');
      }
    },
    onError: (error) => {
      console.error('Validation error:', error);
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
      try {
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
      } catch (error) {
        console.error('Error in create project success handler:', error);
        setCurrentStep('view-results'); // Show error details on the results page
        setCurrentOperation('idle');
      }
    },
    onError: (error) => {
      console.error('Create project error:', error);
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
        const migrationError = error as MigrationExecutionError;
        migrationError.details = responseData.details;
        migrationError.result = responseData.result;
        migrationError.sessionId = responseData.sessionId;
        migrationError.uniqueErrors = responseData.uniqueErrors;
        migrationError.recordResults = responseData.recordResults; // Add record results
        throw migrationError;
      }
      
      // Check for warnings (partial migrations with significant errors)
      if (responseData.warning) {
        const warning = new Error(responseData.warning) as MigrationExecutionError;
        warning.isWarning = true;
        warning.result = responseData.result;
        warning.sessionId = responseData.sessionId;
        warning.uniqueErrors = responseData.uniqueErrors;
        warning.recordResults = responseData.recordResults; // Add record results
        throw warning;
      }
      
      return responseData;
    },
    onSuccess: (data) => {
      try {
        if (data) { // Only proceed if we didn't redirect
          setCurrentStep('view-results');
          setCurrentOperation('idle');
        }
      } catch (error) {
        console.error('Error in execute migration success handler:', error);
        setCurrentStep('view-results'); // Show error details on the results page
        setCurrentOperation('idle');
      }
    },
    onError: (error) => {
      console.error('Execute migration error:', error);
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
          connectedOrgs.length >= 2 &&
          Object.keys(orgConnectionErrors).length === 0
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

  const handleValidate = async () => {
    // Show loading state
    setCurrentOperation('validating');
    
    // Pre-check: Verify org connections are healthy
    try {
      const [sourceOrg, targetOrg] = await Promise.all([
        fetch(`/api/orgs/${projectData.sourceOrgId}/health`).then(res => res.json()),
        fetch(`/api/orgs/${projectData.targetOrgId}/health`).then(res => res.json())
      ]);
      
      if (!sourceOrg.isHealthy || !targetOrg.isHealthy) {
        const failedOrg = !sourceOrg.isHealthy ? 
          { id: projectData.sourceOrgId, type: 'source', name: connectedOrgs.find((org: Organisation) => org.id === projectData.sourceOrgId)?.name || 'Source' } : 
          { id: projectData.targetOrgId, type: 'target', name: connectedOrgs.find((org: Organisation) => org.id === projectData.targetOrgId)?.name || 'Target' };
        
        setValidationResult({
          isValid: false,
          hasErrors: true,
          hasWarnings: false,
          issues: [{
            id: 'org-connectivity-error',
            severity: 'error',
            title: 'Organisation Connection Error',
            description: `Unable to connect to ${failedOrg.name}. The access token may have expired or been revoked.`,
            suggestion: 'Click "Reconnect Failed Org" below to re-authenticate with Salesforce.',
          }],
          summary: { errors: 1, warnings: 0, info: 0 }
        });
        setCurrentStep('validation-review');
        setCurrentOperation('idle');
        return;
      }
    } catch (error) {
      console.error('Pre-validation check failed:', error);
      setCurrentOperation('idle');
      // Show generic error
      setValidationResult({
        isValid: false,
        hasErrors: true,
        hasWarnings: false,
        issues: [{
          id: 'pre-validation-error',
          severity: 'error',
          title: 'Pre-validation Check Failed',
          description: 'Unable to verify organisation connections. Please check your network connection and try again.',
          suggestion: 'If the problem persists, try reconnecting to your organisations.',
        }],
        summary: { errors: 1, warnings: 0, info: 0 }
      });
      setCurrentStep('validation-review');
      return;
    }
    
    // Proceed with validation if orgs are healthy
    validateMigration.mutate(projectData);
  };

  const handleCreate = async () => {
    await createProject.mutateAsync(projectData);
  };

  const connectedOrgs = orgsData?.orgs?.filter(
    (org: Organisation) => org.salesforce_org_id !== null
  ) || [];

  const templates = templatesData?.templates || [];
  const selectedTemplate = templates.find((t: MigrationTemplate) => t.id === projectData.templateId);

  // Validate org connection when selected with debouncing
  const validateOrgConnection = useCallback(async (orgId: string, orgType: 'source' | 'target') => {
    if (!orgId) return;
    
    // Clear any existing timeout for this org type
    if (validationTimeoutRef.current[orgType]) {
      clearTimeout(validationTimeoutRef.current[orgType]);
    }
    
    // Set a debounce timeout
    validationTimeoutRef.current[orgType] = setTimeout(async () => {
      setIsValidating((prev: {[key: string]: boolean}) => ({ ...prev, [orgType]: true }));
      
      try {
        const response = await fetch(`/api/orgs/${orgId}/health`);
        const data = await response.json();
        
        if (!data.isHealthy) {
          const errorMsg = data.requiresReauth 
            ? 'Organisation needs to be reconnected. Click to reconnect.'
            : data.error || 'Organisation connection is unhealthy';
          
          setOrgConnectionErrors(prev => ({
            ...prev,
            [orgType]: errorMsg
          }));
          
          // No longer auto-prompting for reconnection - user will use the reconnect button
        } else {
          // Clear any existing error for this org type
          setOrgConnectionErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[orgType];
            return newErrors;
          });
        }
      } catch (error) {
        console.error(`Failed to validate ${orgType} org connection:`, error);
        // More user-friendly error message
        const org = connectedOrgs.find((o: Organisation) => o.id === orgId);
        const orgName = org?.name || 'Organisation';
        setOrgConnectionErrors(prev => ({
          ...prev,
          [orgType]: `Unable to connect to ${orgName}. Please try reconnecting.`
        }));
      } finally {
        setIsValidating((prev: {[key: string]: boolean}) => ({ ...prev, [orgType]: false }));
      }
    }, 300); // 300ms debounce
  }, [connectedOrgs]);

  // Validate existing org selections only on initial load
  React.useEffect(() => {
    // Only run once when both orgs are selected and connectedOrgs is loaded
    if (projectData.sourceOrgId && projectData.targetOrgId && connectedOrgs.length > 0) {
      // Use a flag to ensure we only validate once
      const hasValidated = sessionStorage.getItem('migration-orgs-validated');
      if (hasValidated !== `${projectData.sourceOrgId}-${projectData.targetOrgId}`) {
        validateOrgConnection(projectData.sourceOrgId, 'source');
        validateOrgConnection(projectData.targetOrgId, 'target');
        sessionStorage.setItem('migration-orgs-validated', `${projectData.sourceOrgId}-${projectData.targetOrgId}`);
      }
    }
  }, []); // Only run once on mount
  
  // Cleanup timeouts on unmount
  React.useEffect(() => {
    return () => {
      Object.values(validationTimeoutRef.current).forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  // Memoized callback to prevent infinite re-renders
  const handleRecordSelectionChange = useCallback((selectedRecords: string[], recordNames?: Record<string, string>) => {
    setProjectData(prev => ({ 
      ...prev, 
      selectedRecords,
      selectedRecordNames: recordNames || prev.selectedRecordNames 
    }));
  }, []);

  // Helper function to check if there are connection-related errors
  const hasConnectionErrors = (issues: ValidationIssue[]) => {
    return issues.some(issue => 
      issue.id === 'source-connectivity' || 
      issue.id === 'target-connectivity' ||
      issue.id === 'org-connectivity-error' ||
      issue.title.includes('Connection Failed') ||
      issue.title.includes('Organisation Connection Error') ||
      issue.title === 'orgConnectivity'
    );
  };

  // Get the failed organisation details for reconnection
  const getFailedOrgDetails = (issues: ValidationIssue[]) => {
    const sourceConnError = issues.find(issue => issue.id === 'source-connectivity');
    const targetConnError = issues.find(issue => issue.id === 'target-connectivity');
    const orgConnError = issues.find(issue => issue.id === 'org-connectivity-error');
    
    if (sourceConnError) {
      const sourceOrg = connectedOrgs.find((org: Organisation) => org.id === projectData.sourceOrgId);
      return sourceOrg;
    }
    
    if (targetConnError) {
      const targetOrg = connectedOrgs.find((org: Organisation) => org.id === projectData.targetOrgId);
      return targetOrg;
    }
    
    // Handle pre-validation org connectivity error
    if (orgConnError && orgConnError.description) {
      const isSourceError = orgConnError.description.includes('source organisation');
      if (isSourceError) {
        return connectedOrgs.find((org: Organisation) => org.id === projectData.sourceOrgId);
      } else {
        return connectedOrgs.find((org: Organisation) => org.id === projectData.targetOrgId);
      }
    }
    
    return null;
  };

  // Handle reconnection - directly trigger OAuth flow
  const handleReconnectOrgs = () => {
    if (!validationResult) return;
    
    const failedOrg = getFailedOrgDetails(validationResult.issues);
    if (!failedOrg) {
      console.error('No failed organisation found for reconnection');
      return;
    }
    
    // Trigger the OAuth flow for the failed organisation with return URL
    const returnUrl = '/migrations/new';
    const oauthUrl = `/api/auth/oauth2/salesforce?orgId=${encodeURIComponent(failedOrg.id)}&instanceUrl=${encodeURIComponent(failedOrg.instance_url)}&returnUrl=${encodeURIComponent(returnUrl)}`;
    window.location.href = oauthUrl;
  };

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
              ) : (
                <>
                  {/* Show warning if no connected orgs found, but still allow user to proceed */}
                  {connectedOrgs.length === 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        No connected organisations found. You&apos;ll need to connect at least two organisations to create a migration.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {/* Show info message if only one org is connected */}
                  {connectedOrgs.length === 1 && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        You need at least two connected organisations. Please connect one more organisation to proceed.
                      </AlertDescription>
                    </Alert>
                  )}
                  
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
                  <div>
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-end">
                      <div>
                        <Label htmlFor="source-org">Source Organisation *</Label>
                        <Select
                          value={projectData.sourceOrgId}
                          onValueChange={(value: string) => {
                            setProjectData({ ...projectData, sourceOrgId: value });
                            validateOrgConnection(value, 'source');
                          }}
                          required
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select source organisation" />
                          </SelectTrigger>
                          <SelectContent>
                            {connectedOrgs.map((org: Organisation) => (
                              <SelectItem key={org.id} value={org.id}>
                                <span className="font-medium">{org.name}</span>
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
                          onValueChange={(value: string) => {
                            setProjectData({ ...projectData, targetOrgId: value });
                            validateOrgConnection(value, 'target');
                          }}
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
                                  <span className="font-medium">{org.name}</span>
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {/* Error messages below the grid */}
                    {(orgConnectionErrors.source || orgConnectionErrors.target) && (
                      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 mt-2">
                        <div>
                          {orgConnectionErrors.source && (
                            <Alert variant="destructive">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription className="text-xs flex items-center justify-between">
                                <span>{orgConnectionErrors.source}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 ml-2"
                                  onClick={() => {
                                    const org = connectedOrgs.find((o: Organisation) => o.id === projectData.sourceOrgId);
                                    if (org) {
                                      // Include return URL to come back to migration setup
                                      const returnUrl = '/migrations/new';
                                      const oauthUrl = `/api/auth/oauth2/salesforce?orgId=${encodeURIComponent(org.id)}&instanceUrl=${encodeURIComponent(org.instance_url)}&returnUrl=${encodeURIComponent(returnUrl)}`;
                                      window.location.href = oauthUrl;
                                    }
                                  }}
                                >
                                  Reconnect
                                  <ExternalLink className="h-3 w-3 ml-1" />
                                </Button>
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                        <div></div>
                        <div>
                          {orgConnectionErrors.target && (
                            <Alert variant="destructive">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription className="text-xs flex items-center justify-between">
                                <span>{orgConnectionErrors.target}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 ml-2"
                                  onClick={() => {
                                    const org = connectedOrgs.find((o: Organisation) => o.id === projectData.targetOrgId);
                                    if (org) {
                                      // Include return URL to come back to migration setup
                                      const returnUrl = '/migrations/new';
                                      const oauthUrl = `/api/auth/oauth2/salesforce?orgId=${encodeURIComponent(org.id)}&instanceUrl=${encodeURIComponent(org.instance_url)}&returnUrl=${encodeURIComponent(returnUrl)}`;
                                      window.location.href = oauthUrl;
                                    }
                                  }}
                                >
                                  Reconnect
                                  <ExternalLink className="h-3 w-3 ml-1" />
                                </Button>
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="template">Migration Template *</Label>
                    <div className="flex gap-2">
                      <Select
                        value={projectData.templateId}
                        onValueChange={(value: string) =>
                          setProjectData({ ...projectData, templateId: value })
                        }
                        required
                        disabled={templatesLoading}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder={
                            templatesLoading 
                              ? "Loading templates..." 
                              : templatesError 
                              ? "Failed to load templates"
                              : templates.length === 0
                              ? "No templates available"
                              : "Select a migration template"
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          {templatesLoading ? (
                            <SelectItem value="loading" disabled>Loading ...</SelectItem>
                          ) : templatesError ? (
                            <SelectItem value="error" disabled>Failed to load templates</SelectItem>
                          ) : templates.length === 0 ? (
                            <SelectItem value="empty" disabled>No templates available</SelectItem>
                          ) : (
                            templates.map((template: MigrationTemplate) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {(templatesError || (templates.length === 0 && !templatesLoading)) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-1"
                          onClick={() => refetchTemplates()}
                          disabled={templatesLoading}
                        >
                          <RefreshCw className={`h-4 w-4 ${templatesLoading ? 'animate-spin' : ''}`} />
                        </Button>
                      )}
                    </div>
                    {templatesError && (
                      <p className="text-sm text-destructive mt-1">
                        Unable to load templates. Click the refresh button to try again.
                      </p>
                    )}
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

                  {/* Enhanced Validation Report */}
                  <EnhancedValidationReport
                    errors={validationResult.issues.filter(issue => issue.severity === 'error')}
                    warnings={validationResult.issues.filter(issue => issue.severity === 'warning')}
                    info={validationResult.issues.filter(issue => issue.severity === 'info')}
                    sourceOrgName={connectedOrgs.find((org: Organisation) => org.id === projectData.sourceOrgId)?.name}
                    targetOrgName={connectedOrgs.find((org: Organisation) => org.id === projectData.targetOrgId)?.name}
                    sourceOrgId={projectData.sourceOrgId}
                    targetOrgId={projectData.targetOrgId}
                    onRevalidate={handleValidate}
                    selectedRecords={projectData.selectedRecords}
                    interpretationRuleNames={validationResult.selectedRecordNames || projectData.selectedRecordNames}
                    isValidating={validateMigration.isPending || currentOperation === 'validating'}
                    isMigrating={executeMigration.isPending}
                  />

                  {/* Connection Error Action Button */}
                  {hasConnectionErrors(validationResult.issues) && (
                    <div className="flex justify-end">
                      <Button 
                        variant="outline" 
                        onClick={handleReconnectOrgs}
                        className="flex items-center gap-2"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Reconnect Failed Org
                      </Button>
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
                              {(executeMigration.error as MigrationExecutionError).uniqueErrors?.map((uniqueError: MigrationUniqueError, index: number) => (
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
                              {(executeMigration.error as MigrationExecutionError).details?.map((step: MigrationStepError, index: number) => (
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
                                      {step.errors.slice(0, 3).map((error, errorIndex) => (
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
                  'Validate Selection'
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
              <>

                <Button
                  onClick={() => router.push('/migrations')}
                  variant="outline"
                >
                  View All Migrations
                </Button>
                <Button
                  onClick={() => {
                    if (!executeMigration.isPending && !hasRunningMigration) {
                      if (currentStep === 'view-results') {
                        // Reset component state to start a fresh migration
                        setCurrentStep('project-setup');
                        setProjectData({
                          name: '',
                          templateId: '', // Will be set by useEffect
                          sourceOrgId: '',
                          targetOrgId: '',
                          selectedRecords: [],
                          selectedRecordNames: {},
                        });
                        setCreatedMigrationId(null);
                        setValidationResult(null);
                        setCurrentOperation('idle');
                        setOrgConnectionErrors({});
                        setIsValidating({});
                        setHasSetDefaultTemplate(false); // Reset so template can be set again
                      } else {
                        router.push('/migrations/new');
                      }
                    }
                  }}
                  disabled={executeMigration.isPending || hasRunningMigration}
                  title={executeMigration.isPending || hasRunningMigration ? 'Cannot start new migration while another is in progress' : 'Create a new migration'}
                >
                  {executeMigration.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Migrating...
                    </>
                  ) : hasRunningMigration ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Migrating...
                    </>
                  ) : (
                    'New Migration'
                  )}
                </Button>
              </>
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

      {/* Debug Section - Only show on localhost */}
      {typeof window !== 'undefined' && window.location.hostname === 'localhost' && projectData.sourceOrgId && projectData.targetOrgId && projectData.templateId && projectData.selectedRecords.length > 0 && (
        <Card className="mt-8 border-dashed border-2 border-muted">
          <CardHeader>
            <CardTitle className="text-sm font-mono">Debug: Copy cURL Command</CardTitle>
            <CardDescription className="text-xs">For testing validation endpoint in terminal</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-md overflow-x-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">{`curl -X POST http://localhost:3000/api/migrations/validate \\
  -H "Content-Type: application/json" \\
  -d '{
    "sourceOrgId": "${projectData.sourceOrgId}",
    "targetOrgId": "${projectData.targetOrgId}",
    "templateId": "${projectData.templateId}",
    "selectedRecords": ${JSON.stringify(projectData.selectedRecords)}
  }' | jq .`}</pre>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={(event) => {
                const command = `curl -X POST http://localhost:3000/api/migrations/validate -H "Content-Type: application/json" -d '{"sourceOrgId": "${projectData.sourceOrgId}", "targetOrgId": "${projectData.targetOrgId}", "templateId": "${projectData.templateId}", "selectedRecords": ${JSON.stringify(projectData.selectedRecords)}}' | jq .`;
                navigator.clipboard.writeText(command);
                
                // Change button text temporarily
                const button = event.currentTarget as HTMLButtonElement;
                const originalText = button.textContent;
                button.textContent = 'Copied!';
                setTimeout(() => {
                  button.textContent = originalText;
                }, 2000);
              }}
            >
              Copy to Clipboard
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 
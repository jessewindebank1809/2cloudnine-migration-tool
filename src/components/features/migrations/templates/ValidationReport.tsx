'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info, 
  ChevronDown, 
  ChevronRight,
  RefreshCw,
  Play,
  AlertCircle,
  Copy,
  Loader2
} from 'lucide-react';
import { ValidationResult, ValidationIssue } from '@/lib/migration/templates/core/interfaces';
// import { useToast } from '@/components/ui/use-toast';

interface ValidationReportProps {
  validationResult: ValidationResult | null;
  isValidating: boolean;
  onRevalidate: () => void;
  onProceedWithWarnings?: () => void;
  canProceed: boolean;
  sourceOrgId?: string;
  targetOrgId?: string;
}

export function ValidationReport({
  validationResult,
  isValidating,
  onRevalidate,
  onProceedWithWarnings,
  canProceed,
  sourceOrgId,
  targetOrgId
}: ValidationReportProps) {
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(new Set());

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  if (isValidating) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Validating Migration
          </CardTitle>
          <CardDescription>
            Checking dependencies and data integrity...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full animate-pulse w-1/2" />
            </div>
            <p className="text-sm text-gray-600">
              This may take a few moments for large datasets
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!validationResult) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Validation Required</CardTitle>
          <CardDescription>
            Run validation to check for potential migration issues
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onRevalidate} className="w-full" disabled={isValidating}>
            {isValidating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Run Validation
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { errors, warnings, info, summary, isValid } = validationResult;
  const hasBlockingIssues = errors.length > 0;
  const hasWarnings = warnings.length > 0;

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isValid ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            Validation Results
          </CardTitle>
          <CardDescription>
            {summary.totalChecks} checks completed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{summary.passedChecks}</div>
              <div className="text-sm text-gray-600">Passed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{summary.failedChecks}</div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{summary.warningChecks}</div>
              <div className="text-sm text-gray-600">Warnings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{info.length}</div>
              <div className="text-sm text-gray-600">Info</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onRevalidate} disabled={isValidating}>
              {isValidating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Re-validate
                </>
              )}
            </Button>
            
            {!hasBlockingIssues && canProceed && (
              <Button className="flex-1">
                <Play className="h-4 w-4 mr-2" />
                Proceed with Migration
              </Button>
            )}
            
            {hasWarnings && !hasBlockingIssues && onProceedWithWarnings && (
              <Button variant="secondary" onClick={onProceedWithWarnings}>
                <AlertTriangle className="h-4 w-4 mr-2" />
                Proceed with Warnings
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Blocking Issues Alert */}
      {hasBlockingIssues && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Migration Blocked</AlertTitle>
          <AlertDescription>
            {errors.length} critical {errors.length === 1 ? 'issue' : 'issues'} must be resolved before proceeding.
          </AlertDescription>
        </Alert>
      )}

      {/* Warnings Alert */}
      {hasWarnings && !hasBlockingIssues && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Warnings Detected</AlertTitle>
          <AlertDescription>
            {warnings.length} {warnings.length === 1 ? 'warning' : 'warnings'} detected. 
            Review carefully before proceeding.
          </AlertDescription>
        </Alert>
      )}

      {/* Error Details */}
      {errors.length > 0 && (
        <ValidationSection
          title="Critical Errors"
          issues={errors}
          icon={<XCircle className="h-4 w-4 text-red-500" />}
          badgeVariant="error"
          isExpanded={expandedSections.has('errors')}
          onToggle={() => toggleSection('errors')}
          sourceOrgId={sourceOrgId}
          targetOrgId={targetOrgId}
          onRevalidate={onRevalidate}
        />
      )}

      {/* Warning Details */}
      {warnings.length > 0 && (
        <ValidationSection
          title="Warnings"
          issues={warnings}
          icon={<AlertTriangle className="h-4 w-4 text-yellow-500" />}
          badgeVariant="warning"
          isExpanded={expandedSections.has('warnings')}
          onToggle={() => toggleSection('warnings')}
          sourceOrgId={sourceOrgId}
          targetOrgId={targetOrgId}
          onRevalidate={onRevalidate}
        />
      )}

      {/* Info Details */}
      {info.length > 0 && (
        <ValidationSection
          title="Information"
          issues={info}
          icon={<Info className="h-4 w-4 text-blue-500" />}
          badgeVariant="info"
          isExpanded={expandedSections.has('info')}
          onToggle={() => toggleSection('info')}
          sourceOrgId={sourceOrgId}
          targetOrgId={targetOrgId}
          onRevalidate={onRevalidate}
        />
      )}
    </div>
  );
}

interface ValidationSectionProps {
  title: string;
  issues: ValidationIssue[];
  icon: React.ReactNode;
  badgeVariant: "default" | "secondary" | "destructive" | "outline" | "error" | "warning" | "info";
  isExpanded: boolean;
  onToggle: () => void;
  sourceOrgId?: string;
  targetOrgId?: string;
  onRevalidate?: () => void;
}

function ValidationSection({
  title,
  issues,
  icon,
  badgeVariant,
  isExpanded,
  onToggle,
  sourceOrgId,
  targetOrgId,
  onRevalidate
}: ValidationSectionProps) {
  return (
    <Card>
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {icon}
                {title}
                <Badge variant={badgeVariant}>{issues.length}</Badge>
              </div>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {issues.map((issue, index) => (
                <ValidationIssueCard 
                  key={index} 
                  issue={issue} 
                  sourceOrgId={sourceOrgId}
                  targetOrgId={targetOrgId}
                  onCloneSuccess={onRevalidate}
                />
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

interface ValidationIssueCardProps {
  issue: ValidationIssue;
  sourceOrgId?: string;
  targetOrgId?: string;
  onCloneSuccess?: () => void;
}

function ValidationIssueCard({ issue, sourceOrgId, targetOrgId, onCloneSuccess }: ValidationIssueCardProps) {
  const [isCloning, setIsCloning] = React.useState(false);
  // const { toast } = useToast();
  
  // Check if this is a missing pay code or leave rule error
  const messageText = issue.message || '';
  const isMissingPayCode = (issue.checkName === 'Missing Pay Code Reference' || 
    (messageText.includes('Pay Code') && messageText.includes('is missing from target org'))) && 
    (issue.context?.targetObject === 'tc9_pr__Pay_Code__c' || messageText.includes('Pay Code'));
  const isMissingLeaveRule = (issue.checkName === 'Missing Leave Rule' || 
    (messageText.includes('Leave Rule') && messageText.includes('is missing from target org'))) && 
    (issue.context?.targetObject === 'tc9_pr__Leave_Rule__c' || messageText.includes('Leave Rule'));
  
  // Extract external ID from context or message
  const externalIdFromMessage = messageText.match(/external id: ([^)]+)\)/)?.[1];
  const externalId = issue.context?.missingTargetExternalId || externalIdFromMessage;
  
  const canClone = (isMissingPayCode || isMissingLeaveRule) && 
    sourceOrgId && targetOrgId && externalId;
  
  const handleClone = async () => {
    if (!canClone || !externalId) return;
    
    setIsCloning(true);
    
    try {
      const endpoint = isMissingPayCode 
        ? '/api/migrations/clone-pay-code'
        : '/api/migrations/clone-leave-rule';
      
      const body = isMissingPayCode
        ? { sourceOrgId, targetOrgId, payCodeId: externalId }
        : { sourceOrgId, targetOrgId, leaveRuleId: externalId };
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        // toast({
        //   title: "Success",
        //   description: data.message || `${isMissingPayCode ? 'Pay code' : 'Leave rule'} cloned successfully`,
        // });
        console.log(data.message || `${isMissingPayCode ? 'Pay code' : 'Leave rule'} cloned successfully`);
        
        // Trigger re-validation
        if (onCloneSuccess) {
          onCloneSuccess();
        }
      } else {
        throw new Error(data.error || 'Clone operation failed');
      }
    } catch (error) {
      console.error('Clone error:', error);
      // toast({
      //   title: "Error",
      //   description: error instanceof Error ? error.message : 'Failed to clone record',
      //   variant: "destructive"
      // });
      console.error(error instanceof Error ? error.message : 'Failed to clone record');
    } finally {
      setIsCloning(false);
    }
  };
  
  const getPicklistErrorSuggestion = (issue: ValidationIssue) => {
    if (issue.message.includes('Invalid picklist value')) {
      return "This is a picklist validation error. Please check the field values in your source data against the target org's picklist configuration.";
    }
    if (issue.message.includes('INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST')) {
      return "This is a picklist validation error. Please check the field values in your source data against the target org's picklist configuration.";
    }
    return issue.suggestedAction;
  };

  const isPicklistError = issue.message.includes('Invalid picklist value') || 
                         issue.message.includes('INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST') ||
                         issue.checkName.includes('picklistValidation');

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-medium text-sm">{issue.checkName}</h4>
          <p className="text-sm text-gray-600 mt-1">{issue.message}</p>
          {isPicklistError && (
            <div className="text-xs text-orange-600 mt-1 font-medium">
              🎯 Picklist Validation Error
            </div>
          )}
        </div>
        <Badge 
          variant={
            issue.severity === 'error' ? 'error' : 
            issue.severity === 'warning' ? 'warning' : 'info'
          }
          className="ml-2"
        >
          {issue.severity}
        </Badge>
      </div>
      
      {(issue.recordId || issue.recordName) && (
        <div className="text-xs text-gray-500">
          Record: {issue.recordName || issue.recordId}
        </div>
      )}
      
      {(issue.suggestedAction || isPicklistError) && (
        <div className={`text-xs p-2 rounded ${isPicklistError ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
          <strong>Suggested Action:</strong> {getPicklistErrorSuggestion(issue)}
        </div>
      )}
      
      {canClone && (
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-xs text-gray-600">
            {isMissingPayCode ? 'Pay code' : 'Leave rule'} not found in target org
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleClone}
            disabled={isCloning}
            className="text-xs"
          >
            {isCloning ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Cloning...
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 mr-1" />
                Clone from source
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
} 
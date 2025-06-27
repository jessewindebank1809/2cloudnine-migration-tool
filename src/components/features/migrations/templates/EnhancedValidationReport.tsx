'use client';

import React from 'react';
import { ValidationIssue } from '@/lib/migration/templates/core/interfaces';
import { ValidationFormatter } from '@/lib/migration/templates/core/validation-formatter';
import { AlertCircle, AlertTriangle, Info, ExternalLink, ChevronDown, ChevronRight, Users, Copy, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

interface EnhancedValidationReportProps {
    errors: any[];
    warnings: any[];
    info: any[];
    sourceOrgName?: string;
    targetOrgName?: string;
    sourceOrgId?: string;
    targetOrgId?: string;
    onRevalidate?: () => void;
    selectedRecords?: string[];
    interpretationRuleNames?: Record<string, string>; // Map of rule ID to name
}

export function EnhancedValidationReport({
    errors,
    warnings,
    info,
    sourceOrgName = 'Source Org',
    targetOrgName = 'Target Org',
    sourceOrgId,
    targetOrgId,
    onRevalidate,
    selectedRecords = [],
    interpretationRuleNames = {},
}: EnhancedValidationReportProps) {
    const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());
    const [expandedRecords, setExpandedRecords] = React.useState<Set<string>>(new Set());
    const [cloningRecords, setCloningRecords] = React.useState<Set<string>>(new Set());
    const { toast } = useToast();
    
    // Convert string to title case
    const toTitleCase = (str: string) => {
        return str.replace(/\w\S*/g, (txt) => {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
    };
    
    // Normalize issues to handle both API format (title/description) and core format (checkName/message)
    const normalizeIssue = (issue: any) => {
        // Extract source record name from description if not already present
        let sourceRecordName = issue.recordName;
        
        if (!sourceRecordName && (issue.description || issue.message)) {
            const descriptionText = issue.description || issue.message;
            // Look for pattern like "referenced by [Type] (name: 'RecordName')"
            const match = descriptionText.match(/referenced by [^(]+\(name: '([^']+)'\)/i);
            if (match) {
                sourceRecordName = match[1];
            }
        }
        
        return {
            ...issue,
            checkName: issue.title || issue.checkName,  // Prefer title (which has the formatted name from API)
            message: issue.description || issue.message,  // Prefer description from API
            suggestedAction: issue.suggestion || issue.suggestedAction,
            recordName: sourceRecordName || issue.recordId,
            recordId: issue.recordId,
            recordLink: issue.recordLink,
            parentRecordId: issue.parentRecordId,
        };
    };
    
    const toggleGroup = (groupName: string) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(groupName)) {
            newExpanded.delete(groupName);
        } else {
            newExpanded.add(groupName);
        }
        setExpandedGroups(newExpanded);
    };
    
    const toggleRecord = (recordName: string) => {
        const newExpanded = new Set(expandedRecords);
        if (newExpanded.has(recordName)) {
            newExpanded.delete(recordName);
        } else {
            newExpanded.add(recordName);
        }
        setExpandedRecords(newExpanded);
    };
    
    const canShowCloneButton = (issue: any) => {
        if (!sourceOrgId || !targetOrgId) return false;
        
        const isPayCodeError = issue.checkName === 'Missing Pay Code Reference' || 
            (issue.message?.includes('Pay Code') && issue.message?.includes('missing from target org'));
        const isLeaveRuleError = issue.checkName === 'Missing Leave Rule' || 
            (issue.message?.includes('Leave Rule') && issue.message?.includes('missing from target org'));
        
        const hasExternalId = issue.context?.missingTargetExternalId || 
            issue.message?.match(/external id: ([^)]+)\)/)?.[1];
        
        return (isPayCodeError || isLeaveRuleError) && hasExternalId;
    };
    
    const handleCloneRecord = async (issue: any) => {
        // Extract the external ID from the issue
        const externalId = issue.context?.missingTargetExternalId || 
            issue.message?.match(/external id: ([^)]+)\)/)?.[1];
        
        if (!externalId || !sourceOrgId || !targetOrgId) {
            toast({
                title: "Error",
                description: "Missing required information for cloning",
                variant: "destructive"
            });
            return;
        }
        
        const recordKey = `${issue.checkName}-${externalId}`;
        setCloningRecords(prev => new Set([...prev, recordKey]));
        
        try {
            const isPayCode = issue.checkName === 'Missing Pay Code Reference' || 
                issue.context?.targetObject === 'tc9_pr__Pay_Code__c';
            const isLeaveRule = issue.checkName === 'Missing Leave Rule' || 
                issue.context?.targetObject === 'tc9_pr__Leave_Rule__c';
            
            const endpoint = isPayCode 
                ? '/api/migrations/clone-pay-code'
                : '/api/migrations/clone-leave-rule';
            
            const body = isPayCode
                ? { sourceOrgId, targetOrgId, payCodeId: externalId }
                : { sourceOrgId, targetOrgId, leaveRuleId: externalId };
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                toast({
                    title: "Success",
                    description: data.message || `${isPayCode ? 'Pay code' : 'Leave rule'} cloned successfully`,
                });
                
                // Trigger re-validation
                if (onRevalidate) {
                    onRevalidate();
                }
            } else {
                throw new Error(data.error || 'Clone operation failed');
            }
        } catch (error) {
            console.error('Clone error:', error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : 'Failed to clone record',
                variant: "destructive"
            });
        } finally {
            setCloningRecords(prev => {
                const next = new Set(prev);
                next.delete(recordKey);
                return next;
            });
        }
    };
    
    const renderIssueGroup = (
        groupName: string,
        issues: any[],
        severity: 'error' | 'warning' | 'info'
    ) => {
        const isExpanded = expandedGroups.has(groupName);
        const Icon = severity === 'error' ? AlertCircle : severity === 'warning' ? AlertTriangle : Info;
        const colorClass = severity === 'error' ? 'text-red-600' : severity === 'warning' ? 'text-yellow-600' : 'text-blue-600';
        const bgClass = severity === 'error' ? 'bg-red-50' : severity === 'warning' ? 'bg-yellow-50' : 'bg-blue-50';
        
        // Get the first issue as an example
        const exampleIssue = issues[0];
        const affectedCount = issues.length;
        
        return (
            <div key={groupName} className={cn('rounded-lg p-4 mb-4', bgClass)}>
                <button
                    onClick={() => toggleGroup(groupName)}
                    className="w-full flex items-start justify-between text-left"
                >
                    <div className="flex items-start gap-3">
                        <Icon className={cn('w-5 h-5 mt-0.5', colorClass)} />
                        <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{groupName}</h4>
                            <p className="text-sm text-gray-600 mt-1">
                                {affectedCount} {affectedCount === 1 ? 'record' : 'records'} affected
                            </p>
                            {exampleIssue && exampleIssue.recordLink && (
                                <a 
                                    href={exampleIssue.recordLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 mt-1"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    View example record
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>
                    </div>
                    {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                </button>
                
                {isExpanded && (
                    <div className="mt-4 space-y-2">
                        <div className="bg-white rounded-md p-4 shadow-sm">
                            <div className="flex-1">
                                <p className="text-sm text-gray-700 font-medium mb-2">Error Details:</p>
                                <p className="text-sm text-gray-700">{exampleIssue.message}</p>
                                {exampleIssue.fieldName && exampleIssue.fieldValue && (
                                    <div className="mt-2 text-sm">
                                        <span className="text-gray-600">Field: </span>
                                        <code className="bg-gray-100 px-1 py-0.5 rounded">
                                            {exampleIssue.fieldName}
                                        </code>
                                        <span className="text-gray-600 ml-2">Value: </span>
                                        <code className="bg-gray-100 px-1 py-0.5 rounded">
                                            {exampleIssue.fieldValue}
                                        </code>
                                    </div>
                                )}
                                {(exampleIssue.suggestedAction || exampleIssue.suggestion) && (
                                    <div className="mt-3 text-sm text-gray-600">
                                        <strong>Suggested Action: </strong>
                                        {exampleIssue.suggestedAction || exampleIssue.suggestion}
                                    </div>
                                )}
                                
                                {/* Clone button for missing pay codes and leave rules */}
                                {canShowCloneButton(exampleIssue) && (
                                    <div className="mt-3">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleCloneRecord(exampleIssue)}
                                            disabled={cloningRecords.has(`${exampleIssue.checkName}-${exampleIssue.context?.missingTargetExternalId || exampleIssue.message?.match(/external id: ([^)]+)\)/)?.[1]}`)}
                                            className="text-xs"
                                        >
                                            {cloningRecords.has(`${exampleIssue.checkName}-${exampleIssue.context?.missingTargetExternalId || exampleIssue.message?.match(/external id: ([^)]+)\)/)?.[1]}`) ? (
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
                        </div>
                        
                        <div className="bg-white rounded-md p-4 shadow-sm">
                            <p className="text-sm text-gray-700 font-medium mb-2">
                                All Affected Records ({affectedCount}):
                            </p>
                            <div className="space-y-1 max-h-60 overflow-y-auto">
                                {issues.map((issue, index) => (
                                    <div key={index} className="flex items-center justify-between py-1 px-2 hover:bg-gray-50 rounded">
                                        <span className="text-sm text-gray-600">
                                            {issue.recordName || issue.recordId}
                                        </span>
                                        {issue.recordId && issue.recordLink && (
                                            <a 
                                                href={issue.recordLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                            >
                                                View
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };
    
    
    const renderIssueSection = (
        title: string,
        issues: any[],
        severity: 'error' | 'warning' | 'info'
    ) => {
        if (issues.length === 0) return null;
        
        // Normalize issues
        const normalizedIssues = issues.map(normalizeIssue);
        
        // Always group by error type for cleaner presentation
        const grouped = ValidationFormatter.groupValidationIssues(normalizedIssues);
        
        return (
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        {severity === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
                        {severity === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-600" />}
                        {severity === 'info' && <Info className="w-5 h-5 text-blue-600" />}
                        {title}
                        <Badge variant={severity === 'error' ? 'destructive' : severity === 'warning' ? 'secondary' : 'default'}>
                            {issues.length}
                        </Badge>
                    </CardTitle>
                    {selectedRecords.length > 0 && Object.keys(interpretationRuleNames).length > 0 && (
                        <div className="mt-2 text-sm text-muted-foreground">
                            Selected Interpretation Rules: {selectedRecords.map((ruleId, index) => (
                                <span key={ruleId} className="font-medium">
                                    {interpretationRuleNames[ruleId] || ruleId}
                                    {index < selectedRecords.length - 1 ? ', ' : ''}
                                </span>
                            ))}
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                    {Array.from(grouped.entries()).map(([groupName, groupIssues]) => 
                        renderIssueGroup(groupName, groupIssues, severity)
                    )}
                </CardContent>
            </Card>
        );
    };
    
    return (
        <div className="space-y-6">
            <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Validation Summary</h3>
                <div className="text-sm text-gray-600 space-y-1">
                    <p>Source: <span className="font-medium">{toTitleCase(sourceOrgName)}</span></p>
                    <p>Target: <span className="font-medium">{toTitleCase(targetOrgName)}</span></p>
                </div>
            </div>
            
            {renderIssueSection('Errors', errors, 'error')}
            {renderIssueSection('Warnings', warnings, 'warning')}
            {renderIssueSection('Information', info, 'info')}
            
        </div>
    );
}
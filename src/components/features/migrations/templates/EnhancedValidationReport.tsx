'use client';

import React from 'react';
import { ValidationIssue } from '@/lib/migration/templates/core/interfaces';
import { ValidationFormatter } from '@/lib/migration/templates/core/validation-formatter';
import { AlertCircle, AlertTriangle, Info, ExternalLink, ChevronDown, ChevronRight, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface EnhancedValidationReportProps {
    errors: any[];
    warnings: any[];
    info: any[];
    sourceOrgName?: string;
    targetOrgName?: string;
    selectedRecords?: string[];
    interpretationRuleNames?: Record<string, string>; // Map of rule ID to name
}

export function EnhancedValidationReport({
    errors,
    warnings,
    info,
    sourceOrgName = 'Source Org',
    targetOrgName = 'Target Org',
    selectedRecords = [],
    interpretationRuleNames = {},
}: EnhancedValidationReportProps) {
    const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());
    const [expandedRecords, setExpandedRecords] = React.useState<Set<string>>(new Set());
    
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
    
    const renderIssueGroup = (
        groupName: string,
        issues: any[],
        severity: 'error' | 'warning' | 'info'
    ) => {
        const isExpanded = expandedGroups.has(groupName);
        const Icon = severity === 'error' ? AlertCircle : severity === 'warning' ? AlertTriangle : Info;
        const colorClass = severity === 'error' ? 'text-red-600' : severity === 'warning' ? 'text-yellow-600' : 'text-blue-600';
        const bgClass = severity === 'error' ? 'bg-red-50' : severity === 'warning' ? 'bg-yellow-50' : 'bg-blue-50';
        
        return (
            <div key={groupName} className={cn('rounded-lg p-4 mb-4', bgClass)}>
                <button
                    onClick={() => toggleGroup(groupName)}
                    className="w-full flex items-start justify-between text-left"
                >
                    <div className="flex items-start gap-3">
                        <Icon className={cn('w-5 h-5 mt-0.5', colorClass)} />
                        <div>
                            <h4 className="font-medium text-gray-900">{groupName}</h4>
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
                        {issues.map((issue, index) => (
                        <div key={index} className="bg-white rounded-md p-4 shadow-sm">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <p className="text-sm text-gray-700">{issue.message || issue.description}</p>
                                    {issue.fieldName && issue.fieldValue && (
                                        <div className="mt-2 text-sm">
                                            <span className="text-gray-600">Field: </span>
                                            <code className="bg-gray-100 px-1 py-0.5 rounded">
                                                {issue.fieldName}
                                            </code>
                                            <span className="text-gray-600 ml-2">Value: </span>
                                            <code className="bg-gray-100 px-1 py-0.5 rounded">
                                                {issue.fieldValue}
                                            </code>
                                        </div>
                                    )}
                                    {(issue.suggestedAction || issue.suggestion) && (
                                        <div className="mt-2 text-sm text-gray-600">
                                            <strong>Action: </strong>
                                            {issue.suggestedAction || issue.suggestion}
                                        </div>
                                    )}
                                    {issue.relatedRecords && issue.relatedRecords.length > 0 && (
                                        <div className="mt-2 text-sm">
                                            <strong className="text-gray-600">Related Records:</strong>
                                            <div className="mt-1 space-y-1">
                                                {issue.relatedRecords.map((related: any, idx: number) => (
                                                    <div key={idx} className="flex items-center gap-2">
                                                        <span className="text-gray-500">{related.type}:</span>
                                                        {related.link ? (
                                                            <a
                                                                href={related.link}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                                            >
                                                                {related.name}
                                                                <ExternalLink className="w-3 h-3" />
                                                            </a>
                                                        ) : (
                                                            <span>{related.name}</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {issue.recordId && issue.recordLink && (
                                        <div className="mt-2">
                                            <a 
                                                href={issue.recordLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                            >
                                                View Record
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
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
        
        // Check if we have interpretation rule names to group by
        const hasInterpretationRuleNames = selectedRecords.length > 0 && 
            Object.keys(interpretationRuleNames).length > 0 &&
            normalizedIssues.some(issue => 
                issue.recordId?.startsWith('a5X') || // Breakpoints
                issue.recordId?.startsWith('a5Y') || // Interpretation Rules
                (issue.message || issue.description || '').includes('Breakpoint') ||
                (issue.message || issue.description || '').includes('Interpretation Rule')
            );
        
        if (hasInterpretationRuleNames) {
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
                        <div className="mt-2 text-sm text-muted-foreground">
                            Selected Interpretation Rules: {selectedRecords.map((ruleId, index) => (
                                <span key={ruleId} className="font-medium">
                                    {interpretationRuleNames[ruleId] || ruleId}
                                    {index < selectedRecords.length - 1 ? ', ' : ''}
                                </span>
                            ))}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {/* Group by interpretation rule */}
                        {selectedRecords.map((ruleId, ruleIndex) => {
                            const ruleName = interpretationRuleNames[ruleId] || `Interpretation Rule (${ruleId})`;
                            const ruleKey = `rule-${ruleId}`;
                            const isRuleExpanded = expandedGroups.has(ruleKey);
                            
                            // Filter issues that belong to this interpretation rule
                            const ruleIssues = normalizedIssues.filter(issue => 
                                issue.parentRecordId === ruleId || 
                                // If no parentRecordId, include issues for the interpretation rule itself
                                (!issue.parentRecordId && issue.recordId === ruleId)
                            );
                            
                            // Only show the rule if it has errors
                            if (ruleIssues.length === 0) {
                                return null;
                            }
                            
                            return (
                                <div key={ruleId} className="mb-4">
                                    <button
                                        onClick={() => toggleGroup(ruleKey)}
                                        className="w-full flex items-start justify-between text-left p-3 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                    >
                                        <div className="flex items-start gap-3">
                                            <Users className="w-5 h-5 text-gray-600 mt-0.5" />
                                            <div>
                                                <h4 className="font-medium text-gray-900">{ruleName}</h4>
                                                <p className="text-sm text-gray-600 mt-1">
                                                    {ruleIssues.length} validation {ruleIssues.length === 1 ? 'error' : 'errors'} found in child records
                                                </p>
                                            </div>
                                        </div>
                                        {isRuleExpanded ? (
                                            <ChevronDown className="w-5 h-5 text-gray-400" />
                                        ) : (
                                            <ChevronRight className="w-5 h-5 text-gray-400" />
                                        )}
                                    </button>
                                    
                                    {isRuleExpanded && (
                                        <div className="mt-2 ml-8 space-y-2">
                                            {/* Group by error type within each rule */}
                                            {(() => {
                                                const groupedByType = ValidationFormatter.groupValidationIssues(ruleIssues);
                                                return Array.from(groupedByType.entries()).map(([errorType, typeIssues]) => {
                                                    const typeKey = `${ruleKey}-${errorType}`;
                                                    const isTypeExpanded = expandedRecords.has(typeKey);
                                                    const Icon = severity === 'error' ? AlertCircle : severity === 'warning' ? AlertTriangle : Info;
                                                    const colorClass = severity === 'error' ? 'text-red-600' : severity === 'warning' ? 'text-yellow-600' : 'text-blue-600';
                                                    const bgClass = severity === 'error' ? 'bg-red-50' : severity === 'warning' ? 'bg-yellow-50' : 'bg-blue-50';
                                                    
                                                    return (
                                                        <div key={errorType} className={cn('rounded-lg p-3', bgClass)}>
                                                            <button
                                                                onClick={() => toggleRecord(typeKey)}
                                                                className="w-full flex items-start justify-between text-left"
                                                            >
                                                                <div className="flex items-start gap-2">
                                                                    <Icon className={cn('w-4 h-4 mt-0.5', colorClass)} />
                                                                    <div className="flex-1">
                                                                        <h5 className="font-medium text-sm">{errorType}</h5>
                                                                        <p className="text-xs text-gray-600">
                                                                            {typeIssues.length} {typeIssues.length === 1 ? 'issue' : 'issues'}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                {isTypeExpanded ? (
                                                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                                                ) : (
                                                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                                                )}
                                                            </button>
                                                            
                                                            {isTypeExpanded && (
                                                                <div className="mt-2 space-y-1">
                                                                    {typeIssues.map((issue, index) => (
                                                                        <div key={index} className="bg-white rounded p-2 ml-6 text-xs border border-gray-200">
                                                                            <p className="text-gray-700">{issue.message || issue.description}</p>
                                                                            {issue.recordId && issue.recordLink && (
                                                                                <a 
                                                                                    href={issue.recordLink}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 mt-1"
                                                                                >
                                                                                    View Record
                                                                                    <ExternalLink className="w-3 h-3" />
                                                                                </a>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            );
        } else {
            // Fallback to original grouping by error type only
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
                    </CardHeader>
                    <CardContent>
                        {Array.from(grouped.entries()).map(([groupName, groupIssues]) => 
                            renderIssueGroup(groupName, groupIssues, severity)
                        )}
                    </CardContent>
                </Card>
            );
        }
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
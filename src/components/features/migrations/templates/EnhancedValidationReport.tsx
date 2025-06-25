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
        
        // Group issues by source record name
        const issuesByRecord = new Map<string, any[]>();
        
        // For interpretation rule migrations, we want to show the interpretation rule name
        // as the source record, not the child record names
        // Since we don't have the mapping of which errors belong to which interpretation rule,
        // we'll use a generic heading for now
        
        // Check if these are interpretation rule related errors
        const hasInterpretationRuleErrors = issues.some(issue => 
            issue.recordId?.startsWith('a5X') || // Breakpoints
            issue.recordId?.startsWith('a5Y') || // Interpretation Rules
            (issue.message || issue.description || '').includes('Breakpoint') ||
            (issue.message || issue.description || '').includes('Interpretation Rule')
        );
        
        if (hasInterpretationRuleErrors && selectedRecords.length > 0) {
            // Group all errors under the selected interpretation rules
            const groupName = selectedRecords.length === 1 
                ? 'Selected Interpretation Rule'
                : `Selected Interpretation Rules (${selectedRecords.length})`;
            
            issuesByRecord.set(groupName, issues);
        } else {
            // Fallback to grouping by the extracted record names
            issues.forEach(issue => {
                const recordKey = issue.recordName || 'Unknown Record';
                if (!issuesByRecord.has(recordKey)) {
                    issuesByRecord.set(recordKey, []);
                }
                issuesByRecord.get(recordKey)!.push(issue);
            });
        }
        
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
                        {Array.from(issuesByRecord.entries()).map(([recordName, recordIssues]) => {
                            const isRecordExpanded = expandedRecords.has(recordName);
                            return (
                                <div key={recordName} className="bg-gray-100 rounded-md p-3">
                                    <button
                                        onClick={() => toggleRecord(recordName)}
                                        className="w-full flex items-center justify-between text-left"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Users className="w-4 h-4 text-gray-600" />
                                            <span className="font-medium text-gray-800">{recordName}</span>
                                            <Badge variant="outline" className="text-xs">
                                                {recordIssues.length} issue{recordIssues.length !== 1 ? 's' : ''}
                                            </Badge>
                                        </div>
                                        {isRecordExpanded ? (
                                            <ChevronDown className="w-4 h-4 text-gray-400" />
                                        ) : (
                                            <ChevronRight className="w-4 h-4 text-gray-400" />
                                        )}
                                    </button>
                                    
                                    {isRecordExpanded && (
                                        <div className="mt-2 space-y-2">
                                            {recordIssues.map((issue, index) => (
                                                <div key={index} className="bg-white rounded-md p-3 ml-6 shadow-sm">
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
                        })}
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
        
        // Always group by check name (error type)
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
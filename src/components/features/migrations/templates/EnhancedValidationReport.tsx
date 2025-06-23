'use client';

import React from 'react';
import { ValidationIssue } from '@/lib/migration/templates/core/interfaces';
import { ValidationFormatter } from '@/lib/migration/templates/core/validation-formatter';
import { AlertCircle, AlertTriangle, Info, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
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
}

export function EnhancedValidationReport({
    errors,
    warnings,
    info,
    sourceOrgName = 'Source Org',
    targetOrgName = 'Target Org',
}: EnhancedValidationReportProps) {
    const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());
    
    // Convert string to title case
    const toTitleCase = (str: string) => {
        return str.replace(/\w\S*/g, (txt) => {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
    };
    
    // Normalize issues to handle both API format (title/description) and core format (checkName/message)
    const normalizeIssue = (issue: any) => ({
        ...issue,
        checkName: issue.title || issue.checkName,  // Prefer title (which has the formatted name from API)
        message: issue.description || issue.message,  // Prefer description from API
        suggestedAction: issue.suggestion || issue.suggestedAction,
        recordName: issue.recordName || issue.recordId,
        recordId: issue.recordId,
        recordLink: issue.recordLink,
    });
    
    const toggleGroup = (groupName: string) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(groupName)) {
            newExpanded.delete(groupName);
        } else {
            newExpanded.add(groupName);
        }
        setExpandedGroups(newExpanded);
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
                            <p className="text-sm text-gray-600 mt-1">
                                {issues.length} {issues.length === 1 ? 'issue' : 'issues'} found
                            </p>
                        </div>
                    </div>
                    {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                </button>
                
                {isExpanded && (
                    <div className="mt-4 space-y-3">
                        {issues.map((issue, index) => (
                            <div key={index} className="bg-white rounded-md p-4 shadow-sm">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        {(issue.recordName || issue.recordId) && (
                                            <div className="font-medium text-gray-900 mb-1">
                                                {issue.recordId && issue.recordLink ? (
                                                    <a 
                                                        href={issue.recordLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-600 hover:text-blue-800 hover:underline"
                                                    >
                                                        {issue.recordId}
                                                    </a>
                                                ) : (
                                                    issue.recordName || issue.recordId
                                                )}
                                            </div>
                                        )}
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
        
        // Normalize and group issues by check name
        const normalizedIssues = issues.map(normalizeIssue);
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
            
            {errors.length === 0 && warnings.length === 0 && info.length === 0 && (
                <Card>
                    <CardContent className="py-8 text-center">
                        <p className="text-gray-500">No validation issues found. The migration is ready to proceed.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
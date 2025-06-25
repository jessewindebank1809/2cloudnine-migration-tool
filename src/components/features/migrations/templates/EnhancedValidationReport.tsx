'use client';

import React from 'react';
import { ValidationIssue } from '@/lib/migration/templates/core/interfaces';
import { ValidationFormatter } from '@/lib/migration/templates/core/validation-formatter';
import { AlertCircle, AlertTriangle, Info, ExternalLink, ChevronDown, ChevronRight, Users, FileWarning } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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
    const [groupByRecord, setGroupByRecord] = React.useState(false);
    
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
    
    const renderRecordGroup = (
        recordName: string,
        issues: any[],
        severity: 'error' | 'warning' | 'info'
    ) => {
        const isExpanded = expandedGroups.has(recordName);
        const Icon = Users;
        const bgClass = 'bg-gray-50';
        
        // Count issues by severity for this record
        const severityCounts = {
            error: issues.filter(i => i.severity === 'error').length,
            warning: issues.filter(i => i.severity === 'warning').length,
            info: issues.filter(i => i.severity === 'info').length
        };
        
        return (
            <div key={recordName} className={cn('rounded-lg p-4 mb-4', bgClass)}>
                <button
                    onClick={() => toggleGroup(recordName)}
                    className="w-full flex items-start justify-between text-left"
                >
                    <div className="flex items-start gap-3">
                        <Icon className="w-5 h-5 mt-0.5 text-gray-600" />
                        <div>
                            <h4 className="font-medium text-gray-900">{recordName}</h4>
                            <div className="flex gap-2 mt-1">
                                {severityCounts.error > 0 && (
                                    <Badge variant="destructive" className="text-xs">
                                        {severityCounts.error} error{severityCounts.error !== 1 ? 's' : ''}
                                    </Badge>
                                )}
                                {severityCounts.warning > 0 && (
                                    <Badge variant="secondary" className="text-xs">
                                        {severityCounts.warning} warning{severityCounts.warning !== 1 ? 's' : ''}
                                    </Badge>
                                )}
                                {severityCounts.info > 0 && (
                                    <Badge variant="default" className="text-xs">
                                        {severityCounts.info} info
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                    {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                </button>
                
                {isExpanded && (
                    <div className="mt-4 space-y-3 ml-8">
                        {issues.map((issue, index) => {
                            const issueSeverity = issue.severity || severity;
                            const IssueIcon = issueSeverity === 'error' ? AlertCircle : 
                                            issueSeverity === 'warning' ? AlertTriangle : Info;
                            const issueColorClass = issueSeverity === 'error' ? 'text-red-600' : 
                                                  issueSeverity === 'warning' ? 'text-yellow-600' : 'text-blue-600';
                            
                            return (
                                <div key={index} className="bg-white rounded-md p-4 shadow-sm">
                                    <div className="flex items-start gap-3">
                                        <IssueIcon className={cn('w-5 h-5 mt-0.5', issueColorClass)} />
                                        <div className="flex-1">
                                            <div className="font-medium text-gray-900 mb-1">
                                                {issue.checkName || issue.title}
                                            </div>
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
                                        </div>
                                    </div>
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
        
        // Group by record or by check name based on toggle
        const grouped = groupByRecord 
            ? ValidationFormatter.groupValidationIssuesByRecord(normalizedIssues)
            : ValidationFormatter.groupValidationIssues(normalizedIssues);
        
        return (
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {severity === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
                            {severity === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-600" />}
                            {severity === 'info' && <Info className="w-5 h-5 text-blue-600" />}
                            {title}
                            <Badge variant={severity === 'error' ? 'destructive' : severity === 'warning' ? 'secondary' : 'default'}>
                                {issues.length}
                            </Badge>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {Array.from(grouped.entries()).map(([groupName, groupIssues]) => 
                        groupByRecord 
                            ? renderRecordGroup(groupName, groupIssues, severity)
                            : renderIssueGroup(groupName, groupIssues, severity)
                    )}
                </CardContent>
            </Card>
        );
    };
    
    // Calculate if there are issues with recordId/recordName to show the toggle
    const hasRecordInfo = [...errors, ...warnings, ...info].some(issue => 
        issue.recordId || issue.recordName
    );
    
    return (
        <div className="space-y-6">
            <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="font-medium text-gray-900 mb-2">Validation Summary</h3>
                        <div className="text-sm text-gray-600 space-y-1">
                            <p>Source: <span className="font-medium">{toTitleCase(sourceOrgName)}</span></p>
                            <p>Target: <span className="font-medium">{toTitleCase(targetOrgName)}</span></p>
                        </div>
                    </div>
                    {hasRecordInfo && (
                        <div className="flex items-center space-x-2">
                            <Label htmlFor="group-by-record" className="text-sm text-gray-600">
                                Group by Record
                            </Label>
                            <Switch
                                id="group-by-record"
                                checked={groupByRecord}
                                onCheckedChange={setGroupByRecord}
                            />
                        </div>
                    )}
                </div>
            </div>
            
            {renderIssueSection('Errors', errors, 'error')}
            {renderIssueSection('Warnings', warnings, 'warning')}
            {renderIssueSection('Information', info, 'info')}
            
        </div>
    );
}
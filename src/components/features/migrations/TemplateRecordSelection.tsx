'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAutoReconnect } from '@/hooks/useAutoReconnect';
import { Search, ChevronLeft, ChevronRight, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface SalesforceRecord {
  Id: string;
  Name: string;
  CreatedDate: string;
  LastModifiedDate: string;
  [key: string]: any;
}

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface TemplateRecordSelectionProps {
  sourceOrgId: string;
  templateId: string;
  onSelectionChange: (selectedRecords: string[]) => void;
  selectedRecords?: string[];
}

export function TemplateRecordSelection({
  sourceOrgId,
  templateId,
  onSelectionChange,
  selectedRecords = []
}: TemplateRecordSelectionProps) {
  const router = useRouter();
  const { apiCall } = useAutoReconnect();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(selectedRecords));
  const [currentPage, setCurrentPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState(''); // Separate state for input field
  const [primaryObjectType, setPrimaryObjectType] = useState<string>('');
  const [isLoadingAllRecords, setIsLoadingAllRecords] = useState(false);
  const isInitializedRef = useRef(false);
  const pageSize = 10;

  // Sync selectedRecords prop with local state
  useEffect(() => {
    const currentSelectedArray = Array.from(selectedIds).sort();
    const newSelectedArray = selectedRecords.sort();
    
    // Only update if the arrays are actually different
    if (JSON.stringify(currentSelectedArray) !== JSON.stringify(newSelectedArray)) {
      setSelectedIds(new Set(selectedRecords));
    }
    
    // Mark as initialized after first effect run
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
    }
  }, [selectedRecords]);

  // Fetch template data to get primary object type
  const { data: templateData, isLoading: isLoadingTemplate } = useQuery({
    queryKey: ['template', templateId],
    queryFn: async () => {
      const result = await apiCall<any>(() => fetch(`/api/templates/${templateId}`));
      return result;
    },
    enabled: !!templateId,
  });

  useEffect(() => {
    if (templateData?.template?.etlSteps?.[0]?.objectApiName) {
      setPrimaryObjectType(templateData.template.etlSteps[0].objectApiName);
    }
  }, [templateData]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
      setCurrentPage(0); // Reset to first page when search changes
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [searchInput]);

  // First, get the total count of records
  const { data: totalCountData, isLoading: isLoadingCount } = useQuery({
    queryKey: ['template-records-count', sourceOrgId, primaryObjectType, searchTerm],
    queryFn: async () => {
      if (!primaryObjectType) return { totalCount: 0 };
      
      let countQuery = `SELECT COUNT() FROM ${primaryObjectType}`;
      let whereClause = '';
      
      // For interpretation rules, exclude variation rules
      if (primaryObjectType === 'tc9_et__Interpretation_Rule__c') {
        whereClause = " WHERE RecordType.Name != 'Interpretation Variation Rule'";
      }
      
      // Add search filter if provided
      if (searchTerm.trim()) {
        if (whereClause) {
          whereClause += ` AND Name LIKE '%${searchTerm.trim()}%'`;
        } else {
          whereClause = ` WHERE Name LIKE '%${searchTerm.trim()}%'`;
        }
      }
      
      countQuery += whereClause;

      const result = await apiCall<any>(() => fetch('/api/salesforce/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: sourceOrgId,
          query: countQuery
        }),
      }));

      if (!result || !result.success) {
        throw new Error('Failed to fetch record count');
      }
      
      return {
        totalCount: result.totalSize || 0
      };
    },
    enabled: !!sourceOrgId && !!primaryObjectType,
  });

  // Fetch records for the primary object type
  const { data: recordsData, isLoading, error, refetch } = useQuery({
    queryKey: ['template-records', sourceOrgId, primaryObjectType, currentPage, pageSize, searchTerm],
    queryFn: async () => {
      if (!primaryObjectType) return null;
      
      const offset = currentPage * pageSize;
      let query = `SELECT Id, Name, CreatedDate, LastModifiedDate FROM ${primaryObjectType}`;
      let whereClause = '';
      
      // For interpretation rules, exclude variation rules
      if (primaryObjectType === 'tc9_et__Interpretation_Rule__c') {
        whereClause = " WHERE RecordType.Name != 'Interpretation Variation Rule'";
      }
      
      // Add search filter if provided
      if (searchTerm.trim()) {
        if (whereClause) {
          whereClause += ` AND Name LIKE '%${searchTerm.trim()}%'`;
        } else {
          whereClause = ` WHERE Name LIKE '%${searchTerm.trim()}%'`;
        }
      }
      
      query += whereClause;
      query += ` ORDER BY LastModifiedDate DESC LIMIT ${pageSize} OFFSET ${offset}`;

      const result = await apiCall<any>(() => fetch('/api/salesforce/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: sourceOrgId,
          query: query
        }),
      }));

      if (!result) {
        throw new Error('Failed to fetch records');
      }
      
      return {
        records: result.records || [],
        pagination: {
          total: totalCountData?.totalCount || 0,
          limit: pageSize,
          offset: offset,
          hasMore: result.records?.length === pageSize
        }
      };
    },
    enabled: !!sourceOrgId && !!primaryObjectType && totalCountData !== undefined,
  });

  const records: SalesforceRecord[] = recordsData?.records || [];
  const pagination: PaginationInfo = recordsData?.pagination || { total: 0, limit: pageSize, offset: 0, hasMore: false };
  const totalPages = Math.ceil(pagination.total / pageSize);

  // Filter records based on search (client-side for current page)
  const filteredRecords = records.filter(record => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      record.Name?.toLowerCase().includes(searchLower) ||
      record.Id.toLowerCase().includes(searchLower)
    );
  });

  // Handle individual record selection
  const handleRecordToggle = useCallback((recordId: string, isSelected: boolean) => {
    setSelectedIds(prevSelectedIds => {
      const newSelectedIds = new Set(prevSelectedIds);
      
      if (isSelected) {
        newSelectedIds.add(recordId);
      } else {
        newSelectedIds.delete(recordId);
      }
      
      // Only call onSelectionChange after component is initialized
      if (isInitializedRef.current) {
        // Use setTimeout to ensure this runs after the current render cycle
        setTimeout(() => {
          try {
            onSelectionChange(Array.from(newSelectedIds));
          } catch (error) {
            console.error('Error in onSelectionChange callback:', error);
          }
        }, 0);
      }
      return newSelectedIds;
    });
  }, [onSelectionChange]);

  // Handle select all/none for current page
  const handleSelectAll = useCallback((selectAll: boolean) => {
    setSelectedIds(prevSelectedIds => {
      const newSelectedIds = new Set(prevSelectedIds);
      const recordIds = filteredRecords.map(r => r.Id);
      
      if (selectAll) {
        recordIds.forEach(id => newSelectedIds.add(id));
      } else {
        recordIds.forEach(id => newSelectedIds.delete(id));
      }
      
      // Only call onSelectionChange after component is initialized
      if (isInitializedRef.current) {
        // Use setTimeout to ensure this runs after the current render cycle
        setTimeout(() => {
          try {
            onSelectionChange(Array.from(newSelectedIds));
          } catch (error) {
            console.error('Error in onSelectionChange callback:', error);
          }
        }, 0);
      }
      return newSelectedIds;
    });
  }, [onSelectionChange, filteredRecords]);

  const allCurrentPageSelected = filteredRecords.length > 0 && 
    filteredRecords.every(record => selectedIds.has(record.Id));
  const someCurrentPageSelected = filteredRecords.some(record => selectedIds.has(record.Id));

  // Function to load all records and select them
  const handleSelectAllRecords = useCallback(async () => {
    if (!primaryObjectType || isLoadingAllRecords) return;
    
    setIsLoadingAllRecords(true);
    try {
      const totalCount = totalCountData?.totalCount || 0;
      if (totalCount === 0) return;

      const allRecordIds = new Set<string>();
      const chunkSize = 200; // Fetch in chunks for better performance
      const totalChunks = Math.ceil(totalCount / chunkSize);

      for (let chunk = 0; chunk < totalChunks; chunk++) {
        const offset = chunk * chunkSize;
        let query = `SELECT Id FROM ${primaryObjectType}`;
        let whereClause = '';
        
        // For interpretation rules, exclude variation rules
        if (primaryObjectType === 'tc9_et__Interpretation_Rule__c') {
          whereClause = " WHERE RecordType.Name != 'Interpretation Variation Rule'";
        }
        
        // Add search filter if provided
        if (searchTerm.trim()) {
          if (whereClause) {
            whereClause += ` AND Name LIKE '%${searchTerm.trim()}%'`;
          } else {
            whereClause = ` WHERE Name LIKE '%${searchTerm.trim()}%'`;
          }
        }
        
        query += whereClause;
        query += ` ORDER BY LastModifiedDate DESC LIMIT ${chunkSize} OFFSET ${offset}`;

        const result = await apiCall<any>(() => fetch('/api/salesforce/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgId: sourceOrgId,
            query: query
          }),
        }));

        if (result?.records) {
          result.records.forEach((record: any) => allRecordIds.add(record.Id));
        }

        // If we got fewer records than expected, we've reached the end
        if (!result?.records || result.records.length < chunkSize) {
          break;
        }
      }

      // Update selected records
      setSelectedIds(allRecordIds);
      
      if (isInitializedRef.current) {
        setTimeout(() => {
          try {
            onSelectionChange(Array.from(allRecordIds));
          } catch (error) {
            console.error('Error in onSelectionChange callback:', error);
          }
        }, 0);
      }

    } catch (error) {
      console.error('Failed to load all records:', error);
    } finally {
      setIsLoadingAllRecords(false);
    }
  }, [primaryObjectType, sourceOrgId, searchTerm, totalCountData, apiCall, onSelectionChange, isLoadingAllRecords]);

  // Function to deselect all records
  const handleDeselectAllRecords = useCallback(() => {
    setSelectedIds(new Set());
    if (isInitializedRef.current) {
      setTimeout(() => {
        try {
          onSelectionChange([]);
        } catch (error) {
          console.error('Error in onSelectionChange callback:', error);
        }
      }, 0);
    }
  }, [onSelectionChange]);

  if (!templateData && templateId) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading ...</span>
      </div>
    );
  }

  if (isLoadingTemplate || isLoadingCount || isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    const isTokenExpired = error instanceof Error && 
      (error.message.includes('Authentication token has expired') || 
       error.message.includes('TOKEN_EXPIRED') ||
       error.message.includes('expired access/refresh token'));
    
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {isTokenExpired ? (
            <>
              Authentication token has expired. Please{' '}
              <a 
                href="/orgs" 
                className="underline font-medium hover:no-underline"
              >
                reconnect the organisation
              </a>{' '}
              to continue.
            </>
          ) : (
            'Failed to load records from source organisation'
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (!primaryObjectType) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Unable to determine primary object from template configuration.
        </AlertDescription>
      </Alert>
    );
  }

  if (records.length === 0 && !searchTerm) {
    return (
      <Alert className="bg-amber-50 border-amber-200">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          No records found for {primaryObjectType}. The source organisation may not contain any records for this object type.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selection count badge positioned at top right */}
      <div className="flex justify-end -mt-2">
        <Badge variant="outline">
          {selectedIds.size} selected
        </Badge>
      </div>

      {/* Controls */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search records..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Bulk Actions */}
      <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={allCurrentPageSelected}
            onCheckedChange={(checked) => handleSelectAll(checked === true)}
            className="data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground"
            {...(someCurrentPageSelected && !allCurrentPageSelected ? { 'data-state': 'indeterminate' } : {})}
          />
          <span className="text-sm font-medium">
            {allCurrentPageSelected ? 'Deselect All' : 'Select All'} on this page
          </span>
        </div>
        <div className="text-sm text-muted-foreground">
          Showing {filteredRecords.length} of {pagination.total} records
        </div>
      </div>

      {/* Records List */}
      <div className="space-y-2">
        {filteredRecords.map((record) => (
          <Card
            key={record.Id}
            className={`cursor-pointer transition-colors ${
              selectedIds.has(record.Id) ? 'border-primary bg-primary/5' : 'hover:border-gray-300'
            }`}
            onClick={() => handleRecordToggle(record.Id, !selectedIds.has(record.Id))}
          >
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <Checkbox
                  checked={selectedIds.has(record.Id)}
                  onCheckedChange={(checked) => handleRecordToggle(record.Id, checked === true)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex-1">
                  <div className="font-medium">{record.Name}</div>
                  <div className="text-sm text-muted-foreground">
                    ID: {record.Id}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {currentPage + 1} of {totalPages} 
            <span className="ml-2">
              (Showing {Math.min(pagination.offset + 1, pagination.total)}-{Math.min(pagination.offset + filteredRecords.length, pagination.total)} of {pagination.total} records)
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(0)}
              disabled={currentPage === 0}
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage >= totalPages - 1}
            >
              Next
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages - 1)}
              disabled={currentPage >= totalPages - 1}
            >
              Last
            </Button>
          </div>
        </div>
      )}

      {/* No Results */}
      {filteredRecords.length === 0 && searchTerm && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            No records match your search criteria.
          </p>
        </div>
      )}
    </div>
  );
} 
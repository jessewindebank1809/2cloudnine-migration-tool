'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Search, 
  Filter, 
  CheckSquare, 
  Square, 
  Eye, 
  RefreshCw,
  Database,
  Calendar,
  User
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface SalesforceRecord {
  Id: string;
  Name: string;
  CreatedDate: string;
  LastModifiedDate: string;
  isSelected: boolean;
}

interface RecordSelectorProps {
  projectId: string;
  objectType: string;
  onSelectionChange: (selectedRecords: string[]) => void;
  selectedRecords?: string[];
}

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export function RecordSelector({ 
  projectId, 
  objectType, 
  onSelectionChange,
  selectedRecords = []
}: RecordSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(selectedRecords));
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [showSoqlPreview, setShowSoqlPreview] = useState(false);

  // Fetch records for the object type
  const { data: recordsData, isLoading, error, refetch } = useQuery({
    queryKey: ['migration-records', projectId, objectType, currentPage, pageSize],
    queryFn: async () => {
      const offset = currentPage * pageSize;
      const response = await fetch(
        `/api/migrations/${projectId}/records?objectType=${objectType}&limit=${pageSize}&offset=${offset}`
      );
      if (!response.ok) throw new Error('Failed to fetch records');
      return response.json();
    },
    enabled: !!projectId && !!objectType,
  });

  const records: SalesforceRecord[] = recordsData?.records || [];
  const pagination: PaginationInfo = recordsData?.pagination || { total: 0, limit: pageSize, offset: 0, hasMore: false };
  const totalPages = Math.ceil(pagination.total / pageSize);

  // Filter records based on search
  const filteredRecords = records.filter(record => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      record.Name?.toLowerCase().includes(searchLower) ||
      record.Id.toLowerCase().includes(searchLower)
    );
  });

  // Handle individual record selection
  const handleRecordToggle = async (recordId: string, isSelected: boolean) => {
    const newSelectedIds = new Set(selectedIds);
    
    if (isSelected) {
      newSelectedIds.add(recordId);
    } else {
      newSelectedIds.delete(recordId);
    }
    
    setSelectedIds(newSelectedIds);
    onSelectionChange(Array.from(newSelectedIds));

    // Update selection on server
    try {
      await fetch(`/api/migrations/${projectId}/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectType,
          recordIds: [recordId],
          action: isSelected ? 'select' : 'deselect'
        })
      });
    } catch (error) {
      console.error('Failed to update record selection:', error);
    }
  };

  // Handle select all/none for current page
  const handleSelectAll = async (selectAll: boolean) => {
    const newSelectedIds = new Set(selectedIds);
    const recordIds = filteredRecords.map(r => r.Id);
    
    if (selectAll) {
      recordIds.forEach(id => newSelectedIds.add(id));
    } else {
      recordIds.forEach(id => newSelectedIds.delete(id));
    }
    
    setSelectedIds(newSelectedIds);
    onSelectionChange(Array.from(newSelectedIds));

    // Update selection on server
    try {
      await fetch(`/api/migrations/${projectId}/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectType,
          recordIds,
          action: selectAll ? 'select' : 'deselect'
        })
      });
    } catch (error) {
      console.error('Failed to update bulk selection:', error);
    }
  };

  // Generate SOQL preview
  const generateSoqlPreview = () => {
    if (selectedIds.size === 0) {
      return `SELECT Id, Name, CreatedDate, LastModifiedDate FROM ${objectType} LIMIT 100`;
    }
    
    const selectedArray = Array.from(selectedIds);
    const idList = selectedArray.slice(0, 5).map(id => `'${id}'`).join(', ');
    const moreText = selectedArray.length > 5 ? ` /* ... and ${selectedArray.length - 5} more */` : '';
    
    return `SELECT Id, Name, CreatedDate, LastModifiedDate FROM ${objectType} WHERE Id IN (${idList}${moreText})`;
  };

  const allCurrentPageSelected = filteredRecords.length > 0 && 
    filteredRecords.every(record => selectedIds.has(record.Id));
  const someCurrentPageSelected = filteredRecords.some(record => selectedIds.has(record.Id));

  if (isLoading) {
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
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load records. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Select Records</h3>
          <p className="text-sm text-muted-foreground">
            Choose which {objectType} records to migrate
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {selectedIds.size} selected
          </Badge>
          <Dialog open={showSoqlPreview} onOpenChange={setShowSoqlPreview}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                Preview SOQL
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>SOQL Query Preview</DialogTitle>
                <DialogDescription>
                  This is the SOQL query that will be used to extract the selected records
                </DialogDescription>
              </DialogHeader>
              <div className="bg-muted p-4 rounded-md">
                <code className="text-sm">{generateSoqlPreview()}</code>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search records..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(parseInt(value))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25 per page</SelectItem>
            <SelectItem value="50">50 per page</SelectItem>
            <SelectItem value="100">100 per page</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Bulk Actions */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={allCurrentPageSelected}
            onCheckedChange={(checked) => handleSelectAll(!!checked)}
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
          <RecordCard
            key={record.Id}
            record={record}
            isSelected={selectedIds.has(record.Id)}
            onToggle={(isSelected) => handleRecordToggle(record.Id, isSelected)}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {currentPage + 1} of {totalPages}
          </div>
          <div className="flex gap-2">
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
          </div>
        </div>
      )}
    </div>
  );
}

function RecordCard({ 
  record, 
  isSelected, 
  onToggle 
}: { 
  record: SalesforceRecord; 
  isSelected: boolean; 
  onToggle: (isSelected: boolean) => void; 
}) {
  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-sm ${
        isSelected ? 'border-primary bg-primary/5' : 'hover:border-gray-300'
      }`}
      onClick={() => onToggle(!isSelected)}
    >
      <CardContent className="p-4">
        <div className="flex items-center space-x-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggle}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{record.Name || 'Unnamed Record'}</span>
              <Badge variant="outline" className="text-xs">
                {record.Id}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>Created: {new Date(record.CreatedDate).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span>Modified: {new Date(record.LastModifiedDate).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 
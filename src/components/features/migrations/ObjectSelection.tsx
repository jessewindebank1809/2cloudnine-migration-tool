'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Search, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

interface SalesforceObject {
  name: string;
  label: string;
  labelPlural: string;
  custom: boolean;
  queryable: boolean;
  createable: boolean;
  fields: Array<{
    name: string;
    label: string;
    type: string;
  }>;
}

interface ObjectSelectionProps {
  sourceOrgId: string;
  targetOrgId: string;
  onSelectionChange: (objects: string[]) => void;
  templateId?: string;
}

// Pre-configured 2cloudnine objects
const RECOMMENDED_OBJECTS = [
  { name: 'tc9_interpretation_rule__c', label: 'Interpretation Rules' },
  { name: 'tc9_breakpoint__c', label: 'Breakpoints' },
  { name: 'tc9_pay_code__c', label: 'Pay Codes' },
  { name: 'tc9_calculation__c', label: 'Calculations' },
  { name: 'tc9_leave_rule__c', label: 'Leave Rules' },
];

export function ObjectSelection({
  sourceOrgId,
  targetOrgId,
  onSelectionChange,
  templateId,
}: ObjectSelectionProps) {
  const [selectedObjects, setSelectedObjects] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [recordCounts, setRecordCounts] = useState<Record<string, number>>({});

  // Fetch available objects from source org
  const { data: objectsData, isLoading, error } = useQuery({
    queryKey: ['salesforce-objects', sourceOrgId, templateId],
    queryFn: async () => {
      console.log('ObjectSelection: Making API call with templateId:', templateId);
      const response = await fetch('/api/salesforce/discover-objects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: sourceOrgId,
          includeStandard: true,
          includeCustom: true,
          objectPatterns: [],
          templateId: templateId
        }),
      });
      if (!response.ok) throw new Error('Failed to fetch objects');
      const result = await response.json();
      console.log('ObjectSelection: API response:', result);
      return result;
    },
    enabled: !!sourceOrgId,
  });

  // Fetch record counts for selected objects
  useEffect(() => {
    if (selectedObjects.size === 0) return;

    const fetchCounts = async () => {
      for (const objectName of Array.from(selectedObjects)) {
        try {
          const response = await fetch(
            `/api/organizations/${sourceOrgId}/query`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: `SELECT COUNT() FROM ${objectName}`,
              }),
            }
          );
          
          if (response.ok) {
            const data = await response.json();
            setRecordCounts(prev => ({
              ...prev,
              [objectName]: data.totalSize || 0,
            }));
          }
        } catch (error) {
          console.error(`Failed to get count for ${objectName}:`, error);
        }
      }
    };

    fetchCounts();
  }, [selectedObjects, sourceOrgId]);

  const handleObjectToggle = (objectName: string) => {
    const newSelection = new Set(selectedObjects);
    if (newSelection.has(objectName)) {
      newSelection.delete(objectName);
    } else {
      newSelection.add(objectName);
    }
    setSelectedObjects(newSelection);
    onSelectionChange(Array.from(newSelection));
  };

  const selectRecommended = () => {
    const recommendedNames = RECOMMENDED_OBJECTS.map(obj => obj.name);
    const available = objects.filter((obj: SalesforceObject) => 
      recommendedNames.includes(obj.name)
    ).map((obj: SalesforceObject) => obj.name);
    
    const newSelection = new Set<string>(available);
    setSelectedObjects(newSelection);
    onSelectionChange(Array.from(newSelection));
  };

  // Filter objects based on search
  const objects = objectsData?.objects || [];
  const filteredObjects = objects.filter((obj: SalesforceObject) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      obj.name.toLowerCase().includes(searchLower) ||
      obj.label.toLowerCase().includes(searchLower)
    );
  });

  // Separate custom and standard objects
  const customObjects = filteredObjects.filter((obj: SalesforceObject) => obj.custom);
  const standardObjects = filteredObjects.filter((obj: SalesforceObject) => !obj.custom);

  // Find recommended objects that exist
  const availableRecommended = objects.filter((obj: SalesforceObject) =>
    RECOMMENDED_OBJECTS.some(rec => rec.name === obj.name)
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load objects from source organization
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      {availableRecommended.length > 0 && !templateId && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={selectRecommended}
            className="whitespace-nowrap"
          >
            Select 2cloudnine Objects
          </Button>
        </div>
      )}

      {/* Selection Summary */}
      {selectedObjects.size > 0 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium">{selectedObjects.size}</span> objects selected
                {Object.keys(recordCounts).length > 0 && (
                  <span className="text-muted-foreground ml-2">
                    ({Object.values(recordCounts).reduce((a, b) => a + b, 0).toLocaleString()} total records)
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommended Objects */}
      {availableRecommended.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Recommended 2cloudnine Objects</h3>
          <div className="grid gap-2">
            {availableRecommended.map((obj: SalesforceObject) => (
              <ObjectCard
                key={obj.name}
                object={obj}
                isSelected={selectedObjects.has(obj.name)}
                onToggle={() => handleObjectToggle(obj.name)}
                recordCount={recordCounts[obj.name]}
                isRecommended
              />
            ))}
          </div>
        </div>
      )}

             {/* No Records Found Message */}
       {objects.length === 0 && templateId && (
         <Alert className="bg-amber-50 border-amber-200">
           <div className="flex items-center">
             <AlertCircle className="h-4 w-4 mr-2 text-amber-600" />
             <AlertDescription className="mb-0 text-amber-800">
               No records found for the selected object: tc9_et__Interpretation_Rule__c.
             </AlertDescription>
           </div>
         </Alert>
       )}

      {/* Custom Objects */}
      {customObjects.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Custom Objects</h3>
          <div className="grid gap-2">
            {customObjects.map((obj: SalesforceObject) => (
              <ObjectCard
                key={obj.name}
                object={obj}
                isSelected={selectedObjects.has(obj.name)}
                onToggle={() => handleObjectToggle(obj.name)}
                recordCount={recordCounts[obj.name]}
              />
            ))}
          </div>
        </div>
      )}

      {/* Standard Objects */}
      {standardObjects.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Standard Objects</h3>
          <div className="grid gap-2">
            {standardObjects.map((obj: SalesforceObject) => (
              <ObjectCard
                key={obj.name}
                object={obj}
                isSelected={selectedObjects.has(obj.name)}
                onToggle={() => handleObjectToggle(obj.name)}
                recordCount={recordCounts[obj.name]}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ObjectCard({
  object,
  isSelected,
  onToggle,
  recordCount,
  isRecommended = false,
}: {
  object: SalesforceObject;
  isSelected: boolean;
  onToggle: () => void;
  recordCount?: number;
  isRecommended?: boolean;
}) {
  return (
    <Card
      className={`cursor-pointer transition-colors ${
        isSelected ? 'border-primary bg-primary/5' : 'hover:border-gray-300'
      }`}
      onClick={onToggle}
    >
      <CardContent className="p-3">
        <div className="flex items-center space-x-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggle}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Label className="font-medium cursor-pointer">
                {object.label}
              </Label>
              {isRecommended && (
                <Badge variant="secondary" className="text-xs">
                  Recommended
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {object.name}
              {recordCount !== undefined && (
                <span className="ml-2">
                  • {recordCount.toLocaleString()} records
                </span>
              )}
            </div>
          </div>
          {isSelected && (
            <Check className="h-4 w-4 text-primary" />
          )}
        </div>
      </CardContent>
    </Card>
  );
} 
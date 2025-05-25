'use client';

import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import type { SalesforceObject } from '@/lib/salesforce/object-discovery';

interface ObjectSelectorProps {
  orgId: string;
  onObjectsSelected: (objects: string[]) => void;
  selectedObjects?: string[];
}

interface ObjectGroup {
  name: string;
  label: string;
  objects: SalesforceObject[];
}

export function ObjectSelector({ 
  orgId, 
  onObjectsSelected, 
  selectedObjects = [] 
}: ObjectSelectorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [objects, setObjects] = useState<SalesforceObject[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedObjects));
  const [searchQuery, setSearchQuery] = useState('');
  const [showStandard, setShowStandard] = useState(false);

  useEffect(() => {
    loadObjects();
  }, [orgId, showStandard]);

  const loadObjects = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/salesforce/discover-objects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          orgId,
          includeStandard: showStandard,
          includeCustom: true 
        }),
      });

      if (!response.ok) throw new Error('Failed to load objects');
      
      const data = await response.json();
      setObjects(data.objects || []);
    } catch (error) {
      console.error('Error loading objects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const groupObjectsByCategory = (): ObjectGroup[] => {
    const groups: { [key: string]: ObjectGroup } = {
      tc9: {
        name: 'tc9',
        label: '2cloudnine Objects',
        objects: [],
      },
      custom: {
        name: 'custom',
        label: 'Custom Objects',
        objects: [],
      },
      standard: {
        name: 'standard',
        label: 'Standard Objects',
        objects: [],
      },
    };

    objects.forEach(obj => {
      if (obj.name.toLowerCase().includes('tc9_')) {
        groups.tc9.objects.push(obj);
      } else if (obj.custom) {
        groups.custom.objects.push(obj);
      } else {
        groups.standard.objects.push(obj);
      }
    });

    return Object.values(groups).filter(g => g.objects.length > 0);
  };

  const toggleObject = (objectName: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(objectName)) {
      newSelected.delete(objectName);
    } else {
      newSelected.add(objectName);
    }
    setSelected(newSelected);
    onObjectsSelected(Array.from(newSelected));
  };

  const selectAll = (group: ObjectGroup) => {
    const newSelected = new Set(selected);
    group.objects.forEach(obj => newSelected.add(obj.name));
    setSelected(newSelected);
    onObjectsSelected(Array.from(newSelected));
  };

  const deselectAll = (group: ObjectGroup) => {
    const newSelected = new Set(selected);
    group.objects.forEach(obj => newSelected.delete(obj.name));
    setSelected(newSelected);
    onObjectsSelected(Array.from(newSelected));
  };

  const filteredGroups = groupObjectsByCategory().map(group => ({
    ...group,
    objects: group.objects.filter(obj =>
      obj.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      obj.label.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter(g => g.objects.length > 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Discovering objects...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search objects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-64 rounded-md border border-input bg-background pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <label className="flex items-center space-x-2">
            <Checkbox
              checked={showStandard}
              onCheckedChange={(checked: boolean) => setShowStandard(checked)}
            />
            <span className="text-sm">Include standard objects</span>
          </label>
        </div>
        <Badge variant="secondary">
          {selected.size} object{selected.size !== 1 ? 's' : ''} selected
        </Badge>
      </div>

      <div className="space-y-6">
        {filteredGroups.map((group) => {
          const allSelected = group.objects.every(obj => selected.has(obj.name));
          const someSelected = group.objects.some(obj => selected.has(obj.name));

          return (
            <Card key={group.name} className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">{group.label}</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">
                    {group.objects.length} objects
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => allSelected ? deselectAll(group) : selectAll(group)}
                  >
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
              </div>
              
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {group.objects.map((object) => (
                  <label
                    key={object.name}
                    className="flex cursor-pointer items-center space-x-3 rounded-lg border p-3 hover:bg-accent/50"
                  >
                    <Checkbox
                      checked={selected.has(object.name)}
                      onCheckedChange={() => toggleObject(object.name)}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{object.label}</div>
                      <div className="text-xs text-muted-foreground">{object.name}</div>
                    </div>
                  </label>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {filteredGroups.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            {searchQuery ? 'No objects match your search' : 'No objects found'}
          </p>
        </div>
      )}
    </div>
  );
} 
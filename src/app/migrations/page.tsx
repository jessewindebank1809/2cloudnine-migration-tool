'use client';

import React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MigrationProjectList } from '@/components/features/migrations/MigrationProjectList';
import { useRunningMigrations } from '@/hooks/useRunningMigrations';
import { useQuery } from '@tanstack/react-query';

export default function MigrationsPage() {
  const { hasRunningMigration } = useRunningMigrations();
  
  const { data } = useQuery({
    queryKey: ['migration-projects'],
    queryFn: async () => {
      const response = await fetch('/api/migrations');
      if (!response.ok) {
        throw new Error('Failed to fetch migration projects');
      }
      return response.json();
    },
  });

  const hasProjects = (data?.projects?.length ?? 0) > 0;

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Migration Projects</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage data migrations between Salesforce organisations
          </p>
        </div>
        {hasProjects && (
          hasRunningMigration ? (
            <Button 
              disabled={true}
              title="Cannot start new migration while another is in progress"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Migration
            </Button>
          ) : (
            <Link href="/migrations/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Migration
              </Button>
            </Link>
          )
        )}
      </div>

      <MigrationProjectList />
    </div>
  );
} 
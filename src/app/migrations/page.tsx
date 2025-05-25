'use client';

import React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MigrationProjectList } from '@/components/features/migrations/MigrationProjectList';

export default function MigrationsPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Migration Projects</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage data migrations between Salesforce organizations
          </p>
        </div>
        <Link href="/migrations/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Migration
          </Button>
        </Link>
      </div>

      <MigrationProjectList />
    </div>
  );
} 
'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MigrationProjectBuilder } from '@/components/features/migrations/MigrationProjectBuilder';

export default function NewMigrationPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <Link href="/migrations">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Migrations
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Create Migration Project</h1>
        <p className="text-muted-foreground mt-2">
          Set up a new data migration between your Salesforce organizations
        </p>
      </div>

      <MigrationProjectBuilder />
    </div>
  );
} 
'use client';

import React, { Suspense } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { MigrationProjectBuilder } from '@/components/features/migrations/MigrationProjectBuilder';

function MigrationBuilderWithParams() {
  const searchParams = useSearchParams();
  const templateId = searchParams.get('template');
  
  return <MigrationProjectBuilder defaultTemplateId={templateId} />;
}

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
          Set up a new data migration between your Salesforce organisations
        </p>
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <MigrationBuilderWithParams />
      </Suspense>
    </div>
  );
} 
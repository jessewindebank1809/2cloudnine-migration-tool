import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function FastHomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container py-24">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold text-slate-900 mb-6">
            Fast Salesforce Migration
          </h1>
          <p className="text-xl text-slate-600 mb-8">
            Optimised for speed testing - no auth checks, minimal processing.
          </p>
          <Link href="/auth/signin">
            <Button size="lg" className="bg-[#2491EB] hover:bg-[#2491EB]/90">
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
} 
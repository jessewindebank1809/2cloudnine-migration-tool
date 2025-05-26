'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRight, 
  Zap, 
  Shield, 
  Clock, 
  CheckCircle,
  Database,
  Users,
  BarChart3
} from 'lucide-react';
import Link from 'next/link';

export default function LandingPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if user is already authenticated using Better Auth
    const checkAuth = async () => {
      try {
        const { authClient } = await import('@/lib/auth/client');
        const sessionData = await authClient.getSession();
        setIsAuthenticated(!!sessionData?.data?.user);
      } catch (error) {
        console.error('Auth check error:', error);
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  const features = [
    {
      icon: Zap,
      title: "Zero Installation",
      description: "No Salesforce components required. Complete external solution with automated Connected App creation."
    },
    {
      icon: Clock,
      title: "2-Minute Setup",
      description: "From signup to first migration in under 2 minutes. Automated configuration eliminates manual setup."
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "AES-256-GCM encryption, OAuth 2.0, and secure credential handling. Never stores passwords."
    },
    {
      icon: Database,
      title: "Invisible Field Mapping",
      description: "Zero configuration required. All field mappings handled automatically by expert backend logic."
    }
  ];

  const stats = [
    { label: "Setup Time", value: "< 2 min", description: "From signup to migration" },
    { label: "Migration Speed", value: "1000+", description: "Records per minute" },
    { label: "Success Rate", value: "99.9%", description: "Migration accuracy" },
    { label: "API Efficiency", value: "Optimal", description: "Salesforce API usage" }
  ];

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    router.replace('/home');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="border-b border-blue-200/50 bg-white/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-auto flex items-center justify-center">
              <img 
                src="/Cloudnine Reversed Standard 2.png" 
                alt="2cloudnine Logo" 
                className="h-10 w-auto"
              />
            </div>
            <span className="font-bold text-xl text-slate-800">Migration Tool</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/auth/signin">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/auth/signin">
              <Button className="bg-[#2491EB] hover:bg-[#2491EB]/90">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container py-24">
        <div className="text-center max-w-4xl mx-auto">
          <Badge variant="secondary" className="mb-6 bg-blue-100 text-blue-800">
            Revolutionary Salesforce Migration Platform
          </Badge>
          <h1 className="text-5xl font-bold text-slate-900 mb-6 leading-tight">
            Seamless Salesforce Data Migration
            <span className="text-[#2491EB]"> Without the Complexity</span>
          </h1>
          <p className="text-xl text-slate-600 mb-8 leading-relaxed">
            The first truly external Salesforce migration platform. Zero installation, 
            automated setup, and invisible field mapping. Migrate interpretation rules, 
            pay codes, and any custom objects with enterprise-grade reliability.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signin">
              <Button size="lg" className="bg-[#2491EB] hover:bg-[#2491EB]/90 text-lg px-8">
                Start Free Migration
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="text-lg px-8">
              View Documentation
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="container py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-3xl font-bold text-[#2491EB] mb-2">{stat.value}</div>
              <div className="font-medium text-slate-900 mb-1">{stat.label}</div>
              <div className="text-sm text-slate-600">{stat.description}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="container py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            Why Choose 2cloudnine Migration Tool?
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Built from the ground up to eliminate the complexity and friction of traditional Salesforce migration tools.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-[#2491EB]" />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-slate-600">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container py-24 bg-white/50 rounded-3xl mx-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            Migration in 4 Simple Steps
          </h2>
          <p className="text-lg text-slate-600">
            From connection to completion in minutes, not hours.
          </p>
        </div>
        <div className="grid md:grid-cols-4 gap-8">
          {[
            {
              step: "1",
              title: "Connect Orgs",
              description: "Automated Connected App creation with one-click OAuth setup"
            },
            {
              step: "2", 
              title: "Select Template",
              description: "Choose from pre-configured 2cloudnine migration templates"
            },
            {
              step: "3",
              title: "Pick Records",
              description: "Multi-select interface with intelligent filtering and preview"
            },
            {
              step: "4",
              title: "Execute & Monitor",
              description: "Real-time progress tracking with detailed success reporting"
            }
          ].map((step, index) => (
            <div key={index} className="text-center">
              <div className="w-12 h-12 bg-[#2491EB] text-white rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-4">
                {step.step}
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{step.title}</h3>
              <p className="text-slate-600">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container py-24 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            Ready to Transform Your Salesforce Migrations?
          </h2>
          <p className="text-lg text-slate-600 mb-8">
            Join the revolution in Salesforce data migration. No setup fees, no hidden costs, no complexity.
          </p>
          <Link href="/auth/signin">
            <Button size="lg" className="bg-[#2491EB] hover:bg-[#2491EB]/90 text-lg px-8">
              Start Your First Migration
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="container py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <img 
                src="/Cloudnine Reversed Standard 2.png" 
                alt="2cloudnine Logo" 
                className="h-8 w-auto"
              />
              <span className="font-semibold text-slate-800">Migration Tool</span>
            </div>
            <div className="text-sm text-slate-600">
              © 2024 2cloudnine. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
} 
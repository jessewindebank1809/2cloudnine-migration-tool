"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, User } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { motion } from "framer-motion";
import { useAdminStatus } from "@/hooks/useAdminStatus";
import { FeedbackButton } from "@/components/features/feedback";

interface AppNavigationProps {
  children: React.ReactNode;
}

export function AppNavigation({ children }: AppNavigationProps) {
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredNavItem, setHoveredNavItem] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { isAdmin } = useAdminStatus();

  // Detect if we're in staging environment
  const isStaging =
    typeof window !== "undefined"
      ? window.location.hostname.includes("staging")
      : process.env.FLY_APP_NAME?.includes("staging");

  // Detect if we're in local development environment
  const isLocal =
    typeof window !== "undefined"
      ? window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
      : process.env.NODE_ENV === "development";

  // Navigation items configuration
  const baseNavItems = [
    { id: "home", label: "Home", href: "/home" },
    { id: "orgs", label: "Organisations", href: "/orgs" },
    { id: "migrations", label: "Migrations", href: "/migrations" },
    { id: "templates", label: "Templates", href: "/templates" },
    { id: "analytics", label: "Analytics", href: "/analytics" },
  ];

  const adminNavItems = [{ id: "usage", label: "Usage", href: "/usage" }];

  const navItems = isAdmin ? [...baseNavItems, ...adminNavItems] : baseNavItems;

  // Check authentication and get session
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Use Better Auth session only
        const sessionData = await authClient.getSession();
        if (sessionData?.data?.user) {
          setSession(sessionData.data);
        } else {
          router.replace("/auth/signin");
        }
      } catch (error) {
        router.replace("/auth/signin");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleSignOut = async () => {
    try {
      // Use Better Auth's signOut method
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            // Redirect to signin page after successful logout
            router.replace("/auth/signin");
          },
          onError: (error) => {
            // Ignore session deletion errors during development
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            if (errorMessage.includes("Record to delete does not exist")) {
              console.warn("Session already deleted (normal in development)");
            } else {
              console.error("Sign out error:", error);
            }
            // Force redirect even if logout fails
            router.replace("/auth/signin");
          },
        },
      });
    } catch (error) {
      // Ignore session deletion errors during development
      if (
        error instanceof Error &&
        error.message.includes("Record to delete does not exist")
      ) {
        console.warn("Session already deleted (normal in development)");
      } else {
        console.error("Sign out error:", error);
      }
      // Force redirect even if logout fails
      router.replace("/auth/signin");
    }
  };

  // Public routes that don't need navigation
  const publicRoutes = ["/auth/signin", "/auth/signup", "/auth/error"];
  const isPublicRoute = publicRoutes.includes(pathname);

  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session?.user) {
    return null; // Will redirect
  }

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + "/");

  const handleNavItemHover = (navId: string) => {
    setHoveredNavItem(navId);
  };

  const handleNavItemMouseLeave = () => {
    setHoveredNavItem(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-[#2491EB]/20 bg-[#2491EB]">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-auto flex items-center justify-center">
              <Image
                src="/Cloudnine Reversed Standard 2.png"
                alt="2cloudnine Logo"
                width={120}
                height={40}
                className="h-10 w-auto"
              />
            </div>
            <span className="font-bold text-xl text-white">
              Migration Tool{isLocal && " (Local)"}
              {isStaging && " (Staging)"}
            </span>
          </div>
          <nav className="flex items-center space-x-1">
            {navItems.map((nav) => (
              <div
                key={nav.id}
                className="relative"
                onMouseEnter={() => handleNavItemHover(nav.id)}
                onMouseLeave={handleNavItemMouseLeave}
              >
                <Link
                  href={nav.href}
                  className={`relative z-10 px-4 py-2 text-sm font-medium transition-colors rounded-lg ${
                    isActive(nav.href)
                      ? "text-white font-semibold"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  {nav.label}
                </Link>
                {/* Hover background */}
                {hoveredNavItem === nav.id && (
                  <motion.div
                    layoutId="navbar-hover"
                    className="absolute inset-0 bg-white/10 rounded-lg"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                      duration: 0.15,
                    }}
                  />
                )}
                {/* Active background */}
                {isActive(nav.href) && (
                  <motion.div
                    layoutId="navbar-active"
                    className="absolute inset-0 bg-white/20 rounded-lg"
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                      duration: 0.2,
                    }}
                  />
                )}
              </div>
            ))}
            <div className="flex items-center space-x-4 ml-6 pl-6 border-l border-white/20">
              <div className="flex items-center space-x-2 text-white">
                <User className="h-4 w-4" />
                <span className="text-sm">
                  {session.user.name || session.user.email}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-white/80 hover:text-white hover:bg-white/10"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </nav>
        </div>
      </header>

      <main>{children}</main>

      {/* Feedback Button - shown on all authenticated pages */}
      <FeedbackButton />
    </div>
  );
}

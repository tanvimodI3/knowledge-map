"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { DashboardSidebar, MobileHeader } from "@/components/dashboard/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/context/auth-context";
import { MapsProvider } from "@/context/maps-context";

// Wraps every /dashboard/* route: auth guard + sidebar + maps store.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Client-side guard. BACKEND: also verify the Firebase ID token on every API
  // request server-side — this redirect is a UX nicety, not security.
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <MapsProvider>
      <div className="flex min-h-svh bg-background">
        <DashboardSidebar />
        <div className="min-w-0 flex-1">
          <MobileHeader />
          <main className="mx-auto max-w-6xl p-6 md:p-8">{children}</main>
        </div>
      </div>
      <Toaster />
    </MapsProvider>
  );
}

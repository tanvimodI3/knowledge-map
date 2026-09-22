"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-[#F6F5F1]">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="font-serif text-3xl">
          Welcome{user.displayName ? `, ${user.displayName}` : ""}
        </h1>
        <p className="mt-2 text-sm text-[#1B1D23]/65">
          Signed in as {user.email}
        </p>
        <Button variant="outline" className="mt-8" onClick={() => signOut()}>
          Sign out
        </Button>
      </main>
    </div>
  );
}
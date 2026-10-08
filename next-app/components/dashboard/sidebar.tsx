"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, LogOut } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/auth-context";
import { useMaps } from "@/context/maps-context";
import { cn } from "@/lib/utils";

const linkClass = (active: boolean) =>
  cn(
    "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
    active
      ? "bg-muted font-medium text-foreground"
      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
  );

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { maps } = useMaps();

  const name = user?.displayName ?? user?.email ?? "You";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  return (
    <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r bg-background md:flex">
      <div className="px-5 py-5">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Yourbrand
        </Link>
      </div>

      <nav className="px-3">
        <Link href="/dashboard" className={linkClass(pathname === "/dashboard")}>
          <LayoutDashboard className="size-4" />
          Overview
        </Link>
      </nav>

      <Separator className="my-4" />
      <p className="px-5 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Your maps
      </p>

      <ScrollArea className="min-h-0 flex-1 px-3">
        <div className="space-y-0.5 pb-4">
          {maps.length === 0 && (
            <p className="px-2.5 text-sm text-muted-foreground">No maps yet.</p>
          )}
          {maps.map((map) => (
            <Link
              key={map.id}
              href={`/dashboard/maps/${map.id}`}
              className={linkClass(pathname === `/dashboard/maps/${map.id}`)}
            >
              <span className="truncate">{map.title}</span>
            </Link>
          ))}
        </div>
      </ScrollArea>

      <Separator />
      <div className="flex items-center gap-2 p-3">
        <Avatar className="size-8">
          <AvatarImage src={user?.photoURL ?? undefined} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
          {user?.displayName && (
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          )}
        </div>
        <Button variant="ghost" size="icon" aria-label="Sign out" onClick={handleSignOut}>
          <LogOut className="size-4" />
        </Button>
      </div>
    </aside>
  );
}

// Compact header shown on small screens instead of the sidebar.
export function MobileHeader() {
  const router = useRouter();
  const { signOut } = useAuth();

  return (
    <header className="flex h-14 items-center justify-between border-b px-4 md:hidden">
      <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
        Yourbrand
      </Link>
      <Button
        variant="ghost"
        size="sm"
        onClick={async () => {
          await signOut();
          router.push("/");
        }}
      >
        Sign out
      </Button>
    </header>
  );
}

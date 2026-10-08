"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMaps } from "@/context/maps-context";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateMapDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const { createMap } = useMaps();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  function handleOpenChange(next: boolean) {
    if (!next) {
      setTitle("");
      setDescription("");
    }
    onOpenChange(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    // BACKEND: createMap() should await POST /api/maps. Show a loading state on the
    // button while it runs and surface errors with toast.error().
    const map = createMap({ title: title.trim(), description: description.trim() });

    toast.success(`Created “${map.title}”`);
    handleOpenChange(false);
    router.push(`/dashboard/maps/${map.id}`); // jump straight in to start adding skills
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>New knowledge map</DialogTitle>
            <DialogDescription>
              A map is a set of skills and how they connect. You&apos;ll add skills next.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="map-title">Title</Label>
            <Input
              id="map-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Machine Learning Engineer"
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="map-description">
              Description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="map-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this map for?"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              Create map
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

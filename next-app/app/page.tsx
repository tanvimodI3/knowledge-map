import Link from "next/link";
import { ArrowUpRight, GitBranch, Search, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";
import { KnowledgeGraph } from "@/components/knowledge-graph";

const FEATURES = [
  {
    icon: GitBranch,
    title: "Connections, not folders",
    body: "Every note links to what it came from and what it led to. The structure builds itself as you work.",
  },
  {
    icon: Search,
    title: "Nothing gets buried",
    body: "Search by meaning, not just keywords. Find the note you half-remember writing three months ago.",
  },
  {
    icon: Sparkles,
    title: "See the shape of your thinking",
    body: "Zoom out and watch clusters form around what you actually care about, not what you filed where.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-svh bg-[#FAFAF8] text-[#1B1D23]">
      <Navbar />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-20 md:pb-28 md:pt-24">
        <div className="grid gap-12 md:grid-cols-[1fr_1fr] md:items-center">
          <div>
            <p className="mb-6 font-mono text-xs text-[#2A4B7C]">
              002 — now in open beta
            </p>
            <h1 className="max-w-lg font-serif text-5xl leading-[1.05] tracking-tight md:text-6xl">
              Your notes were always connected. Now you can see it.
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-[#1B1D23]/70">
              Cortex turns scattered notes, sources, and half-formed ideas
              into a living map — every piece linked to where it came from
              and where it's going.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button
                size="lg"
                className="bg-[#2A4B7C] text-white hover:bg-[#223d66]"
                asChild
              >
                <Link href="/signup">
                  Map your first notes
                  <ArrowUpRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Link
                href="/login"
                className="text-sm font-medium text-[#1B1D23]/70 underline underline-offset-4 hover:text-[#1B1D23]"
              >
                I already have an account
              </Link>
            </div>
          </div>

          <KnowledgeGraph />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-[#1B1D23]/10 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="max-w-md font-serif text-3xl tracking-tight">
            Everything you need, nothing you have to configure.
          </h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <Icon className="h-5 w-5 text-[#2A4B7C]" strokeWidth={1.5} />
                <h3 className="mt-4 text-base font-medium">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#1B1D23]/65">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-24">
        <div className="flex flex-col items-start justify-between gap-8 border border-[#1B1D23]/10 bg-white p-10 md:flex-row md:items-center">
          <div>
            <h2 className="font-serif text-2xl tracking-tight">
              Free while in beta. No card required.
            </h2>
            <p className="mt-2 text-sm text-[#1B1D23]/65">
              Import your notes and see the map in under two minutes.
            </p>
          </div>
          <Button
            size="lg"
            className="bg-[#2A4B7C] text-white hover:bg-[#223d66]"
            asChild
          >
            <Link href="/signup">Get started</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-[#1B1D23]/10 py-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 text-xs text-[#1B1D23]/50">
          <span>© {new Date().getFullYear()} Cortex</span>
          <span className="font-mono">built with next.js + firebase</span>
        </div>
      </footer>
    </div>
  );
}
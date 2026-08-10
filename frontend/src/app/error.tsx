"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ApplicationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden p-6">
      <div className="paint-backdrop" aria-hidden="true" />
      <section className="app-surface relative z-10 w-full max-w-lg rounded-3xl border border-white/10 p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-destructive/12 text-destructive">
          <AlertTriangle />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-[-0.035em]">
          ChatSaver hit a local error.
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Your browser data has not been intentionally cleared. Retry the interface first; if the
          problem continues, restore your latest vault backup.
        </p>
        {error.digest ? (
          <p className="mt-4 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            Reference {error.digest}
          </p>
        ) : null}
        <Button className="royal-glow mt-6" onClick={reset}>
          <RotateCcw />
          Retry ChatSaver
        </Button>
      </section>
    </main>
  );
}

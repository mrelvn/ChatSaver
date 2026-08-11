"use client";

import { FormEvent, useState } from "react";
import { Cloud, Copy, Download, LoaderCircle, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { AuthSession } from "@/lib/sync";
import { loginAccount, logoutAccount, registerAccount } from "@/lib/sync";

interface AccountDialogProps {
  open: boolean;
  session?: AuthSession;
  syncing: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthenticated: (session: AuthSession) => void;
  onLoggedOut: () => void;
  onSync: () => void;
}

export function AccountDialog({
  open,
  session,
  syncing,
  onOpenChange,
  onAuthenticated,
  onLoggedOut,
  onSync,
}: AccountDialogProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const nextSession = mode === "register"
        ? await registerAccount({ email, password, displayName })
        : await loginAccount({ email, password });
      onAuthenticated(nextSession);
      toast.success(mode === "register" ? "Account created" : "Welcome back", {
        description: "Your local vault is syncing with PostgreSQL.",
      });
    } catch (error) {
      toast.error(mode === "register" ? "Could not create account" : "Could not sign in", {
        description: error instanceof Error ? error.message : "Please check the API and try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await logoutAccount();
      onLoggedOut();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] overflow-x-hidden overflow-y-auto overscroll-contain border-white/10 bg-[#0b090a]/96 p-0 shadow-[0_28px_90px_rgba(0,0,0,.58),0_0_70px_oklch(0.48_0.2_24/.12)] sm:max-h-[calc(100dvh-2rem)] sm:w-full sm:max-w-[440px]">
        <div className="h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
        <DialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6">
          <div className="mb-1 grid size-10 place-items-center rounded-xl border border-primary/25 bg-primary/12 text-primary shadow-[0_12px_34px_oklch(0.5_0.22_24/.18)] sm:mb-2 sm:size-11 sm:rounded-2xl">
            {session ? <ShieldCheck /> : <Cloud />}
          </div>
          <DialogTitle className="pe-7 text-xl tracking-[-0.04em] sm:text-[1.35rem]">
            {session
              ? "Your synced vault"
              : mode === "register"
                ? "Take your library anywhere"
                : "Welcome back to your vault"}
          </DialogTitle>
          <DialogDescription className="max-w-sm text-xs leading-relaxed sm:text-sm">
            {session
              ? `Signed in as ${session.user.email}. Your IndexedDB vault remains the fast local source.`
              : mode === "register"
                ? "Create an account only when you want access to your PostgreSQL cloud vault."
                : "Sign in to restore and sync your library. Your local vault stays available without an account."}
          </DialogDescription>
        </DialogHeader>

        {session ? (
          <div className="mx-4 mb-4 rounded-2xl border border-white/8 bg-white/[0.035] p-4 sm:mx-6 sm:mb-6">
            <p className="text-sm font-medium">{session.user.displayName || session.user.email}</p>
            <p className="mt-1 text-xs text-muted-foreground">{session.user.email}</p>
            <div className="mt-4 flex gap-2">
              <Button className="flex-1" onClick={onSync} disabled={syncing}>
                {syncing ? <LoaderCircle className="animate-spin" /> : <Cloud />}
                {syncing ? "Syncing…" : "Sync now"}
              </Button>
              <Button variant="outline" onClick={() => void logout()} disabled={busy}>
                <LogOut />
                Sign out
              </Button>
            </div>
          </div>
        ) : (
          <form className="space-y-3 px-4 pb-4 sm:space-y-4 sm:px-6 sm:pb-6" onSubmit={submit}>
            <div className="grid grid-cols-2 rounded-xl border border-white/8 bg-black/25 p-1">
              <Button type="button" size="sm" variant={mode === "login" ? "secondary" : "ghost"} aria-pressed={mode === "login"} onClick={() => setMode("login")}>
                Sign in
              </Button>
              <Button type="button" size="sm" variant={mode === "register" ? "secondary" : "ghost"} aria-pressed={mode === "register"} onClick={() => setMode("register")}>
                Sign up
              </Button>
            </div>
            {mode === "register" ? (
              <label className="grid gap-1.5 text-xs text-muted-foreground">
                Display name
                <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={160} placeholder="Vivek" />
              </label>
            ) : null}
            <label className="grid gap-1.5 text-xs text-muted-foreground">
              Email
              <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required placeholder="you@example.com" />
            </label>
            <label className="grid gap-1.5 text-xs text-muted-foreground">
              Password
              <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={mode === "register" ? 12 : undefined} maxLength={72} placeholder={mode === "register" ? "At least 12 characters" : "Your password"} />
            </label>
            <Button className="royal-glow h-10 w-full" type="submit" disabled={busy}>
              {busy ? <LoaderCircle className="animate-spin" /> : <Cloud />}
              {busy ? "Connecting…" : mode === "register" ? "Create account and sync" : "Sign in and restore"}
            </Button>

            <div className="rounded-xl border border-white/7 bg-white/[0.025] px-3.5 py-2.5 sm:py-3">
              <p className="text-[11px] font-medium text-foreground">No account required</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Download className="size-3 text-primary" />Download .md</span>
                <span className="inline-flex items-center gap-1.5"><Copy className="size-3 text-primary" />Copy as text</span>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

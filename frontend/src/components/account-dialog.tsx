"use client";

import { FormEvent, useState } from "react";
import { Cloud, LoaderCircle, LogOut, ShieldCheck } from "lucide-react";
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
      toast.error("Could not sign in", {
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
      <DialogContent className="border-white/10 bg-[#0b090a]/96 sm:max-w-md">
        <DialogHeader>
          <div className="mb-3 grid size-11 place-items-center rounded-2xl border border-primary/25 bg-primary/12 text-primary">
            {session ? <ShieldCheck /> : <Cloud />}
          </div>
          <DialogTitle className="text-xl tracking-[-0.035em]">
            {session ? "Your synced vault" : "Recover your library anywhere"}
          </DialogTitle>
          <DialogDescription>
            {session
              ? `Signed in as ${session.user.email}. Your IndexedDB vault remains the fast local source.`
              : "Work offline first. Sign in when connected to back up and restore your notes from PostgreSQL."}
          </DialogDescription>
        </DialogHeader>

        {session ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
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
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid grid-cols-2 rounded-xl border border-white/8 bg-black/20 p-1">
              <Button type="button" size="sm" variant={mode === "login" ? "secondary" : "ghost"} onClick={() => setMode("login")}>
                Sign in
              </Button>
              <Button type="button" size="sm" variant={mode === "register" ? "secondary" : "ghost"} onClick={() => setMode("register")}>
                Create account
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
            <DialogFooter>
              <Button className="w-full" type="submit" disabled={busy}>
                {busy ? <LoaderCircle className="animate-spin" /> : <Cloud />}
                {busy ? "Connecting…" : mode === "register" ? "Create and sync" : "Sign in and restore"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

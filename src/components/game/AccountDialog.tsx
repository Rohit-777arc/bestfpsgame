import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createAccount, setName, signIn } from "@/game/progress";
import { useProgress } from "./useProgress";

const WELCOME_KEY = "mso-welcomed-v1";

/** Shows the account-or-guest choice once on a player's first visit. */
export function FirstVisitPrompt() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem(WELCOME_KEY)) setOpen(true);
  }, []);
  return (
    <AccountDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) localStorage.setItem(WELCOME_KEY, "1");
      }}
      firstVisit
    />
  );
}

export function AccountDialog({
  open,
  onOpenChange,
  firstVisit = false,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  firstVisit?: boolean;
}) {
  const p = useProgress();
  const [tab, setTab] = useState<"guest" | "signup" | "signin">("guest");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setNameInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (open) setNameInput(p.kind === "loading" ? "" : p.name);
  }, [open, p.kind, p.name]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-lg border-[3px] border-[var(--mso-ink)] bg-background px-3 py-2 font-bold text-foreground outline-none focus:border-primary";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mso-panel max-w-md border-[3px]" data-first-visit={firstVisit ? "true" : undefined}>
        <DialogHeader>
          <DialogTitle className="mso-display text-3xl text-primary">
            {firstVisit ? "WELCOME, GUNSLINGER" : p.kind === "account" ? "YOUR ACCOUNT" : "SAVE YOUR PROGRESS"}
          </DialogTitle>
          <DialogDescription>
            {p.kind === "account"
              ? `Signed in${p.email ? ` as ${p.email}` : ""}. Your credits and weapons follow you to any device.`
              : "Create an account to keep credits on every device, or jump in as a guest — guest progress stays in this browser."}
          </DialogDescription>
        </DialogHeader>

        {p.kind !== "account" && (
          <div className="flex gap-2">
            {(["guest", "signup", "signin"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 rounded-lg border-[3px] border-[var(--mso-ink)] px-2 py-1.5 text-sm font-bold ${tab === t ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
              >
                {t === "guest" ? "Guest" : t === "signup" ? "Create account" : "Sign in"}
              </button>
            ))}
          </div>
        )}

        {(tab === "guest" || p.kind === "account") && (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                if (name.trim()) await setName(name);
                onOpenChange(false);
              });
            }}
          >
            <label className="text-sm font-bold">Player name</label>
            <input className={input} value={name} maxLength={24} onChange={(e) => setNameInput(e.target.value)} />
            <button className="mso-btn" disabled={busy}>
              {p.kind === "account" ? "SAVE" : "PLAY AS GUEST"}
            </button>
          </form>
        )}

        {p.kind !== "account" && tab !== "guest" && (
          sent ? (
            <p className="font-bold">Check your inbox — click the link we sent to finish creating your account. Your guest credits will move over when you sign in.</p>
          ) : (
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  if (tab === "signup") {
                    await createAccount(email, password, name || "Player");
                    setSent(true);
                  } else {
                    await signIn(email, password);
                    toast.success("Signed in — progress synced");
                    onOpenChange(false);
                  }
                });
              }}
            >
              {tab === "signup" && (
                <input className={input} placeholder="Player name" value={name} maxLength={24} onChange={(e) => setNameInput(e.target.value)} />
              )}
              <input className={input} type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className={input} type="password" required minLength={6} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button className="mso-btn" disabled={busy}>
                {tab === "signup" ? "CREATE ACCOUNT" : "SIGN IN"}
              </button>
            </form>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}

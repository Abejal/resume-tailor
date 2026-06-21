import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Copy, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { toast } from "sonner";
import { Paywall } from "@/components/Paywall";
import { BrandMark } from "@/components/BrandMark";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { cn } from "@/lib/utils";

type Sub = {
  plan: "monthly" | "annual";
  status: string;
  current_period_end: string | null;
};
type Payment = {
  id: string; amount: number; kind: string; status: string;
  credits_granted: number; created_at: string;
};

export default function Billing() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { credits } = useCredits();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [sub, setSub] = useState<Sub | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [referralCode, setReferralCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  useEffect(() => {
    const paid = params.get("paid");
    if (paid === "topup") toast.success("5 credits added!");
    else if (paid === "monthly" || paid === "annual") toast.success("Pro pack activated!");
  }, [params]);

  // If we landed here after signup with ?intent=monthly|annual|topup, auto-open the paywall preselected
  useEffect(() => {
    const intent = params.get("intent");
    if (intent === "monthly" || intent === "annual" || intent === "topup") {
      setPaywallOpen(true);
    }
  }, [params]);

  const intent = params.get("intent");
  const initialTab: "subscribe" | "topup" = intent === "topup" ? "topup" : "subscribe";
  const initialPlan: "monthly" | "annual" = intent === "annual" ? "annual" : "monthly";

  useEffect(() => {
    if (authLoading) return;
    if (!user) { nav("/login?next=/billing"); return; }
    (async () => {
      const [{ data: subRow }, { data: payRows }, { data: profile }] = await Promise.all([
        supabase.from("subscriptions").select("plan,status,current_period_end")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("payments").select("id,amount,kind,status,credits_granted,created_at")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("profiles").select("referral_code").eq("id", user.id).maybeSingle(),
      ]);
      setSub(subRow as Sub | null);
      setPayments((payRows ?? []) as Payment[]);
      setReferralCode(profile?.referral_code ?? "");
    })();
  }, [user, authLoading, nav]);

  const referralLink = referralCode ? `${window.location.origin}/r/${referralCode}` : "";

  const isProActive = sub?.status === "active" && sub.current_period_end &&
    new Date(sub.current_period_end) > new Date();

  const planName = isProActive
    ? sub!.plan === "monthly" ? "Pro Monthly" : "Pro Annual"
    : "Free";

  const daysLeft = sub?.current_period_end
    ? Math.max(0, Math.ceil((new Date(sub.current_period_end).getTime() - Date.now()) / 86400000))
    : 0;
  const totalDays = sub?.plan === "annual" ? 365 : 30;
  const pct = isProActive ? Math.min(100, (daysLeft / totalDays) * 100) : 0;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Copied");
    setTimeout(() => setCopied(false), 1500);
  };

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const statusTone = (s: string) =>
    s === "paid" ? "bg-success-soft text-success border border-success/30"
      : s === "pending" ? "bg-accent-soft text-warning border border-warning/30"
      : "bg-muted text-muted-foreground border border-border";

  return (
    <div className="min-h-screen bg-background relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[400px] bg-gradient-hero" aria-hidden />
      <header className="relative border-b border-border/60 glass">
        <div className="container max-w-4xl flex items-center justify-between py-3.5">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-smooth">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <BrandMark size="sm" />
          <Button variant="ghost" size="sm" onClick={() => signOut().then(() => nav("/"))}>Sign out</Button>
        </div>
      </header>

      <main className="container max-w-4xl py-10 space-y-6 relative">
        <h1 className="font-display text-3xl font-bold">Billing</h1>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Card className={cn(
            "relative overflow-hidden p-6 md:p-8 border-border/60 shadow-card",
            isProActive && "bg-gradient-primary text-primary-foreground border-transparent",
          )}>
            <div className="flex items-start justify-between flex-wrap gap-6">
              <div>
                <div className={cn("text-xs uppercase tracking-wider", isProActive ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  Current plan
                </div>
                <div className="font-display text-3xl font-bold mt-1">{planName}</div>
                {isProActive && sub!.current_period_end && (
                  <div className="text-xs mt-1 text-primary-foreground/80">
                    Active until {new Date(sub!.current_period_end).toLocaleDateString()} · {daysLeft} days left
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className={cn("text-xs uppercase tracking-wider", isProActive ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  Credits
                </div>
                <div className="font-display text-5xl font-bold leading-none mt-1">
                  <AnimatedCounter value={credits} duration={700} />
                </div>
              </div>
            </div>

            {isProActive && (
              <div className="mt-6">
                <div className="h-1.5 rounded-full bg-primary-foreground/20 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                    className="h-full bg-primary-foreground/80 rounded-full"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-6 flex-wrap">
              <Button
                onClick={() => setPaywallOpen(true)}
                className={isProActive ? "bg-card text-foreground hover:bg-card/90" : "bg-gradient-primary text-primary-foreground shadow-soft hover:shadow-elegant transition-smooth"}
              >
                {isProActive ? "Extend / change plan" : "Upgrade to Pro"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setPaywallOpen(true)}
                className={isProActive ? "bg-transparent border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10" : ""}
              >
                Top-up RM10
              </Button>
            </div>
            <p className={cn("text-xs mt-4", isProActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
              Pro packs do not auto-renew — buy another pack when your credits run out.
            </p>
          </Card>
        </motion.div>

        <Card className="p-6 shadow-card border-border/60">
          <div className="font-display text-sm font-semibold mb-2">Referral program</div>
          <p className="text-sm text-muted-foreground mb-3">
            Share your link — when a friend signs up and makes their first paid purchase, you both get <strong className="text-foreground">+3 credits</strong>.
          </p>
          {referralLink && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
              <code className="text-xs flex-1 truncate">{referralLink}</code>
              <motion.div whileTap={{ scale: 0.92 }}>
                <Button size="sm" variant="ghost" onClick={copyLink}>
                  {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </motion.div>
            </div>
          )}
        </Card>

        <Card className="p-6 shadow-card border-border/60">
          <div className="font-display text-sm font-semibold mb-3">Payment history</div>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          ) : (
            <div className="-mx-2">
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-2 text-[10px] uppercase tracking-wider text-muted-foreground pb-2 border-b border-border">
                <div>Item</div>
                <div className="text-right">Amount</div>
                <div className="text-right">Status</div>
              </div>
              <div className="divide-y divide-border">
                {payments.map(p => (
                  <div key={p.id} className="grid grid-cols-[1fr_auto_auto] gap-3 px-2 py-3 text-sm items-center hover:bg-muted/30 rounded-md transition-smooth">
                    <div>
                      <div className="font-medium capitalize">{p.kind}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleString()} · +{p.credits_granted} credits
                      </div>
                    </div>
                    <div className="text-right font-mono text-sm tabular-nums">RM{(p.amount / 100).toFixed(2)}</div>
                    <Badge className={cn("text-[10px]", statusTone(p.status))}>{p.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </main>

      <Paywall open={paywallOpen} onOpenChange={setPaywallOpen} initialPlan={initialPlan} initialTab={initialTab} />
    </div>
  );
}

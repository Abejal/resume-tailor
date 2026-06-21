import { useState } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Check, Crown, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { BankLogos } from "@/components/BankLogos";
import { SignInRequiredDialog } from "@/components/SignInRequiredDialog";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Optional initial selection when opened (e.g. from `?intent=monthly` redirect) */
  initialPlan?: "monthly" | "annual";
  initialTab?: "subscribe" | "topup";
}
type Kind = "topup" | "monthly" | "annual";

function PlanCard({
  title, price, period, perks, badge, selected, onSelect,
}: {
  title: string; price: string; period: string; perks: string[];
  badge?: string; selected?: boolean; onSelect: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={cn(
        "relative text-left rounded-2xl border p-5 transition-smooth bg-card",
        selected
          ? "border-primary shadow-glow"
          : "border-border hover:border-foreground/30",
      )}
    >
      {badge && (
        <span className="absolute -top-2 right-4 text-[10px] font-semibold uppercase tracking-wider bg-accent text-accent-foreground rounded-full px-2.5 py-1 shadow-soft">
          {badge}
        </span>
      )}
      <div className="text-sm font-semibold">{title}</div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="font-display text-3xl font-bold">{price}</span>
        <span className="text-xs text-muted-foreground">/ {period}</span>
      </div>
      <ul className="mt-4 space-y-1.5 text-xs">
        {perks.map((p, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <Check className="h-3 w-3 text-success shrink-0" /> {p}
          </li>
        ))}
      </ul>
    </motion.button>
  );
}

function TabPill({ tab, setTab }: { tab: "subscribe" | "topup"; setTab: (v: "subscribe" | "topup") => void }) {
  const opts = [
    { v: "subscribe" as const, label: "Subscription", Icon: Crown },
    { v: "topup" as const, label: "Top-up", Icon: Zap },
  ];
  return (
    <div className="relative inline-flex w-full items-center gap-1 rounded-full bg-muted p-1">
      {opts.map((o) => {
        const active = tab === o.v;
        return (
          <button
            key={o.v}
            onClick={() => setTab(o.v)}
            className={cn(
              "relative flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-smooth",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="paywall-tab-pill"
                className="absolute inset-0 rounded-full bg-card shadow-soft"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              <o.Icon className="h-3.5 w-3.5" /> {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export const Paywall = ({ open, onOpenChange, initialPlan, initialTab }: Props) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<"monthly" | "annual">(initialPlan ?? "monthly");
  const [tab, setTab] = useState<"subscribe" | "topup">(initialTab ?? "subscribe");
  const [signInOpen, setSignInOpen] = useState(false);
  const [pendingKind, setPendingKind] = useState<Kind>("monthly");

  const startPurchase = async (kind: Kind) => {
    if (!user) {
      setPendingKind(kind);
      setSignInOpen(true);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("toyyibpay-create-bill", {
        body: { kind, origin: window.location.origin },
      });
      if (error) throw error;
      if (data?.error) {
        const msg = data.error === "toyyibpay_misconfigured"
          ? `Payment unavailable: ${data.detail ?? "ToyyibPay misconfigured"}`
          : data.error;
        throw new Error(msg);
      }
      if (!data?.url) throw new Error("No checkout URL");
      const win = window.open(data.url, "_blank", "noopener,noreferrer");
      if (!win) window.location.href = data.url;
      else { setLoading(false); onOpenChange(false); }
    } catch (e: any) { toast.error(e.message ?? "Could not start checkout"); setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center mb-2 shadow-elegant">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <DialogTitle className="text-center font-display text-2xl">Upgrade Resume Tailor</DialogTitle>
          <DialogDescription className="text-center">
            FPX from all major MY banks · Cards · Pay in MYR
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          <TabPill tab={tab} setTab={setTab} />
        </div>

        {tab === "subscribe" ? (
          <div className="mt-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <PlanCard
                title="Pro Monthly"
                price="RM29"
                period="30 days"
                selected={plan === "monthly"}
                onSelect={() => setPlan("monthly")}
                perks={["50 credits", "Valid 30 days", "Saved history", "ATS keyword report"]}
              />
              <PlanCard
                title="Pro Annual"
                price="RM290"
                period="365 days"
                badge="Save RM58"
                selected={plan === "annual"}
                onSelect={() => setPlan("annual")}
                perks={["600 credits", "Valid 365 days", "All templates", "Priority support"]}
              />
            </div>
            <Button
              onClick={() => startPurchase(plan)} disabled={loading}
              className="w-full mt-4 bg-gradient-primary text-primary-foreground shadow-soft hover:shadow-elegant transition-smooth"
              size="lg"
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {user ? `Pay — ${plan === "monthly" ? "RM29" : "RM290"}` : "Sign up to buy"}
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-2">
              One-time payment. No auto-renew. Buy again when your credits run out.
            </p>
          </div>
        ) : (
          <div className="mt-4">
            <div className="rounded-2xl border border-border bg-gradient-to-b from-accent-soft to-transparent p-6 text-center">
              <div className="flex items-baseline justify-center gap-1">
                <span className="font-display text-4xl font-bold">RM10</span>
                <span className="text-muted-foreground">/ pack</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">5 credits · no expiry</p>
              <ul className="mt-3 space-y-1.5 text-xs max-w-xs mx-auto text-left">
                {["Pay once", "Credits never expire", "Use for resume or cover letter"].map((p, i) => (
                  <li key={i} className="flex items-center gap-1.5"><Check className="h-3 w-3 text-success" /> {p}</li>
                ))}
              </ul>
            </div>
            <Button
              onClick={() => startPurchase("topup")} disabled={loading}
              className="w-full mt-4 bg-gradient-primary text-primary-foreground shadow-soft hover:shadow-elegant transition-smooth"
              size="lg"
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {user ? "Pay RM10 — get 5 credits" : "Sign up to buy"}
            </Button>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-border">
          <BankLogos />
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Secure payment by ToyyibPay
        </p>
      </DialogContent>
      <SignInRequiredDialog open={signInOpen} onOpenChange={setSignInOpen} intent={pendingKind} />
    </Dialog>
  );
};

import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, Gauge, History as HistoryIcon, Sparkles } from "lucide-react";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** "monthly" | "annual" | "topup" — preserved across signup so the paywall reopens with the right plan */
  intent: string;
  /** Where to land after auth. Defaults to the billing/purchase flow. */
  next?: string;
  title?: string;
  description?: string;
}

const BENEFITS = [
  { Icon: Sparkles, title: "3 free tailors on us", body: "Instant, ATS-optimized — no credit card needed." },
  { Icon: Gauge, title: "Scored, critiqued & coached", body: "We rate your resume against the job and show exactly what to fix." },
  { Icon: HistoryIcon, title: "History saved", body: "Re-download any tailored resume anytime." },
];

export function SignInRequiredDialog({ open, onOpenChange, intent, next: nextOverride, title, description }: Props) {
  const nav = useNavigate();
  const rawNext = nextOverride ?? `/billing?intent=${intent}`;
  const next = encodeURIComponent(rawNext);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center mb-2 shadow-elegant">
            <Lock className="h-6 w-6 text-primary-foreground" />
          </div>
          <DialogTitle className="text-center font-display text-xl">
            {title ?? "Save your purchase to an account"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {description ?? "Free account, 10 seconds, no credit card to sign up."}
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 mt-3">
          {BENEFITS.map((b, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <b.Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium leading-tight">{b.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{b.body}</div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-5 space-y-3">
          <GoogleSignInButton next={rawNext} />
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <Button
            size="lg"
            className="w-full bg-gradient-primary text-primary-foreground shadow-soft hover:shadow-elegant transition-smooth"
            onClick={() => { onOpenChange(false); nav(`/signup?next=${next}`); }}
          >
            Continue with email
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => { onOpenChange(false); nav(`/login?next=${next}`); }}
              className="text-foreground font-medium hover:underline"
            >
              Sign in
            </button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

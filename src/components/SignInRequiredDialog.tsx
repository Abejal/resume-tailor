import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, CloudCog, History as HistoryIcon, Receipt } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** "monthly" | "annual" | "topup" — preserved across signup so the paywall reopens with the right plan */
  intent: string;
}

const BENEFITS = [
  { Icon: CloudCog, title: "Credits sync everywhere", body: "Phone, laptop, work browser — same balance." },
  { Icon: HistoryIcon, title: "History saved", body: "Re-download any tailored resume anytime." },
  { Icon: Receipt, title: "Email receipts", body: "For your records and reimbursement." },
];

export function SignInRequiredDialog({ open, onOpenChange, intent }: Props) {
  const nav = useNavigate();
  const next = encodeURIComponent(`/billing?intent=${intent}`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center mb-2 shadow-elegant">
            <Lock className="h-6 w-6 text-primary-foreground" />
          </div>
          <DialogTitle className="text-center font-display text-xl">
            Save your purchase to an account
          </DialogTitle>
          <DialogDescription className="text-center">
            Free account, 10 seconds, no credit card to sign up.
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

        <div className="mt-5 space-y-2">
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

import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getFingerprint } from "@/lib/fingerprint";
import { clearAnonCredits } from "@/hooks/useCredits";
import { BrandMark } from "@/components/BrandMark";

const REF_KEY = "jobtailor_ref";

export default function Signup() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") ?? "/";
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [referralCode, setReferralCode] = useState("");

  useEffect(() => {
    const c = localStorage.getItem(REF_KEY) ?? "";
    setReferralCode(c);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          referral_code: referralCode || null,
        },
      },
    });
    if (error) { setLoading(false); return toast.error(error.message); }

    if (data.session) {
      try {
        const fp = await getFingerprint();
        await supabase.rpc("merge_anon_into_user", { fp });
        clearAnonCredits();
        localStorage.removeItem(REF_KEY);
      } catch (_) { /* non-fatal */ }
    }

    setSuccess(true);
    toast.success("Account created. Welcome!");
    setTimeout(() => nav(next), 350);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[600px] bg-gradient-hero" aria-hidden />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className="relative w-full max-w-md"
      >
        <Card className="p-8 shadow-elegant border-border/60 glass">
          <div className="flex justify-center mb-6">
            <Link to="/"><BrandMark size="md" /></Link>
          </div>
          <h1 className="font-display text-2xl font-semibold mb-1 text-center">Start tailoring in 10 seconds</h1>
          <p className="text-sm text-muted-foreground text-center mb-6 flex items-center justify-center gap-1.5">
            <Sparkles className="h-3 w-3 text-accent" /> Free account · credits sync across devices
          </p>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center justify-between">
                <span>Full name</span>
                <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input id="name" value={fullName} onChange={e => setFullName(e.target.value)} className="transition-smooth focus-visible:shadow-glow" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="transition-smooth focus-visible:shadow-glow" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} className="transition-smooth focus-visible:shadow-glow" />
              <p className="text-xs text-muted-foreground">8+ characters. We never share your email.</p>
            </div>
            {referralCode && (
              <div className="rounded-lg bg-success-soft border border-success/30 text-success text-xs p-2.5 text-center">
                Referral code <strong>{referralCode}</strong> will be applied
              </div>
            )}
            <Button
              type="submit" size="lg"
              className="w-full bg-gradient-primary text-primary-foreground shadow-soft hover:shadow-elegant transition-smooth"
              disabled={loading || success}
            >
              {success ? <Check className="h-4 w-4 mr-2" /> : loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {success ? "Account created" : "Create account"}
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground mt-6">
            Already have an account? <Link to={`/login?next=${encodeURIComponent(next)}`} className="text-foreground font-medium hover:underline">Sign in</Link>
          </p>
        </Card>
      </motion.div>
    </div>
  );
}

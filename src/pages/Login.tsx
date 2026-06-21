import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/BrandMark";

export default function Login() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setLoading(false); return toast.error(error.message); }
    setSuccess(true);
    toast.success("Welcome back");
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
          <h1 className="font-display text-2xl font-semibold mb-1 text-center">Sign in</h1>
          <p className="text-sm text-muted-foreground text-center mb-6">Continue tailoring your resumes</p>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="transition-smooth focus-visible:shadow-glow" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground transition-smooth">Forgot?</Link>
              </div>
              <Input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)}
                className="transition-smooth focus-visible:shadow-glow" />
            </div>
            <Button
              type="submit" size="lg"
              className="w-full bg-gradient-primary text-primary-foreground shadow-soft hover:shadow-elegant transition-smooth"
              disabled={loading || success}
            >
              {success ? <Check className="h-4 w-4 mr-2" /> : loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {success ? "Signed in" : "Sign in"}
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground mt-6">
            New here? <Link to={`/signup?next=${encodeURIComponent(next)}`} className="text-foreground font-medium hover:underline">Create an account</Link>
          </p>
        </Card>
      </motion.div>
    </div>
  );
}

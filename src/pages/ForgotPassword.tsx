import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/BrandMark";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(true);
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
          <h1 className="font-display text-2xl font-semibold mb-1 text-center">Reset password</h1>

          {sent ? (
            <div className="text-center mt-6 space-y-3">
              <div className="mx-auto h-12 w-12 rounded-full bg-success-soft text-success flex items-center justify-center">
                <MailCheck className="h-6 w-6" />
              </div>
              <p className="text-sm text-muted-foreground">
                Check your inbox — we sent a password reset link to <strong className="text-foreground">{email}</strong>.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="transition-smooth focus-visible:shadow-glow" />
              </div>
              <Button
                type="submit" size="lg"
                className="w-full bg-gradient-primary text-primary-foreground shadow-soft hover:shadow-elegant transition-smooth"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Send reset link
              </Button>
            </form>
          )}

          <p className="text-sm text-center text-muted-foreground mt-6">
            <Link to="/login" className="text-foreground font-medium hover:underline">Back to sign in</Link>
          </p>
        </Card>
      </motion.div>
    </div>
  );
}

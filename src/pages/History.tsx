import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Mail, Loader2, FileSearch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ResultCard } from "@/components/ResultCard";
import { BrandMark } from "@/components/BrandMark";
import type { TailoredResume, CoverLetter } from "@/lib/resumeSchema";

type Gen = {
  id: string;
  mode: "resume" | "cover_letter";
  job_title: string | null;
  company: string | null;
  ats_score: number | null;
  payload: TailoredResume | CoverLetter;
  created_at: string;
};

export default function History() {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState<Gen[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Gen | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { nav("/login?next=/history"); return; }
    (async () => {
      const { data } = await supabase
        .from("generations")
        .select("id,mode,job_title,company,ats_score,payload,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      setItems((data ?? []) as Gen[]);
      setLoading(false);
    })();
  }, [user, authLoading, nav]);

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const scoreColor = (s: number | null) => {
    if (s == null) return "bg-muted text-muted-foreground";
    if (s >= 80) return "bg-success-soft text-success border border-success/30";
    if (s >= 60) return "bg-accent-soft text-warning border border-warning/30";
    return "bg-destructive/10 text-destructive border border-destructive/30";
  };

  return (
    <div className="min-h-screen bg-background relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[400px] bg-gradient-hero" aria-hidden />
      <header className="relative border-b border-border/60 glass">
        <div className="container max-w-5xl flex items-center justify-between py-3.5">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-smooth">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <BrandMark size="sm" />
          <Link to="/billing"><Button variant="ghost" size="sm">Billing</Button></Link>
        </div>
      </header>

      <main className="container max-w-5xl py-10 space-y-6 relative">
        <h1 className="font-display text-3xl font-bold">History</h1>

        {items.length === 0 ? (
          <Card className="p-12 text-center border-border/60 shadow-card">
            <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground animate-float">
              <FileSearch className="h-8 w-8" />
            </div>
            <h2 className="font-display text-lg font-semibold mt-4">No generations yet</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-6">Tailor your first resume to see it here.</p>
            <Link to="/">
              <Button className="bg-gradient-primary text-primary-foreground shadow-soft hover:shadow-elegant transition-smooth">
                Generate your first resume
              </Button>
            </Link>
          </Card>
        ) : open ? (
          <>
            <Button variant="outline" size="sm" onClick={() => setOpen(null)}>← Back to list</Button>
            <ResultCard
              kind={open.mode === "resume" ? "resume" : "cover"}
              data={open.payload as any}
              filenameBase={`${(open.company || open.job_title || open.mode).replace(/\W+/g, "_")}_${new Date(open.created_at).toISOString().slice(0,10)}`}
            />
          </>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {items.map((g, i) => (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.4) }}
              >
                <Card
                  className="p-5 cursor-pointer border-border/60 transition-smooth hover:shadow-elegant hover:border-primary/40 hover:-translate-y-0.5"
                  onClick={() => setOpen(g)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <span className="h-6 w-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                          {g.mode === "resume" ? <FileText className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                        </span>
                        {g.job_title || (g.mode === "resume" ? "Tailored Resume" : "Cover Letter")}
                      </div>
                      {g.company && <div className="text-xs text-muted-foreground mt-1 ml-8">{g.company}</div>}
                      <div className="text-xs text-muted-foreground mt-2 ml-8">{new Date(g.created_at).toLocaleString()}</div>
                    </div>
                    {g.ats_score != null && (
                      <Badge className={scoreColor(g.ats_score)}>
                        {g.ats_score}/100
                      </Badge>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

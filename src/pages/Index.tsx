import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  FileText, Mail, Loader2, Eraser, Sparkles, Zap, Target, ShieldCheck,
  History as HistoryIcon, Receipt, ArrowRight, LogOut, User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ResultCard } from "@/components/ResultCard";
import { FileUploadButton } from "@/components/FileUploadButton";
import { Paywall } from "@/components/Paywall";
import { LocaleToggle } from "@/components/LocaleToggle";
import { BrandMark } from "@/components/BrandMark";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { TrustStrip } from "@/components/TrustStrip";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { getFingerprint } from "@/lib/fingerprint";
import { cn } from "@/lib/utils";
import i18n from "@/lib/i18n";
import type { TailoredResume, CoverLetter } from "@/lib/resumeSchema";

const SAMPLE_RESUME = `John Doe
Software Engineer | john@example.com | linkedin.com/in/johndoe

EXPERIENCE
Software Engineer, Acme Corp (2021–Present)
- Built internal tools used by 200+ employees
- Worked on React frontend and Node.js backend
- Helped migrate legacy system to cloud

SKILLS
JavaScript, React, Node.js, SQL, Git`;

const SAMPLE_JD = `We're hiring a Senior Frontend Engineer to lead UI development for our SaaS platform. You'll architect scalable React applications, mentor junior engineers, and partner with design to ship delightful experiences. Required: 5+ years React, TypeScript, performance optimization, and a track record of shipping production features.`;

const safeFilename = (s: string) =>
  (s || "tailored").replace(/[^a-zA-Z0-9_\-]+/g, "_").slice(0, 60);

function CreditPill({ credits }: { credits: number }) {
  const low = credits <= 1;
  const empty = credits === 0;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-smooth",
        empty
          ? "bg-accent/15 border-accent/40 text-accent-foreground"
          : low
            ? "bg-accent-soft border-accent/30 text-accent-foreground animate-pulse-glow"
            : "bg-card border-border text-foreground",
      )}
    >
      <Sparkles className={cn("h-3 w-3", empty || low ? "text-accent" : "text-primary")} />
      <AnimatedCounter value={credits} />
      <span className="text-muted-foreground font-normal">credits</span>
    </div>
  );
}

function HeroHeadline({ line1, line2 }: { line1: string; line2: string }) {
  const reduced = useReducedMotion();
  const words = `${line1} ${line2}`.split(" ");
  return (
    <h1 className="font-display text-4xl md:text-[3.5rem] md:leading-[1.1] font-bold tracking-tight mb-4 bg-gradient-to-br from-foreground via-primary to-primary-glow bg-clip-text text-transparent">
      {words.map((w, i) => (
        <motion.span
          key={i}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.06, ease: [0.4, 0, 0.2, 1] }}
          className="inline-block mr-[0.3em]"
        >
          {w}
        </motion.span>
      ))}
    </h1>
  );
}

const Index = () => {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { credits, refresh, decrementOptimistic } = useCredits();

  const [resume, setResume] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [preferences, setPreferences] = useState("");
  const [tailoredResume, setTailoredResume] = useState<TailoredResume | null>(null);
  const [coverLetter, setCoverLetter] = useState<CoverLetter | null>(null);
  const [loadingResume, setLoadingResume] = useState(false);
  const [loadingCover, setLoadingCover] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const validate = () => {
    if (!resume.trim() || !jobDescription.trim()) {
      toast.error(t("errors.required"));
      return false;
    }
    return true;
  };

  const generate = async (mode: "resume" | "cover_letter") => {
    if (!validate()) return;
    if (credits <= 0) {
      toast.error(t("errors.no_credits"));
      setPaywallOpen(true);
      return;
    }

    const setLoading = mode === "resume" ? setLoadingResume : setLoadingCover;
    setLoading(true);

    try {
      const fp = await getFingerprint();
      const language = (i18n.language === "ms" ? "ms" : "en") as "en" | "ms";

      const { data, error } = await supabase.functions.invoke("tailor", {
        body: { mode, resume, jobDescription, jobTitle, company, preferences, language },
        headers: { "x-anon-fp": fp },
      });

      if (error) throw error;
      if (data?.error) {
        if (data.error === "insufficient_credit") {
          setPaywallOpen(true);
          throw new Error(t("errors.no_credits"));
        }
        if (data.error === "auth_required") throw new Error("Please sign in");
        throw new Error(data.error);
      }

      if (mode === "resume") setTailoredResume(data.payload as TailoredResume);
      else setCoverLetter(data.payload as CoverLetter);

      if (user) await refresh();
      else decrementOptimistic();

      toast.success(mode === "resume" ? t("toasts.resume_ready") : t("toasts.cover_ready"));
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const loadSample = () => {
    setResume(SAMPLE_RESUME);
    setJobDescription(SAMPLE_JD);
    setJobTitle("Senior Frontend Engineer");
    setCompany("Acme SaaS");
  };

  const clearAll = () => {
    setResume(""); setJobDescription(""); setJobTitle(""); setCompany("");
    setPreferences(""); setTailoredResume(null); setCoverLetter(null);
    toast.success(t("toasts.cleared"));
  };

  const filenameBase = safeFilename(`${jobTitle || "resume"}_${company || ""}`);
  const initial = (user?.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-background relative">
      {/* hero radial glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-hero" aria-hidden />

      <header className="relative border-b border-border/60 glass sticky top-0 z-20">
        <div className="container max-w-6xl flex items-center justify-between py-3.5 gap-3">
          <Link to="/" className="shrink-0">
            <BrandMark size="md" />
          </Link>
          <div className="flex items-center gap-2">
            <CreditPill credits={credits} />
            <div className="hidden sm:block"><LocaleToggle /></div>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-9 w-9 rounded-full bg-gradient-primary text-primary-foreground font-semibold text-sm flex items-center justify-center shadow-soft transition-smooth hover:shadow-elegant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    {initial}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="text-xs text-muted-foreground">Signed in as</div>
                    <div className="text-sm truncate">{user.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link to="/history"><HistoryIcon className="h-4 w-4 mr-2" /> {t("header.history")}</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/billing"><Receipt className="h-4 w-4 mr-2" /> {t("header.billing")}</Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setPaywallOpen(true)}>
                    <Sparkles className="h-4 w-4 mr-2" /> {t("header.buy_credits")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()}>
                    <LogOut className="h-4 w-4 mr-2" /> {t("header.sign_out")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link to="/login" className="hidden sm:block"><Button variant="ghost" size="sm"><UserIcon className="h-4 w-4 mr-1.5" /> {t("header.sign_in")}</Button></Link>
                <Button size="sm" onClick={() => setPaywallOpen(true)} className="bg-gradient-primary text-primary-foreground shadow-soft hover:shadow-elegant transition-smooth">
                  {t("header.buy_credits")}
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="container max-w-4xl pt-16 md:pt-20 pb-10 text-center relative">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Badge variant="secondary" className="mb-5 bg-card border border-border shadow-soft text-foreground font-medium">
            <Sparkles className="h-3 w-3 mr-1.5 text-primary" />
            {t("hero.tagline")}
          </Badge>
        </motion.div>
        <HeroHeadline line1={t("hero.title_line1")} line2={t("hero.title_line2")} />
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.4 }}
          className="text-lg text-muted-foreground max-w-2xl mx-auto"
        >
          {t("hero.subtitle")}
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.6 }}
          className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-8 text-sm text-muted-foreground"
        >
          <div className="flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> {t("hero.feature_keywords")}</div>
          <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> {t("hero.feature_fast")}</div>
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> {t("hero.feature_private")}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.75 }}
          className="mt-6"
        >
          <TrustStrip />
        </motion.div>
      </section>

      <main className="container max-w-5xl pb-20 space-y-6 relative">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <Card className="p-6 md:p-8 shadow-card border-border/60">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
              <h2 className="font-display text-xl font-semibold">{t("form.your_details")}</h2>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={loadSample}>{t("form.load_example")}</Button>
                <Button variant="outline" size="sm" onClick={clearAll}>
                  <Eraser className="h-4 w-4 mr-2" /> {t("form.clear_all")}
                </Button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="title">{t("form.job_title")}</Label>
                <Input id="title" placeholder="e.g. Senior Product Designer" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="transition-smooth focus-visible:shadow-glow" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">{t("form.company")}</Label>
                <Input id="company" placeholder="e.g. Linear" value={company} onChange={(e) => setCompany(e.target.value)} className="transition-smooth focus-visible:shadow-glow" />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="resume">{t("form.resume")}</Label>
                  <FileUploadButton onText={setResume} label={t("form.upload_resume")} />
                </div>
                <Textarea
                  id="resume"
                  placeholder="Paste your current resume here, or upload .pdf / .docx / .txt..."
                  value={resume}
                  onChange={(e) => setResume(e.target.value)}
                  className="min-h-[280px] font-mono text-sm resize-y transition-smooth focus-visible:shadow-glow"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="jd">{t("form.jd")}</Label>
                  <FileUploadButton onText={setJobDescription} label={t("form.upload_jd")} />
                </div>
                <Textarea
                  id="jd"
                  placeholder="Paste the job description, or upload a file..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="min-h-[280px] font-mono text-sm resize-y transition-smooth focus-visible:shadow-glow"
                />
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <Label htmlFor="prefs">{t("form.preferences")}</Label>
              <Textarea
                id="prefs"
                placeholder="e.g. Emphasize leadership and system design over hands-on coding. Keep it to one page. Highlight fintech experience."
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                className="min-h-[100px] resize-y transition-smooth focus-visible:shadow-glow"
              />
              <p className="text-xs text-muted-foreground">{t("form.preferences_hint")}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <Button
                size="lg"
                className="flex-1 bg-gradient-primary text-primary-foreground shadow-soft hover:shadow-elegant transition-smooth group"
                onClick={() => generate("resume")}
                disabled={loadingResume || loadingCover}
              >
                {loadingResume ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                {t("form.tailor_resume")}
                {!loadingResume && <ArrowRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-0.5" />}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="flex-1 transition-smooth"
                onClick={() => generate("cover_letter")}
                disabled={loadingResume || loadingCover}
              >
                {loadingCover ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                {t("form.generate_cover")}
              </Button>
            </div>
          </Card>
        </motion.div>

        {(tailoredResume || coverLetter) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="grid lg:grid-cols-2 gap-6"
          >
            {tailoredResume && (
              <ResultCard kind="resume" data={tailoredResume} filenameBase={`${filenameBase}_resume`} />
            )}
            {coverLetter && (
              <ResultCard kind="cover" data={coverLetter} filenameBase={`${filenameBase}_cover`} />
            )}
          </motion.div>
        )}
      </main>

      <footer className="border-t border-border/60 py-8">
        <div className="container max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <BrandMark size="sm" />
          </div>
          <div>© {new Date().getFullYear()} Resume Tailor</div>
        </div>
      </footer>

      <Paywall open={paywallOpen} onOpenChange={setPaywallOpen} />
    </div>
  );
};

export default Index;

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Copy, Check, FileText, FileType2, LayoutTemplate, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { TailoredResume, CoverLetter, Template } from "@/lib/resumeSchema";
import { resumeToPlainText, coverToPlainText } from "@/lib/resumeSchema";
import { downloadResumePdf, downloadCoverPdf } from "@/lib/exports/pdfRenderer";
import { downloadResumeDocx, downloadCoverDocx } from "@/lib/exports/docxRenderer";
import { AtsDonut } from "@/components/AtsDonut";
import { cn } from "@/lib/utils";

type Props =
  | { kind: "resume"; data: TailoredResume; filenameBase: string }
  | { kind: "cover";  data: CoverLetter;    filenameBase: string };

function HighlightedBullet({ text, keywords }: { text: string; keywords: string[] }) {
  if (!keywords?.length) return <span>{text}</span>;
  const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(re);
  return (
    <span>
      {parts.map((p, i) =>
        keywords.some(k => k.toLowerCase() === p.toLowerCase())
          ? <mark key={i} className="bg-transparent text-foreground font-medium border-b-2 border-accent/70 px-0.5">{p}</mark>
          : <span key={i}>{p}</span>,
      )}
    </span>
  );
}

function ResumePreview({ r }: { r: TailoredResume }) {
  const h = r.header;
  return (
    <div className="text-sm leading-relaxed text-foreground">
      <div className="font-display text-xl font-bold tracking-tight">{h.name}</div>
      {h.title && <div className="text-muted-foreground">{h.title}</div>}
      <div className="text-xs text-muted-foreground mt-1">
        {[h.email, h.phone, h.location].filter(Boolean).join(" · ")}
      </div>
      {r.summary && (
        <>
          <h4 className="mt-4 mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-primary">Summary</h4>
          <p>{r.summary}</p>
        </>
      )}
      {r.skills?.length ? (
        <>
          <h4 className="mt-4 mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-primary">Skills</h4>
          <ul className="space-y-0.5">
            {r.skills.map((g, i) => (
              <li key={i}><strong>{g.group}:</strong> {g.items.join(", ")}</li>
            ))}
          </ul>
        </>
      ) : null}
      {r.experience?.length ? (
        <>
          <h4 className="mt-4 mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-primary">Experience</h4>
          {r.experience.map((e, i) => (
            <div key={i} className="mb-2.5">
              <div className="flex justify-between gap-2">
                <div className="font-semibold">{e.title} · {e.company}</div>
                <div className="text-xs text-muted-foreground">{e.start} – {e.end}</div>
              </div>
              {e.location && <div className="text-xs text-muted-foreground">{e.location}</div>}
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                {e.bullets.map((b, j) => (
                  <li key={j}><HighlightedBullet text={b.text} keywords={b.keywords ?? []} /></li>
                ))}
              </ul>
            </div>
          ))}
        </>
      ) : null}
      {r.projects?.length ? (
        <>
          <h4 className="mt-4 mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-primary">Projects</h4>
          {r.projects.map((p, i) => (
            <div key={i} className="mb-2.5">
              <div className="font-semibold">{p.name}{p.description && <span className="font-normal"> — {p.description}</span>}</div>
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                {p.bullets.map((b, j) => (
                  <li key={j}><HighlightedBullet text={b.text} keywords={b.keywords ?? []} /></li>
                ))}
              </ul>
            </div>
          ))}
        </>
      ) : null}
      {r.education?.length ? (
        <>
          <h4 className="mt-4 mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-primary">Education</h4>
          {r.education.map((ed, i) => (
            <div key={i} className="mb-2">
              <div className="flex justify-between gap-2">
                <div className="font-semibold">{ed.degree} · {ed.school}</div>
                <div className="text-xs text-muted-foreground">{[ed.start, ed.end].filter(Boolean).join(" – ")}</div>
              </div>
              {ed.location && <div className="text-xs text-muted-foreground">{ed.location}</div>}
              {ed.details && <div className="text-sm">{ed.details}</div>}
            </div>
          ))}
        </>
      ) : null}
      {r.certifications?.length ? (
        <>
          <h4 className="mt-4 mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-primary">Certifications</h4>
          <ul className="space-y-0.5">
            {r.certifications.map((c, i) => (
              <li key={i}><strong>{c.name}</strong>{c.issuer && ` — ${c.issuer}`}{c.year && ` (${c.year})`}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function CoverPreview({ c }: { c: CoverLetter }) {
  return (
    <div className="text-sm leading-relaxed text-foreground">
      <p>{c.recipient}</p>
      {c.paragraphs.map((p, i) => <p key={i} className="mt-3">{p}</p>)}
      <p className="mt-4">{c.signoff}</p>
      <p className="mt-2 font-medium">{c.name}</p>
    </div>
  );
}

function TemplateSwitch({ value, onChange }: { value: Template; onChange: (t: Template) => void }) {
  const opts: { v: Template; label: string }[] = [
    { v: "classic", label: "Classic" },
    { v: "modern", label: "Modern" },
  ];
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-muted/60 p-0.5">
      {opts.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={cn(
              "relative inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-smooth",
              active ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutTemplate className="h-3 w-3" /> {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ResultCard(props: Props) {
  const [copied, setCopied] = useState(false);
  const [template, setTemplate] = useState<Template>("classic");
  const [downloading, setDownloading] = useState<"pdf" | "docx" | null>(null);

  const isResume = props.kind === "resume";
  const ats: { matched?: string[]; missing?: string[] } = props.data.ats ?? {};
  const score = isResume ? (props.data as TailoredResume).ats?.score ?? 0 : 0;

  const copyText = isResume
    ? resumeToPlainText(props.data as TailoredResume)
    : coverToPlainText(props.data as CoverLetter);
  const title = isResume ? "Tailored Resume" : "Cover Letter";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(copyText);
    setCopied(true); toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePdf = async () => {
    setDownloading("pdf");
    try {
      if (isResume) await downloadResumePdf(props.data as TailoredResume, template, `${props.filenameBase}.pdf`);
      else await downloadCoverPdf(props.data as CoverLetter, template, `${props.filenameBase}.pdf`);
      toast.success("PDF downloaded");
    } catch (e: any) { toast.error(e.message ?? "PDF failed"); }
    finally { setDownloading(null); }
  };

  const handleDocx = async () => {
    setDownloading("docx");
    try {
      if (isResume) await downloadResumeDocx(props.data as TailoredResume, template, `${props.filenameBase}.docx`);
      else await downloadCoverDocx(props.data as CoverLetter, template, `${props.filenameBase}.docx`);
      toast.success("DOCX downloaded");
    } catch (e: any) { toast.error(e.message ?? "DOCX failed"); }
    finally { setDownloading(null); }
  };

  return (
    <Card className="p-6 shadow-card border-border/60 overflow-hidden">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          {isResume && <AtsDonut score={score} />}
          <div>
            <h3 className="font-display text-lg font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isResume ? "Underlined = JD keywords matched" : "Tailored to the job description"}
            </p>
          </div>
        </div>
        <TemplateSwitch value={template} onChange={setTemplate} />
      </div>

      <div className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1 mb-4">
        <Button variant="ghost" size="sm" onClick={handleCopy} className="h-8 rounded-full px-3">
          {copied ? <Check className="h-3.5 w-3.5 mr-1.5 text-success" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <div className="h-4 w-px bg-border" />
        <Button variant="ghost" size="sm" onClick={handleDocx} disabled={downloading !== null} className="h-8 rounded-full px-3">
          {downloading === "docx" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileType2 className="h-3.5 w-3.5 mr-1.5" />}
          DOCX
        </Button>
        <Button
          size="sm" onClick={handlePdf} disabled={downloading !== null}
          className="h-8 rounded-full px-3 bg-gradient-primary text-primary-foreground shadow-soft hover:shadow-elegant transition-smooth"
        >
          {downloading === "pdf" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-1.5" />}
          PDF
        </Button>
      </div>

      {(ats.matched?.length || ats.missing?.length) ? (
        <div className="mb-4 space-y-3">
          {ats.matched?.length ? (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1.5">
                Matched <span className="text-success font-semibold">({ats.matched.length})</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {ats.matched.slice(0, 30).map((k, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(i * 0.025, 0.5) }}
                  >
                    <Badge className="text-xs bg-success-soft text-success border border-success/30">{k}</Badge>
                  </motion.span>
                ))}
              </div>
            </div>
          ) : null}
          {ats.missing?.length ? (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1.5">
                Missing — no evidence <span className="text-warning font-semibold">({ats.missing.length})</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {ats.missing.slice(0, 20).map((k, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(i * 0.025, 0.4) }}
                  >
                    <Badge variant="outline" className="text-xs border-dashed text-muted-foreground">{k}</Badge>
                  </motion.span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-muted/30 p-2">
        <div className="rounded-lg bg-card shadow-soft p-5 max-h-[600px] overflow-auto">
          {isResume
            ? <ResumePreview r={props.data as TailoredResume} />
            : <CoverPreview c={props.data as CoverLetter} />}
        </div>
      </div>
    </Card>
  );
}

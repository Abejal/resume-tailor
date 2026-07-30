import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AtsDonut } from "@/components/AtsDonut";
import { CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { CRITIQUE_CATEGORY_ORDER, type CritiqueResult } from "@/lib/critiqueSchema";
import { cn } from "@/lib/utils";

function scoreTone(score: number): "success" | "warning" | "destructive" {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "destructive";
}

function ScoreBadge({ score }: { score: number }) {
  const tone = scoreTone(score);
  return (
    <Badge
      className={cn(
        "text-xs font-semibold border shrink-0",
        tone === "success" && "bg-success-soft text-success border-success/30",
        tone === "warning" && "bg-warning-soft text-warning border-warning/30",
        tone === "destructive" && "bg-destructive/10 text-destructive border-destructive/30",
      )}
    >
      {Math.round(score)}
    </Badge>
  );
}

function ScoreBar({ score }: { score: number }) {
  const tone = scoreTone(score);
  return (
    <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
      <div
        className={cn(
          "h-full rounded-full transition-smooth",
          tone === "success" && "bg-success",
          tone === "warning" && "bg-warning",
          tone === "destructive" && "bg-destructive",
        )}
        style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
      />
    </div>
  );
}

export function CritiqueBreakdown({ critique }: { critique: CritiqueResult }) {
  const byKey = new Map(critique.categories.map((c) => [c.key, c]));

  return (
    <Card className="p-6 shadow-card border-border/60">
      <div className="flex items-start gap-4 flex-wrap">
        <AtsDonut score={critique.overall_score} size={96} />
        <div className="flex-1 min-w-[200px]">
          <h3 className="font-display text-lg font-semibold">Resume Critique</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{critique.overall_verdict}</p>
        </div>
      </div>

      {(critique.top_strengths?.length || critique.top_risks?.length) ? (
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          {critique.top_strengths?.length ? (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Top strengths
              </div>
              <ul className="space-y-1">
                {critique.top_strengths.map((s, i) => (
                  <li key={i} className="text-sm text-foreground">{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {critique.top_risks?.length ? (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" /> Top risks
              </div>
              <ul className="space-y-1">
                {critique.top_risks.map((s, i) => (
                  <li key={i} className="text-sm text-foreground">{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <Accordion type="multiple" className="mt-4">
        {CRITIQUE_CATEGORY_ORDER.map((key) => {
          const cat = byKey.get(key);
          if (!cat) return null;
          return (
            <AccordionItem key={key} value={key}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex-1 flex items-center gap-3 pr-2 text-left">
                  <span className="font-medium text-sm">{cat.label}</span>
                  <ScoreBadge score={cat.score} />
                  <span className="text-xs text-muted-foreground truncate hidden sm:inline">{cat.verdict}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ScoreBar score={cat.score} />
                <p className="text-xs text-muted-foreground mt-2 sm:hidden">{cat.verdict}</p>
                {cat.why?.length ? (
                  <ul className="mt-3 space-y-1.5">
                    {cat.why.map((w, i) => (
                      <li key={i} className="text-sm text-muted-foreground pl-3 relative before:content-['•'] before:absolute before:left-0">
                        {w}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {cat.fixes?.length ? (
                  <ul className="mt-3 space-y-1.5">
                    {cat.fixes.map((f, i) => (
                      <li key={i} className="text-sm border-l-2 border-primary/40 pl-3 flex items-start gap-1.5">
                        <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <span className="text-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </Card>
  );
}

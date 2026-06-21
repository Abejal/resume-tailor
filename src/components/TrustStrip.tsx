import { Sparkles, Shield, Globe2 } from "lucide-react";

export function TrustStrip() {
  const items = [
    { icon: Sparkles, label: "Google Gemini" },
    { icon: Shield, label: "FPX · DuitNow · Cards" },
    { icon: Globe2, label: "Bahasa & English" },
  ];
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <it.icon className="h-3.5 w-3.5 opacity-70" />
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

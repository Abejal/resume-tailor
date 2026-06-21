import { useEffect, useState } from "react";
import i18n, { setLocale } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const LOCALES = [
  { code: "en", label: "EN" },
  { code: "ms", label: "BM" },
] as const;

export function LocaleToggle() {
  const [locale, setLocaleState] = useState<"en" | "ms">((i18n.language as "en" | "ms") || "en");
  const { user } = useAuth();

  useEffect(() => {
    const onChange = () => setLocaleState(i18n.language as "en" | "ms");
    i18n.on("languageChanged", onChange);
    return () => { i18n.off("languageChanged", onChange); };
  }, []);

  const pick = async (next: "en" | "ms") => {
    if (next === locale) return;
    setLocale(next);
    if (user) await supabase.from("profiles").update({ locale: next }).eq("id", user.id);
  };

  return (
    <div
      role="tablist"
      aria-label="Language"
      className="inline-flex items-center gap-0.5 rounded-full border border-border bg-muted/50 p-0.5"
    >
      {LOCALES.map((l) => {
        const active = locale === l.code;
        return (
          <button
            key={l.code}
            role="tab"
            aria-selected={active}
            onClick={() => pick(l.code)}
            className={cn(
              "relative px-2.5 py-1 text-xs font-medium rounded-full transition-smooth",
              active ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}

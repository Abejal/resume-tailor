import { Document, Page, Text, View, StyleSheet, Link } from "@react-pdf/renderer";
import type { TailoredResume, CoverLetter, Template } from "@/lib/resumeSchema";

// One professional, ATS-safe single-column template used for every resume.
// Tuned for generous, even vertical rhythm so it reads clean and uncramped.

const INK = "#222222";
const HEAD = "#1a2b4a";     // deep navy for headings/accents
const MUTE = "#5b6472";

const s = StyleSheet.create({
  page: {
    paddingHorizontal: 54,
    paddingTop: 48,
    paddingBottom: 48,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: INK,
    lineHeight: 1.5,
  },

  // ----- header -----
  name: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#141414", letterSpacing: 0.3 },
  title: { fontSize: 11.5, color: HEAD, marginTop: 4 },
  contact: { fontSize: 9, color: MUTE, marginTop: 6 },
  headerRule: { borderBottomWidth: 1.4, borderBottomColor: HEAD, marginTop: 13, marginBottom: 17 },

  // ----- sections -----
  section: { marginBottom: 15 },
  sec: {
    fontSize: 10, fontFamily: "Helvetica-Bold", textTransform: "uppercase",
    letterSpacing: 1.5, color: HEAD, marginBottom: 8,
    borderBottomWidth: 0.75, borderBottomColor: "#d7dde5", paddingBottom: 3.5,
  },
  summary: { color: "#333", lineHeight: 1.55 },

  // ----- skills -----
  skillRow: { flexDirection: "row", marginBottom: 4 },
  skillG: { fontFamily: "Helvetica-Bold", width: 104, color: "#1c1c1c" },
  skillI: { flex: 1, color: "#333" },

  // ----- entries (experience / projects / education) -----
  entry: { marginBottom: 11 },
  roleHdr: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  roleL: { fontFamily: "Helvetica-Bold", fontSize: 10.5, color: "#1c1c1c" },
  roleR: { fontSize: 9, color: MUTE },
  roleSub: { fontSize: 9, color: MUTE, fontFamily: "Helvetica-Oblique", marginBottom: 5 },
  bullet: { flexDirection: "row", marginBottom: 4, paddingRight: 8 },
  dot: { width: 12, color: HEAD },
  bulletT: { flex: 1, lineHeight: 1.5, color: "#333" },
  kw: { fontFamily: "Helvetica-Bold", color: "#141414" },
  certLine: { marginBottom: 3, color: "#333" },
});

// Bold JD keywords inline (no color/highlight — ATS-safe, professional).
function BulletText({ text, keywords }: { text: string; keywords: string[] }) {
  if (!keywords?.length) return <Text style={s.bulletT}>{text}</Text>;
  const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(re);
  return (
    <Text style={s.bulletT}>
      {parts.map((p, i) =>
        keywords.some(k => k.toLowerCase() === p.toLowerCase())
          ? <Text key={i} style={s.kw}>{p}</Text>
          : <Text key={i}>{p}</Text>,
      )}
    </Text>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sec}>{title}</Text>
      {children}
    </View>
  );
}

function Bullets({ bullets }: { bullets: { text: string; keywords?: string[] }[] }) {
  return (
    <>
      {bullets.map((b, j) => (
        <View key={j} style={s.bullet}>
          <Text style={s.dot}>•</Text>
          <BulletText text={b.text} keywords={b.keywords ?? []} />
        </View>
      ))}
    </>
  );
}

function ResumeBody({ r }: { r: TailoredResume }) {
  return (
    <>
      {r.summary ? (
        <Section title="Summary"><Text style={s.summary}>{r.summary}</Text></Section>
      ) : null}

      {r.skills?.length ? (
        <Section title="Skills">
          {r.skills.map((g, i) => (
            <View key={i} style={s.skillRow}>
              <Text style={s.skillG}>{g.group}</Text>
              <Text style={s.skillI}>{g.items.join(", ")}</Text>
            </View>
          ))}
        </Section>
      ) : null}

      {r.experience?.length ? (
        <Section title="Experience">
          {r.experience.map((e, i) => (
            <View key={i} wrap={false} style={s.entry}>
              <View style={s.roleHdr}>
                <Text style={s.roleL}>{e.title} · {e.company}</Text>
                <Text style={s.roleR}>{e.start} – {e.end}</Text>
              </View>
              {e.location ? <Text style={s.roleSub}>{e.location}</Text> : null}
              <Bullets bullets={e.bullets} />
            </View>
          ))}
        </Section>
      ) : null}

      {r.projects?.length ? (
        <Section title="Projects">
          {r.projects.map((p, i) => (
            <View key={i} wrap={false} style={s.entry}>
              <Text style={s.roleL}>{p.name}{p.description ? ` — ${p.description}` : ""}</Text>
              <View style={{ marginTop: 2 }}><Bullets bullets={p.bullets} /></View>
            </View>
          ))}
        </Section>
      ) : null}

      {r.education?.length ? (
        <Section title="Education">
          {r.education.map((ed, i) => (
            <View key={i} style={s.entry}>
              <View style={s.roleHdr}>
                <Text style={s.roleL}>{ed.degree} · {ed.school}</Text>
                <Text style={s.roleR}>{[ed.start, ed.end].filter(Boolean).join(" – ")}</Text>
              </View>
              {ed.location ? <Text style={s.roleSub}>{ed.location}</Text> : null}
              {ed.details ? <Text style={{ color: "#333" }}>{ed.details}</Text> : null}
            </View>
          ))}
        </Section>
      ) : null}

      {r.certifications?.length ? (
        <Section title="Certifications">
          {r.certifications.map((c, i) => (
            <Text key={i} style={s.certLine}>
              {c.name}{c.issuer ? ` — ${c.issuer}` : ""}{c.year ? ` (${c.year})` : ""}
            </Text>
          ))}
        </Section>
      ) : null}
    </>
  );
}

// `template` is accepted for signature compatibility but intentionally ignored —
// every resume renders with the single professional layout above.
export function ResumeDoc({ r }: { r: TailoredResume; template?: Template }) {
  const h = r.header;
  const contactBits = [h.email, h.phone, h.location].filter(Boolean);
  const hasLinks = (h.links ?? []).length > 0;
  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <Text style={s.name}>{h.name}</Text>
        {h.title ? <Text style={s.title}>{h.title}</Text> : null}
        <Text style={s.contact}>
          {contactBits.join("   •   ")}
          {hasLinks && contactBits.length ? "   •   " : ""}
          {(h.links ?? []).map((l, i) => (
            <Link key={i} src={l.url} style={{ color: HEAD, textDecoration: "none" }}>
              {l.label}{i < (h.links!.length - 1) ? "   •   " : ""}
            </Link>
          ))}
        </Text>
        <View style={s.headerRule} />
        <ResumeBody r={r} />
      </Page>
    </Document>
  );
}

export function CoverDoc({ c }: { c: CoverLetter; template?: Template }) {
  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <Text style={{ marginBottom: 16 }}>{c.recipient}</Text>
        {c.paragraphs.map((p, i) => (
          <Text key={i} style={{ marginBottom: 12, lineHeight: 1.6, color: "#333" }}>{p}</Text>
        ))}
        <Text style={{ marginTop: 8 }}>{c.signoff}</Text>
        <Text style={{ marginTop: 20, fontFamily: "Helvetica-Bold" }}>{c.name}</Text>
      </Page>
    </Document>
  );
}

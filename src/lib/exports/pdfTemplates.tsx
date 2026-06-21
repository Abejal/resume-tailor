import { Document, Page, Text, View, StyleSheet, Link } from "@react-pdf/renderer";
import type { TailoredResume, CoverLetter, Template } from "@/lib/resumeSchema";

// --- Classic ATS-safe (single column, neutral) ---------------------------

const classic = StyleSheet.create({
  page:    { paddingHorizontal: 48, paddingVertical: 44, fontFamily: "Helvetica", fontSize: 10.5, color: "#1a1a1a", lineHeight: 1.45 },
  name:    { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  title:   { fontSize: 11.5, color: "#444", marginBottom: 4 },
  contact: { fontSize: 9.5, color: "#555", marginBottom: 12 },
  sec:     { fontSize: 11, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.2, marginTop: 10, marginBottom: 4, borderBottomWidth: 0.6, borderBottomColor: "#999", paddingBottom: 2 },
  para:    { marginBottom: 6 },
  roleHdr: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  roleL:   { fontFamily: "Helvetica-Bold", fontSize: 10.5 },
  roleR:   { fontSize: 10, color: "#555" },
  roleSub: { fontSize: 10, color: "#444", marginBottom: 3 },
  bullet:  { flexDirection: "row", marginBottom: 2 },
  dot:     { width: 10 },
  bulletT: { flex: 1 },
  skillRow:{ flexDirection: "row", marginBottom: 2 },
  skillG:  { fontFamily: "Helvetica-Bold", width: 95 },
  skillI:  { flex: 1 },
  kw:      { fontFamily: "Helvetica-Bold" },
});

// --- Modern (slim accent bar) --------------------------------------------

const modern = StyleSheet.create({
  ...classic,
  page:    { ...classic.page, paddingTop: 0 },
  topBar:  { backgroundColor: "#0f172a", paddingHorizontal: 48, paddingVertical: 24, marginBottom: 16, color: "#fff" },
  nameM:   { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#fff", marginBottom: 2 },
  titleM:  { fontSize: 11.5, color: "#cbd5e1" },
  contactM:{ fontSize: 9.5, color: "#cbd5e1", marginTop: 6 },
  body:    { paddingHorizontal: 48 },
  secM:    { fontSize: 11, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.2, marginTop: 10, marginBottom: 4, color: "#0f172a" },
});

// Render a bullet with keywords lightly emphasized (NOT yellow — pro look).
function BulletText({ text, keywords, styles }: { text: string; keywords: string[]; styles: typeof classic }) {
  if (!keywords?.length) return <Text style={styles.bulletT}>{text}</Text>;
  // Split text on keyword boundaries.
  const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(re);
  return (
    <Text style={styles.bulletT}>
      {parts.map((p, i) =>
        keywords.some(k => k.toLowerCase() === p.toLowerCase())
          ? <Text key={i} style={styles.kw}>{p}</Text>
          : <Text key={i}>{p}</Text>,
      )}
    </Text>
  );
}

function ResumeBody({ r, styles, secStyle }: { r: TailoredResume; styles: typeof classic; secStyle?: any }) {
  return (
    <>
      {r.summary ? (
        <View>
          <Text style={secStyle ?? styles.sec}>Summary</Text>
          <Text style={styles.para}>{r.summary}</Text>
        </View>
      ) : null}

      {r.skills?.length ? (
        <View>
          <Text style={secStyle ?? styles.sec}>Skills</Text>
          {r.skills.map((g, i) => (
            <View key={i} style={styles.skillRow}>
              <Text style={styles.skillG}>{g.group}</Text>
              <Text style={styles.skillI}>{g.items.join(", ")}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {r.experience?.length ? (
        <View>
          <Text style={secStyle ?? styles.sec}>Experience</Text>
          {r.experience.map((e, i) => (
            <View key={i} wrap={false}>
              <View style={styles.roleHdr}>
                <Text style={styles.roleL}>{e.title} · {e.company}</Text>
                <Text style={styles.roleR}>{e.start} – {e.end}</Text>
              </View>
              {e.location ? <Text style={styles.roleSub}>{e.location}</Text> : null}
              {e.bullets.map((b, j) => (
                <View key={j} style={styles.bullet}>
                  <Text style={styles.dot}>•</Text>
                  <BulletText text={b.text} keywords={b.keywords ?? []} styles={styles} />
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : null}

      {r.projects?.length ? (
        <View>
          <Text style={secStyle ?? styles.sec}>Projects</Text>
          {r.projects.map((p, i) => (
            <View key={i} wrap={false}>
              <Text style={styles.roleL}>{p.name}{p.description ? ` — ${p.description}` : ""}</Text>
              {p.bullets.map((b, j) => (
                <View key={j} style={styles.bullet}>
                  <Text style={styles.dot}>•</Text>
                  <BulletText text={b.text} keywords={b.keywords ?? []} styles={styles} />
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : null}

      {r.education?.length ? (
        <View>
          <Text style={secStyle ?? styles.sec}>Education</Text>
          {r.education.map((ed, i) => (
            <View key={i} style={{ marginBottom: 4 }}>
              <View style={styles.roleHdr}>
                <Text style={styles.roleL}>{ed.degree} · {ed.school}</Text>
                <Text style={styles.roleR}>{[ed.start, ed.end].filter(Boolean).join(" – ")}</Text>
              </View>
              {ed.location ? <Text style={styles.roleSub}>{ed.location}</Text> : null}
              {ed.details ? <Text>{ed.details}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      {r.certifications?.length ? (
        <View>
          <Text style={secStyle ?? styles.sec}>Certifications</Text>
          {r.certifications.map((c, i) => (
            <Text key={i}>{c.name}{c.issuer ? ` — ${c.issuer}` : ""}{c.year ? ` (${c.year})` : ""}</Text>
          ))}
        </View>
      ) : null}
    </>
  );
}

export function ResumeDoc({ r, template }: { r: TailoredResume; template: Template }) {
  if (template === "modern") {
    const h = r.header;
    const contact = [h.email, h.phone, h.location, ...(h.links ?? []).map(l => l.url)].filter(Boolean).join(" · ");
    return (
      <Document>
        <Page size="LETTER" style={modern.page}>
          <View style={modern.topBar}>
            <Text style={modern.nameM}>{h.name}</Text>
            {h.title ? <Text style={modern.titleM}>{h.title}</Text> : null}
            {contact ? <Text style={modern.contactM}>{contact}</Text> : null}
          </View>
          <View style={modern.body}>
            <ResumeBody r={r} styles={modern as any} secStyle={modern.secM} />
          </View>
        </Page>
      </Document>
    );
  }

  const h = r.header;
  return (
    <Document>
      <Page size="LETTER" style={classic.page}>
        <Text style={classic.name}>{h.name}</Text>
        {h.title ? <Text style={classic.title}>{h.title}</Text> : null}
        <Text style={classic.contact}>
          {[h.email, h.phone, h.location].filter(Boolean).join("  ·  ")}
          {h.links?.length ? "  ·  " : ""}
          {(h.links ?? []).map((l, i) => (
            <Link key={i} src={l.url}>{l.label}{i < (h.links!.length - 1) ? "  ·  " : ""}</Link>
          ))}
        </Text>
        <ResumeBody r={r} styles={classic} />
      </Page>
    </Document>
  );
}

export function CoverDoc({ c, template }: { c: CoverLetter; template: Template }) {
  const styles = template === "modern" ? modern : classic;
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={{ marginBottom: 12 }}>{c.recipient}</Text>
        {c.paragraphs.map((p, i) => (
          <Text key={i} style={{ marginBottom: 10 }}>{p}</Text>
        ))}
        <Text style={{ marginTop: 6 }}>{c.signoff}</Text>
        <Text style={{ marginTop: 16 }}>{c.name}</Text>
      </Page>
    </Document>
  );
}

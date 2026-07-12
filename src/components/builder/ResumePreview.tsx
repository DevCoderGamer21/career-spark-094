import type { BuilderResumeData, ResumeTemplate } from "@/lib/resume-data";

export function ResumePreview({
  data,
  template,
}: {
  data: BuilderResumeData;
  template: ResumeTemplate;
}) {
  const modern = template === "modern";
  const contactBits = [
    data.personal.email,
    data.personal.phone,
    data.personal.location,
    data.personal.linkedin,
    data.personal.github,
    data.personal.website,
  ].filter(Boolean);

  return (
    <div
      className={`bg-white text-black p-10 shadow-lg mx-auto text-[13px] leading-relaxed ${
        modern ? "font-sans" : "font-serif"
      }`}
      style={{ maxWidth: "8.5in", minHeight: "11in" }}
    >
      {/* Header */}
      <header className={modern ? "mb-4" : "mb-4 text-center"}>
        {data.personal.fullName && (
          <h1
            className="font-bold tracking-tight"
            style={{ fontSize: modern ? "28px" : "24px", color: modern ? "#0A1929" : "#000" }}
          >
            {data.personal.fullName}
          </h1>
        )}
        {data.personal.headline && (
          <p className="text-neutral-600 italic mt-1">{data.personal.headline}</p>
        )}
        {contactBits.length > 0 && (
          <p className="text-neutral-600 text-[11px] mt-2">{contactBits.join("  •  ")}</p>
        )}
        {modern && <div className="mt-3 h-[3px]" style={{ background: "#1976D2" }} />}
      </header>

      <Section title="Summary" show={!!data.summary.trim()} modern={modern}>
        <p>{data.summary}</p>
      </Section>

      <Section title="Experience" show={data.experience.length > 0} modern={modern}>
        {data.experience.map((e, i) => (
          <div key={i} className="mb-3">
            <div className="font-semibold">
              {e.title}
              {e.company && ` — ${e.company}`}
            </div>
            <div className="text-neutral-600 text-[11px]">
              {[e.location, [e.start, e.end].filter(Boolean).join(" – ")].filter(Boolean).join(" | ")}
            </div>
            <ul className="list-disc pl-5 mt-1">
              {e.bullets.filter(Boolean).map((b, j) => (
                <li key={j}>{b}</li>
              ))}
            </ul>
          </div>
        ))}
      </Section>

      <Section title="Projects" show={data.projects.length > 0} modern={modern}>
        {data.projects.map((p, i) => (
          <div key={i} className="mb-2">
            <div className="font-semibold">
              {p.name}
              {p.tech && ` — ${p.tech}`}
            </div>
            {p.link && <div className="text-neutral-600 text-[11px]">{p.link}</div>}
            {p.description && <p>{p.description}</p>}
          </div>
        ))}
      </Section>

      <Section title="Education" show={data.education.length > 0} modern={modern}>
        {data.education.map((ed, i) => (
          <div key={i} className="mb-2">
            <div className="font-semibold">
              {ed.degree}
              {ed.field && `, ${ed.field}`}
            </div>
            <div className="text-neutral-600 text-[11px]">
              {[
                ed.institution,
                [ed.start, ed.end].filter(Boolean).join(" – "),
                ed.gpa && `GPA ${ed.gpa}`,
              ]
                .filter(Boolean)
                .join(" | ")}
            </div>
          </div>
        ))}
      </Section>

      <Section title="Skills" show={data.skills.length > 0} modern={modern}>
        <p>{data.skills.join(" • ")}</p>
      </Section>

      <Section title="Certifications" show={data.certifications.length > 0} modern={modern}>
        <ul className="list-disc pl-5">
          {data.certifications.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </Section>

      <Section title="Achievements" show={data.achievements.length > 0} modern={modern}>
        <ul className="list-disc pl-5">
          {data.achievements.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({
  title,
  show,
  modern,
  children,
}: {
  title: string;
  show: boolean;
  modern: boolean;
  children: React.ReactNode;
}) {
  if (!show) return null;
  return (
    <section className="mt-4">
      <h2
        className="uppercase font-bold text-[12px] tracking-widest pb-1 mb-2 border-b"
        style={{
          color: modern ? "#1976D2" : "#000",
          borderColor: modern ? "#1976D2" : "#000",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

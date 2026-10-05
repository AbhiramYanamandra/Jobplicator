import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Text,
  Heading,
  Stack,
  SimpleGrid,
  Input,
  Textarea,
} from "@chakra-ui/react";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Plus,
  Trash2,
  FilePlus2,
  Printer,
  Save,
  ShieldAlert,
  ShieldCheck,
  Copy,
  Sparkles,
} from "lucide-react";
import {
  api,
  downloadFrom,
  useData,
  Load,
  Panel,
  Title,
  Section,
  Tag,
  Notice,
  Empty,
  Select,
  Meter,
  DataTable,
  statuses,
} from "./ui";

const TABS = [
  ["resume", "Resume"],
  ["cover", "Cover letter"],
  ["answers", "Answers"],
  ["outreach", "Outreach"],
  ["checks", "Checks"],
  ["application", "Application"],
];

const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

function openPrint(title, body, css) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body>${body}</body></html>`,
  );
  w.document.close();
  setTimeout(() => w.print(), 300);
  return true;
}

// **bold** and ^superscript^ markup, after escaping.
export const markup = (s) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\^(.+?)\^/g, "<sup>$1</sup>");

export function contactItems(h) {
  return [
    h.phone && { label: h.phone },
    h.email && { label: "Email", url: `mailto:${h.email}` },
    h.github && { label: "GitHub", url: h.github },
    h.linkedin && { label: "LinkedIn", url: h.linkedin },
    h.website && { label: "Website", url: h.website },
    h.work_rights && { label: h.work_rights },
    h.licence && { label: h.licence },
  ].filter(Boolean);
}

// Mirrors app/services/resume_docx.py so the preview matches the Word file.
const sheetCSS = `.tpl,.tpl *{box-sizing:border-box}
.tpl{font-family:'Times New Roman',Times,serif;color:#000;background:#fff;width:210mm;min-height:297mm;padding:5mm 12.7mm 12.7mm;font-size:9pt;line-height:1.15;text-align:justify}
.tpl p{margin:0}.tpl b{font-weight:bold}.tpl sup{font-size:65%;line-height:0}
.tpl .name{text-align:center;font-size:15pt;font-weight:bold}
.tpl .contact{text-align:center;font-size:10pt}.tpl .contact a{color:#00f;text-decoration:none}
.tpl .tagline{text-align:center}
.tpl h2{font-size:9pt;font-weight:bold;text-transform:uppercase;margin:2pt 0 1pt;padding-bottom:1pt;border-bottom:1pt solid #000;text-align:left}
.tpl .row{display:flex;justify-content:space-between;gap:8pt;text-align:left}
.tpl .row em{font-weight:bold;font-style:italic;white-space:nowrap}
.tpl .role{font-size:10pt}.tpl .gap{margin-top:2pt}
.tpl ul{margin:0;padding-left:36pt;list-style:none}.tpl li{position:relative}.tpl li::before{content:"\\2022";position:absolute;left:-18pt}`;
export const templateCSS = `@page{size:A4;margin:0}body{margin:0;color:#000;background:#fff}${sheetCSS}`;

export function resumeHtml(header, resume) {
  const row = (left, dates, cls = "") =>
    `<div class="row ${cls}"><span>${left}</span>${dates ? `<em>${markup(dates)}</em>` : ""}</div>`;
  const contact = contactItems(header)
    .map((c) =>
      c.url ? `<a href="${esc(c.url)}">${esc(c.label)}</a>` : esc(c.label),
    )
    .join(" | ");
  const bullets = (list) => {
    const items = (list || []).filter((b) => (b.text || "").trim());
    return items.length
      ? `<ul>${items.map((b) => `<li>${markup(b.text)}</li>`).join("")}</ul>`
      : "";
  };
  const ed = resume.education || {};
  const highlights = (ed.highlights || []).filter((h) => (h.text || "").trim());
  const parts = [
    `<p class="name">${esc(header.name)}</p>`,
    `<p class="contact">${contact}</p>`,
  ];
  if (resume.tagline?.text?.trim())
    parts.push(
      `<p class="tagline">“${markup(resume.tagline.text.trim())}”</p>`,
    );
  if (ed.institution || ed.degree) {
    parts.push("<h2>Education</h2>");
    parts.push(row(`<b>${markup(ed.institution)}</b>`, ed.dates));
    if (ed.degree || ed.details) parts.push(row(markup(ed.degree), ed.details));
    if (highlights.length)
      parts.push(
        `<ul>${highlights
          .map((h) => `<li>${row(markup(h.text), h.dates)}</li>`)
          .join("")}</ul>`,
      );
  }
  if (resume.summary?.text?.trim())
    parts.push(`<h2>Summary</h2><p>${markup(resume.summary.text.trim())}</p>`);
  if ((resume.skills || []).length)
    parts.push(
      `<h2>Skills</h2><ul>${resume.skills
        .map((s) => `<li><b>${esc(s.label)}:</b> ${markup(s.value)}</li>`)
        .join("")}</ul>`,
    );
  const section = (kind, title) => {
    const items = (resume[kind] || []).filter(
      (x) => x.title || (x.bullets || []).length,
    );
    if (!items.length) return;
    parts.push(`<h2>${title}</h2>`);
    items.forEach((x, i) => {
      const left =
        kind === "experience"
          ? `<b>${esc(x.title)}</b>${[x.org, x.location].filter(Boolean).length ? ", " + esc([x.org, x.location].filter(Boolean).join(", ")) : ""}`
          : `<b>${esc(x.title)}${x.org ? ": " + esc(x.org) : ""}${x.mark ? " – " + esc(x.mark) : ""}</b>`;
      parts.push(
        row(
          left,
          x.dates,
          `${kind === "experience" ? "role" : ""} ${i ? "gap" : ""}`,
        ) + bullets(x.bullets),
      );
    });
  };
  section("experience", "Professional Experience");
  section("projects", "Research &amp; Selected Technical Projects");
  return `<div class="tpl">${parts.join("")}</div>`;
}

const letterCSS =
  "@page{size:A4;margin:20mm}body{font-family:'Times New Roman',serif;font-size:11pt;line-height:1.45;color:#000;white-space:pre-wrap}";

export function Packages({ revision, go }) {
  const d = useData("/api/packages", revision);
  return (
    <>
      <Title
        title="Your application packages."
        subtitle="One place per job: tailored resume, cover letter, answers, outreach and where the application stands."
        action={
          <Button size="sm" variant="outline" onClick={() => go("jobs")}>
            Find a job to package
            <ArrowRight size={15} />
          </Button>
        }
      />
      <Load {...d}>
        {(d) => (
          <Panel>
            <Section
              title="Packages"
              subtitle={`${d.packages.length} packaged · ${d.jobs_without_package} tracked jobs without a package yet`}
            />
            {d.queued?.length > 0 && (
              <Box mb="5">
                <Text fontSize="sm" fontWeight="600" mb="2">
                  Queued for the next AI run
                </Text>
                <Stack gap="1">
                  {d.queued.map((q) => (
                    <Flex key={q.job_id} gap="2" align="center" wrap="wrap">
                      <Button
                        variant="plain"
                        p="0"
                        h="auto"
                        fontSize="sm"
                        onClick={() => go(`package/${q.job_id}`)}
                      >
                        {q.title}
                      </Button>
                      <Text fontSize="sm" color="muted">
                        {q.company}
                        {q.note ? ` · “${q.note}”` : ""}
                      </Text>
                    </Flex>
                  ))}
                </Stack>
              </Box>
            )}
            {d.packages.length ? (
              <DataTable
                headers={[
                  "Role",
                  "Company",
                  "Package",
                  "Fit",
                  "ATS",
                  "Checks",
                  "Application",
                  "Follow-up",
                ]}
              >
                {d.packages.map((p) => (
                  <tr key={p.job_id}>
                    <td>
                      <Button
                        variant="plain"
                        p="0"
                        h="auto"
                        whiteSpace="normal"
                        textAlign="left"
                        fontWeight="600"
                        onClick={() => go(`package/${p.job_id}`)}
                      >
                        {p.title}
                      </Button>
                    </td>
                    <td>
                      {p.company}
                      <Text color="muted" fontSize="xs">
                        {p.location}
                      </Text>
                    </td>
                    <td>
                      <Tag tone={p.status === "approved" ? "green" : "gray"}>
                        v{p.version} · {p.status}
                      </Tag>
                      {p.package_source === "claude" && (
                        <Text fontSize="xs" color="muted">
                          AI-written
                        </Text>
                      )}
                      {p.requested && (
                        <Text fontSize="xs" color="muted">
                          Rewrite queued
                        </Text>
                      )}
                    </td>
                    <td>{p.fit ?? "–"}</td>
                    <td>{p.ats ?? "–"}</td>
                    <td>
                      {p.errors ? (
                        <Tag tone="red">{p.errors} to fix</Tag>
                      ) : p.warnings ? (
                        <Tag tone="orange">{p.warnings} to review</Tag>
                      ) : (
                        <Tag>Clean</Tag>
                      )}
                    </td>
                    <td>{p.application_status || "Not started"}</td>
                    <td>{p.follow_up_date || "–"}</td>
                  </tr>
                ))}
              </DataTable>
            ) : (
              <Empty>
                No packages yet. Open a job and choose “Open package” to create
                one from your evidence.
              </Empty>
            )}
          </Panel>
        )}
      </Load>
    </>
  );
}

export function PackagePage({ id, revision, go, saved }) {
  const [version, setVersion] = useState(null);
  const d = useData(
    `/api/jobs/${id}/package${version ? `?version=${version}` : ""}`,
    revision,
  );
  return (
    <Load {...d}>
      {(data) => (
        <PackageEditor
          key={`${data.package?.version || 0}-${revision}`}
          id={id}
          data={data}
          go={go}
          saved={saved}
          setVersion={setVersion}
        />
      )}
    </Load>
  );
}

function evidenceFlags(checks, where) {
  return (checks?.flags || []).filter((f) => f.where === where);
}

function FlagList({ flags }) {
  if (!flags.length) return null;
  return (
    <Stack gap="1" mt="1">
      {flags.map((f, i) => (
        <Text
          key={i}
          fontSize="xs"
          color={f.severity === "error" ? "red.fg" : "orange.fg"}
        >
          {f.severity === "error" ? "✕ " : "! "}
          {f.message}
        </Text>
      ))}
    </Stack>
  );
}

function Chips({ ids, evidence, onChange }) {
  const [adding, setAdding] = useState("");
  return (
    <Flex gap="1" wrap="wrap" mt="1" align="center">
      {ids.map((e) => (
        <Button
          key={e}
          size="2xs"
          variant="subtle"
          colorPalette={evidence[e] ? "green" : "red"}
          title={
            evidence[e]
              ? `${evidence[e].raw_fact}${evidence[e].claim_restriction ? `\nRestriction: ${evidence[e].claim_restriction}` : ""}`
              : "Not in your evidence database (save to re-check)"
          }
          onClick={() => onChange(ids.filter((x) => x !== e))}
          aria-label={`Remove evidence ${e}`}
        >
          {e} ×
        </Button>
      ))}
      <Input
        size="2xs"
        w="120px"
        placeholder="+ evidence id"
        value={adding}
        aria-label="Add evidence id"
        onChange={(e) => setAdding(e.target.value.toUpperCase())}
        onKeyDown={(e) => {
          if (e.key === "Enter" && adding.trim()) {
            onChange([...new Set([...ids, adding.trim()])]);
            setAdding("");
          }
        }}
      />
    </Flex>
  );
}

function RequestPanel({ id, request, hasPackage, busy, run }) {
  const [open, setOpen] = useState(false),
    [note, setNote] = useState(request?.note || "");
  if (request)
    return (
      <Notice>
        <Flex justify="space-between" align="center" gap="3" wrap="wrap">
          <Text>
            Queued for the AI generator, which runs daily at 8:46am (or run
            “Jobplicator package generator” now from your Claude scheduled
            tasks).
            {request.note ? ` Your note: “${request.note}”` : ""}
          </Text>
          <Button
            size="xs"
            variant="outline"
            disabled={busy}
            onClick={() =>
              run(
                () => api(`/api/jobs/${id}/package/request/cancel`, {}),
                "Request cancelled",
              )
            }
          >
            Cancel request
          </Button>
        </Flex>
      </Notice>
    );
  return open ? (
    <Panel p="4">
      <Text fontSize="sm" fontWeight="600" mb="2">
        {hasPackage
          ? "Ask AI to rewrite this package"
          : "Ask AI to write this package"}
      </Text>
      <Textarea
        size="sm"
        rows={2}
        aria-label="Note for the AI generator"
        placeholder="Optional: e.g. lead with FPGA work, keep the cover letter shorter"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <Flex gap="2" mt="2">
        <Button
          size="sm"
          colorPalette="green"
          disabled={busy}
          onClick={() =>
            run(
              () => api(`/api/jobs/${id}/package/request`, { note }),
              "Queued for the next AI run",
            )
          }
        >
          Queue for AI
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </Flex>
    </Panel>
  ) : (
    <Button
      size="sm"
      variant="outline"
      alignSelf="start"
      onClick={() => setOpen(true)}
    >
      <Sparkles size={15} />
      {hasPackage ? "Ask AI to rewrite" : "Ask AI to write this package"}
    </Button>
  );
}

function EducationEditor({ education, checks, edit }) {
  const ed = education || {};
  const highlights = ed.highlights || [];
  const set = (key) => (e) =>
    edit((c) => {
      c.resume.education[key] = e.target.value;
    });
  const setHighlight = (i, key) => (e) =>
    edit((c) => {
      c.resume.education.highlights[i][key] = e.target.value;
    });
  return (
    <Panel>
      <Section
        title="Education"
        subtitle="Marks and numbers must match your profile and coursework results."
      />
      <SimpleGrid columns={{ base: 1, md: 2 }} gap="2" mb="2">
        <Input
          size="sm"
          aria-label="Institution"
          value={ed.institution || ""}
          onChange={set("institution")}
        />
        <Input
          size="sm"
          aria-label="Study dates"
          value={ed.dates || ""}
          onChange={set("dates")}
        />
        <Input
          size="sm"
          aria-label="Degree"
          value={ed.degree || ""}
          onChange={set("degree")}
        />
        <Input
          size="sm"
          aria-label="WAM"
          value={ed.details || ""}
          onChange={set("details")}
        />
      </SimpleGrid>
      <FlagList flags={evidenceFlags(checks, "Education")} />
      <Text fontSize="xs" fontWeight="600" mt="3" mb="1">
        Highlights
      </Text>
      {highlights.map((h, i) => (
        <Box key={i} mb="2">
          <Flex gap="2">
            <Input
              size="sm"
              aria-label={`Highlight ${i + 1}`}
              value={h.text}
              onChange={setHighlight(i, "text")}
            />
            <Input
              size="sm"
              w="170px"
              placeholder="Dates (optional)"
              aria-label={`Highlight ${i + 1} dates`}
              value={h.dates || ""}
              onChange={setHighlight(i, "dates")}
            />
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Remove highlight ${i + 1}`}
              onClick={() =>
                edit((c) => {
                  c.resume.education.highlights.splice(i, 1);
                })
              }
            >
              <Trash2 size={14} />
            </Button>
          </Flex>
          <FlagList
            flags={evidenceFlags(checks, `Education · highlight ${i + 1}`)}
          />
        </Box>
      ))}
      <Button
        size="xs"
        variant="outline"
        disabled={highlights.length >= 8}
        onClick={() =>
          edit((c) => {
            c.resume.education.highlights = [
              ...(c.resume.education.highlights || []),
              { text: "", dates: "", evidence_ids: [] },
            ];
          })
        }
      >
        <Plus size={14} />
        Add highlight
      </Button>
    </Panel>
  );
}

function PackageEditor({ id, data, go, saved, setVersion }) {
  const {
    job,
    package: pkg,
    versions,
    evidence,
    header,
    application,
    request,
  } = data;
  const [tab, setTab] = useState("resume"),
    [content, setContent] = useState(() =>
      pkg ? structuredClone(pkg.content) : null,
    ),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [app, setApp] = useState(() => ({
      status: application?.status || "saved",
      follow_up_date: application?.follow_up_date || "",
      next_action: application?.next_action || "",
      notes: application?.notes || "",
    }));
  useEffect(() => {
    const warn = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const edit = (fn) => {
    setContent((c) => {
      const next = structuredClone(c);
      fn(next);
      return next;
    });
    setDirty(true);
  };
  const run = async (fn, message) => {
    setError("");
    setBusy(true);
    try {
      await fn();
      setDirty(false);
      setVersion(null);
      saved(message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const previewRef = useRef(null),
    [zoom, setZoom] = useState(0.7);
  useEffect(() => {
    const el = previewRef.current?.parentElement;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) =>
      setZoom(Math.min(1, (entry.contentRect.width - 4) / 794)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [tab]);
  const checks = pkg?.checks;
  const errors = checks?.errors || 0,
    warnings = checks?.warnings || 0;
  const resume = content?.resume;
  const copy = (text) => navigator.clipboard?.writeText(text || "");
  const printResume = () =>
    openPrint(
      `${header.name} resume ${job.company}`,
      resumeHtml(header, resume),
      templateCSS,
    ) || setError("Please allow the print window, then try again.");
  const downloadWord = async () => {
    setError("");
    try {
      await downloadFrom(
        `/api/jobs/${id}/package/resume.docx`,
        { resume },
        "Resume.docx",
      );
    } catch (e) {
      setError(e.message);
    }
  };
  const printLetter = () =>
    openPrint(
      `${header.name} cover letter ${job.company}`,
      esc(content.cover_letter),
      letterCSS,
    ) || setError("Please allow the print window, then try again.");

  return (
    <>
      <Button
        variant="plain"
        p="0"
        size="sm"
        mb="4"
        onClick={() => go("packages")}
      >
        ← All packages
      </Button>
      <Title
        title={job.title}
        subtitle={`${job.company} · ${job.location || "Location not listed"} · ${job.source}`}
        action={
          <Flex gap="2" wrap="wrap">
            <Button size="sm" variant="outline" onClick={() => go(`job/${id}`)}>
              Job details
            </Button>
            {pkg && (
              <Box w="240px">
                <Select
                  label="Package version"
                  value={String(pkg.version)}
                  onChange={(e) => {
                    if (
                      dirty &&
                      !window.confirm(
                        "Discard unsaved changes to this version?",
                      )
                    )
                      return;
                    setVersion(Number(e.target.value));
                  }}
                  options={versions.map((v) => ({
                    value: String(v.version),
                    label: `v${v.version} · ${v.status} · ${v.source}`,
                  }))}
                />
              </Box>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                run(
                  () => api(`/api/jobs/${id}/package/draft`, {}),
                  "New draft built from your evidence",
                )
              }
            >
              <FilePlus2 size={15} />
              {pkg ? "New draft from evidence" : "Create package from evidence"}
            </Button>
            {pkg && (
              <>
                <Button
                  size="sm"
                  colorPalette="green"
                  disabled={busy || !dirty}
                  onClick={() =>
                    run(
                      () =>
                        api(`/api/jobs/${id}/package`, {
                          content,
                          source: "manual",
                        }),
                      "Saved as a new version and re-checked",
                    )
                  }
                >
                  <Save size={15} />
                  Save as new version
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || dirty || pkg.status === "approved"}
                  title={
                    errors
                      ? "Approving with open errors is allowed, but fix them first if you can."
                      : ""
                  }
                  onClick={() =>
                    run(
                      () =>
                        api(
                          `/api/jobs/${id}/package/${pkg.version}/approve`,
                          {},
                        ),
                      `Version ${pkg.version} approved`,
                    )
                  }
                >
                  <CheckCircle2 size={15} />
                  {pkg.status === "approved" ? "Approved" : "Approve"}
                </Button>
              </>
            )}
          </Flex>
        }
      />
      {error && <Notice tone="red">{error}</Notice>}
      <Stack mb="5">
        <RequestPanel
          id={id}
          request={request}
          hasPackage={!!pkg}
          busy={busy || dirty}
          run={run}
        />
      </Stack>
      {!pkg ? (
        <Panel>
          <Empty>
            No package for this job yet. “Ask AI to write this package” queues a
            tailored, evidence-checked package for the next generator run.
            “Create package from evidence” builds an instant starter draft using
            only verbatim lines from your evidence database.
          </Empty>
        </Panel>
      ) : (
        <>
          <SimpleGrid columns={{ base: 1, md: 4 }} gap="4" mb="5">
            <Panel p="4">
              <Meter
                value={content.scores.fit}
                label="Fit"
                note={content.scores.fit == null ? "–" : undefined}
              />
            </Panel>
            <Panel p="4">
              <Meter
                value={content.scores.ats}
                label="ATS"
                note={content.scores.ats == null ? "Not scored" : undefined}
              />
            </Panel>
            <Panel p="4">
              <Flex align="center" gap="2">
                {errors ? (
                  <ShieldAlert size={18} color="#c53030" />
                ) : (
                  <ShieldCheck size={18} />
                )}
                <Text fontSize="sm" fontWeight="600">
                  {errors
                    ? `${errors} claim${errors > 1 ? "s" : ""} to fix`
                    : "No blocking issues"}
                </Text>
              </Flex>
              <Text fontSize="xs" color="muted" mt="1">
                {warnings} to review · checked against your evidence
              </Text>
            </Panel>
            <Panel p="4">
              <Text fontSize="xs" color="muted">
                Version {pkg.version} · {pkg.source}
              </Text>
              <Text fontSize="sm" fontWeight="600" mt="1">
                {pkg.status === "approved" ? "Approved to send" : "Draft"}
                {dirty ? " · unsaved edits" : ""}
              </Text>
              <Text fontSize="xs" color="muted" mt="1">
                Application: {application?.status || "not started"}
              </Text>
            </Panel>
          </SimpleGrid>
          <Flex
            gap="1"
            mb="5"
            wrap="wrap"
            role="tablist"
            aria-label="Package sections"
          >
            {TABS.map(([key, label]) => (
              <Button
                key={key}
                role="tab"
                aria-selected={tab === key}
                size="sm"
                variant={tab === key ? "solid" : "ghost"}
                colorPalette={tab === key ? "green" : "gray"}
                onClick={() => setTab(key)}
              >
                {label}
                {key === "checks" && errors + warnings > 0
                  ? ` (${errors + warnings})`
                  : ""}
              </Button>
            ))}
          </Flex>
          {content.scores.summary && (
            <Text fontSize="sm" color="muted" mb="5" maxW="900px">
              {content.scores.summary}
            </Text>
          )}
          {tab === "resume" && (
            <SimpleGrid columns={{ base: 1, xl: 2 }} gap="5" alignItems="start">
              <Stack gap="4">
                <Panel>
                  <Section
                    title="Summary"
                    subtitle={
                      resume.variant
                        ? `Tailored toward ${resume.variant}`
                        : undefined
                    }
                  />
                  <Textarea
                    aria-label="Resume summary"
                    value={resume.summary.text}
                    onChange={(e) =>
                      edit((c) => (c.resume.summary.text = e.target.value))
                    }
                  />
                  <FlagList flags={evidenceFlags(checks, "Resume summary")} />
                  <Text fontSize="xs" color="muted" mt="2">
                    Wrap words in **double asterisks** to make them bold.
                  </Text>
                </Panel>
                <Panel>
                  <Section
                    title="Tagline"
                    subtitle="One quoted line under your contact details. Leave empty to hide it."
                  />
                  <Input
                    size="sm"
                    aria-label="Resume tagline"
                    value={resume.tagline?.text || ""}
                    onChange={(e) =>
                      edit((c) => {
                        c.resume.tagline = {
                          ...(c.resume.tagline || { evidence_ids: [] }),
                          text: e.target.value,
                        };
                      })
                    }
                  />
                  <Chips
                    ids={resume.tagline?.evidence_ids || []}
                    evidence={evidence}
                    onChange={(ids) =>
                      edit((c) => {
                        c.resume.tagline = {
                          ...(c.resume.tagline || { text: "" }),
                          evidence_ids: ids,
                        };
                      })
                    }
                  />
                  <FlagList flags={evidenceFlags(checks, "Resume tagline")} />
                </Panel>
                <EducationEditor
                  education={resume.education}
                  checks={checks}
                  edit={edit}
                />
                <Panel>
                  <Section
                    title="Skills"
                    subtitle="Only skills your evidence supports pass the checks."
                  />
                  {resume.skills.map((s, i) => (
                    <Box key={i} mb="3">
                      <Flex gap="2">
                        <Input
                          size="sm"
                          w="140px"
                          aria-label="Skill group"
                          value={s.label}
                          onChange={(e) =>
                            edit(
                              (c) =>
                                (c.resume.skills[i].label = e.target.value),
                            )
                          }
                        />
                        <Input
                          size="sm"
                          aria-label={`Skills in ${s.label}`}
                          value={s.value}
                          onChange={(e) =>
                            edit(
                              (c) =>
                                (c.resume.skills[i].value = e.target.value),
                            )
                          }
                        />
                      </Flex>
                      <FlagList
                        flags={evidenceFlags(checks, `Skills · ${s.label}`)}
                      />
                    </Box>
                  ))}
                </Panel>
                {["experience", "projects"].map((kind) => (
                  <Panel key={kind}>
                    <Section
                      title={kind === "experience" ? "Experience" : "Projects"}
                      subtitle="Hover an evidence chip to see the fact it cites. Every bullet needs at least one."
                    />
                    {resume[kind].length === 0 && <Empty>None selected.</Empty>}
                    {resume[kind].map((item, i) => {
                      const label =
                        item.title || item.org || `${kind} ${i + 1}`;
                      return (
                        <Box key={i} mb="5">
                          <Heading size="sm">{item.title}</Heading>
                          <Text fontSize="xs" color="muted" mb="2">
                            {[item.org, item.location, item.dates]
                              .filter(Boolean)
                              .join(" · ")}
                          </Text>
                          {kind === "projects" && (
                            <Input
                              size="sm"
                              w="160px"
                              mb="2"
                              placeholder="Mark, e.g. 89 HD"
                              aria-label={`${label} mark`}
                              value={item.mark || ""}
                              onChange={(e) =>
                                edit(
                                  (c) =>
                                    (c.resume.projects[i].mark =
                                      e.target.value),
                                )
                              }
                            />
                          )}
                          <FlagList flags={evidenceFlags(checks, label)} />
                          {item.bullets.map((b, j) => (
                            <Box
                              key={j}
                              mb="3"
                              pl="3"
                              borderLeft="2px solid"
                              borderColor="line"
                            >
                              <Textarea
                                size="sm"
                                rows={2}
                                aria-label={`${label} bullet ${j + 1}`}
                                value={b.text}
                                onChange={(e) =>
                                  edit(
                                    (c) =>
                                      (c.resume[kind][i].bullets[j].text =
                                        e.target.value),
                                  )
                                }
                              />
                              <Chips
                                ids={b.evidence_ids}
                                evidence={evidence}
                                onChange={(ids) =>
                                  edit(
                                    (c) =>
                                      (c.resume[kind][i].bullets[
                                        j
                                      ].evidence_ids = ids),
                                  )
                                }
                              />
                              <FlagList
                                flags={evidenceFlags(
                                  checks,
                                  `${label} · bullet ${j + 1}`,
                                )}
                              />
                            </Box>
                          ))}
                        </Box>
                      );
                    })}
                  </Panel>
                ))}
              </Stack>
              <Box position={{ xl: "sticky" }} top="4">
                <Flex justify="space-between" align="center" mb="2">
                  <Text fontSize="xs" color="muted">
                    Preview · header comes from your profile (
                    {header.email || "no email set"})
                  </Text>
                  <Flex gap="2">
                    <Button size="xs" variant="outline" onClick={downloadWord}>
                      <Download size={14} />
                      Word
                    </Button>
                    <Button size="xs" variant="outline" onClick={printResume}>
                      <Printer size={14} />
                      Print / PDF
                    </Button>
                  </Flex>
                </Flex>
                <Box overflow="hidden" p="2" bg="soft" borderRadius="lg">
                  <style>{sheetCSS}</style>
                  {/* The A4 sheet is 210mm (~794px) wide; zoom it to fit the column. */}
                  <Box
                    ref={previewRef}
                    style={{ zoom }}
                    bg="white"
                    boxShadow="sm"
                  >
                    <div
                      dangerouslySetInnerHTML={{
                        __html: resumeHtml(header, resume),
                      }}
                    />
                  </Box>
                </Box>
              </Box>
            </SimpleGrid>
          )}
          {tab === "cover" && (
            <Panel>
              <Section
                title="Cover letter"
                action={
                  <Flex gap="2">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => copy(content.cover_letter)}
                    >
                      <Copy size={14} />
                      Copy
                    </Button>
                    <Button size="xs" variant="outline" onClick={printLetter}>
                      <Printer size={14} />
                      Print / PDF
                    </Button>
                  </Flex>
                }
              />
              <Textarea
                aria-label="Cover letter"
                rows={22}
                value={content.cover_letter}
                onChange={(e) => edit((c) => (c.cover_letter = e.target.value))}
              />
            </Panel>
          )}
          {tab === "answers" && (
            <Stack gap="4">
              {content.answers.length === 0 && (
                <Panel>
                  <Empty>No application answers in this version.</Empty>
                </Panel>
              )}
              {content.answers.map((a, i) => (
                <Panel key={i}>
                  <Section
                    title={a.question}
                    action={
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => copy(a.answer)}
                      >
                        <Copy size={14} />
                        Copy
                      </Button>
                    }
                  />
                  <Textarea
                    aria-label={a.question}
                    rows={5}
                    value={a.answer}
                    onChange={(e) =>
                      edit((c) => (c.answers[i].answer = e.target.value))
                    }
                  />
                  <Chips
                    ids={a.evidence_ids}
                    evidence={evidence}
                    onChange={(ids) =>
                      edit((c) => (c.answers[i].evidence_ids = ids))
                    }
                  />
                  <FlagList flags={evidenceFlags(checks, `Answer ${i + 1}`)} />
                </Panel>
              ))}
            </Stack>
          )}
          {tab === "outreach" && (
            <Panel>
              <Section
                title="Outreach"
                subtitle="Hiring manager details are unverified until you confirm them."
              />
              <Stack gap="4">
                {[
                  ["hiring_manager", "Likely hiring manager", false],
                  ["linkedin_query", "LinkedIn search", false],
                  [
                    "linkedin_message",
                    "Connection message (under 300 characters)",
                    true,
                  ],
                  ["email", "Email draft", true],
                ].map(([key, label, long]) => (
                  <Box key={key}>
                    <Flex justify="space-between" align="center" mb="1">
                      <Text fontSize="sm" fontWeight="600">
                        {label}
                        {key === "linkedin_message" &&
                          ` · ${content.outreach[key].length}/300`}
                      </Text>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => copy(content.outreach[key])}
                      >
                        <Copy size={13} />
                      </Button>
                    </Flex>
                    {long ? (
                      <Textarea
                        aria-label={label}
                        rows={key === "email" ? 6 : 3}
                        value={content.outreach[key]}
                        onChange={(e) =>
                          edit((c) => (c.outreach[key] = e.target.value))
                        }
                      />
                    ) : (
                      <Input
                        aria-label={label}
                        value={content.outreach[key]}
                        onChange={(e) =>
                          edit((c) => (c.outreach[key] = e.target.value))
                        }
                      />
                    )}
                  </Box>
                ))}
                {content.outreach.linkedin_query && (
                  <a
                    href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
                      content.outreach.linkedin_query,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open LinkedIn search ↗
                  </a>
                )}
              </Stack>
            </Panel>
          )}
          {tab === "checks" && (
            <Panel>
              <Section
                title="Evidence checks"
                subtitle={`Run when this version was saved (${checks?.checked_at?.slice(0, 16).replace("T", " ") || "never"}). Save again after editing to re-check.`}
              />
              {content.notes && (
                <Box mb="4">
                  <Text fontSize="sm" fontWeight="600" mb="1">
                    Notes from{" "}
                    {pkg.source === "claude" ? "the generator" : "this draft"}
                  </Text>
                  <Text fontSize="sm" color="muted">
                    {content.notes}
                  </Text>
                </Box>
              )}
              {(checks?.flags || []).length === 0 ? (
                <Notice>
                  Every claim traces back to your evidence database.
                </Notice>
              ) : (
                <DataTable headers={["Severity", "Where", "Issue"]}>
                  {checks.flags.map((f, i) => (
                    <tr key={i}>
                      <td>
                        <Tag tone={f.severity === "error" ? "red" : "orange"}>
                          {f.severity}
                        </Tag>
                      </td>
                      <td>{f.where}</td>
                      <td>{f.message}</td>
                    </tr>
                  ))}
                </DataTable>
              )}
              {content.scores.gaps?.length > 0 && (
                <Box mt="5">
                  <Text fontSize="sm" fontWeight="600" mb="2">
                    Job requirements with no supporting evidence
                  </Text>
                  <Flex gap="2" wrap="wrap">
                    {content.scores.gaps.map((g) => (
                      <Tag key={g} tone="gray">
                        {g}
                      </Tag>
                    ))}
                  </Flex>
                </Box>
              )}
            </Panel>
          )}
          {tab === "application" && (
            <Panel>
              <Section
                title="Application tracking"
                subtitle="Same record as the Applications board."
              />
              <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
                <Box>
                  <Text fontSize="sm" mb="1">
                    Status
                  </Text>
                  <Select
                    label="Application status"
                    value={app.status}
                    onChange={(e) => setApp({ ...app, status: e.target.value })}
                    options={statuses}
                  />
                </Box>
                <Box>
                  <Text fontSize="sm" mb="1">
                    Follow-up date
                  </Text>
                  <Input
                    type="date"
                    size="sm"
                    aria-label="Follow-up date"
                    value={app.follow_up_date}
                    onChange={(e) =>
                      setApp({ ...app, follow_up_date: e.target.value })
                    }
                  />
                </Box>
                <Box>
                  <Text fontSize="sm" mb="1">
                    Next action
                  </Text>
                  <Input
                    size="sm"
                    aria-label="Next action"
                    value={app.next_action}
                    onChange={(e) =>
                      setApp({ ...app, next_action: e.target.value })
                    }
                  />
                </Box>
                <Box>
                  <Text fontSize="sm" mb="1">
                    Notes
                  </Text>
                  <Textarea
                    size="sm"
                    aria-label="Application notes"
                    value={app.notes}
                    onChange={(e) => setApp({ ...app, notes: e.target.value })}
                  />
                </Box>
              </SimpleGrid>
              {dirty && (
                <Text fontSize="xs" color="orange.fg" mt="4">
                  Save your package edits first; saving the application reloads
                  this page.
                </Text>
              )}
              <Button
                mt="4"
                size="sm"
                colorPalette="green"
                disabled={busy || dirty}
                onClick={() =>
                  run(
                    () =>
                      api(`/api/jobs/${id}/application`, {
                        status: app.status,
                        follow_up_date: app.follow_up_date || null,
                        next_action: app.next_action || null,
                        notes: app.notes || null,
                        applied_at:
                          app.status === "applied" && !application?.applied_at
                            ? new Date().toISOString().slice(0, 10)
                            : null,
                        resume_version: `package v${pkg.version}`,
                        cover_letter_version: `package v${pkg.version}`,
                      }),
                    "Application updated",
                  )
                }
              >
                Save application
              </Button>
            </Panel>
          )}
        </>
      )}
    </>
  );
}

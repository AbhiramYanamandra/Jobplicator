import React, { useState, useEffect, useRef } from "react";
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
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Download,
  Printer,
  Save,
  ShieldCheck,
} from "lucide-react";
import { INITIAL_RESUME } from "./resume-data";
import { useAuth } from "./auth";
import {
  api,
  useData,
  Load,
  Panel,
  Title,
  Section,
  Tag,
  Notice,
  Empty,
  Select,
  Modal,
  SearchBox,
  download,
} from "./ui";
const clone = () => structuredClone(INITIAL_RESUME);
const validResume = (r) =>
  r &&
  typeof r.summary === "string" &&
  r.education &&
  Array.isArray(r.skills) &&
  Array.isArray(r.experience) &&
  Array.isArray(r.projects) &&
  [...r.experience, ...r.projects].every(
    (i) =>
      Array.isArray(i.bullets) &&
      i.bullets.every((b) => typeof b.text === "string"),
  );
const split = (v) =>
  String(v || "")
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
function variants(e) {
  const action = e.action && e.action !== "—" ? e.action : e.raw_fact,
    result = e.result && e.result !== "—" ? e.result : "",
    metric = e.metric && e.metric !== "—" ? e.metric : "",
    tech = split(e.technologies).slice(0, 4).join(", ");
  return [
    {
      label: "Concise",
      text:
        [action, result].filter(Boolean).join(", ").replace(/\.$/, "") + ".",
    },
    {
      label: "Impact",
      text:
        (
          action +
          (result ? `, ${result[0].toLowerCase() + result.slice(1)}` : "") +
          (metric ? ` (${metric})` : "")
        ).replace(/\.$/, "") + ".",
    },
    {
      label: "Technical",
      text:
        (
          action +
          (tech ? ` using ${tech}` : "") +
          (result ? `, ${result[0].toLowerCase() + result.slice(1)}` : "")
        ).replace(/\.$/, "") + ".",
    },
  ];
}
export const printCSS = `@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;color:#000;background:#fff}.resume-sheet{font-family:'Times New Roman',serif;width:210mm;min-height:297mm;padding:5mm 12.7mm 12.7mm;font-size:9pt;line-height:1.05}header{text-align:center;margin-bottom:2pt}header h1{font-size:15pt;margin:0}header p{font-size:10pt;margin:0}section{margin-top:2pt}h2{font-size:9pt;font-weight:bold;border-bottom:.7pt solid black;margin:0 0 1pt}h3{font-size:9pt;margin:0}p,li{margin:0}ul{padding-left:17pt;margin:0}.resume-row{display:flex;justify-content:space-between;gap:8pt}.resume-row em{white-space:nowrap;font-weight:bold}.resume-item{margin-bottom:2pt;break-inside:avoid}.resume-skill{padding-left:12pt}`;
export default function ResumeStudio(props) {
  const cloud = useData("/api/resume-draft");
  const { user } = useAuth();
  return (
    <Load {...cloud}>
      {(record) => (
        <ResumeEditor {...props} initialCloud={record} userId={user.id} />
      )}
    </Load>
  );
}
function ResumeEditor({ revision, saved, initialCloud, userId }) {
  const profile = useData("/api/profile", revision),
    jobs = useData("/api/jobs", revision);
  const [resume, setResume] = useState(() =>
      validResume(initialCloud.content?.resume)
        ? initialCloud.content.resume
        : clone(),
    ),
    [section, setSection] = useState("summary"),
    [target, setTarget] = useState(
      () => sessionStorage.getItem(`jobplicator-target:${userId}`) || "",
    ),
    [version, setVersion] = useState("Tailored resume"),
    [picker, setPicker] = useState(null),
    [selectedEvidence, setSelectedEvidence] = useState(null),
    [evidenceQuery, setEvidenceQuery] = useState(""),
    [error, setError] = useState(""),
    [storageError, setStorageError] = useState(""),
    [busy, setBusy] = useState(false),
    [pageRatio, setPageRatio] = useState(1),
    [reset, setReset] = useState(false);
  const content = useRef(),
    sheet = useRef(),
    file = useRef();
  const documents = useData(
    target ? `/api/jobs/${target}/documents` : null,
    revision,
  );
  const [restore, setRestore] = useState(null);
  const [contact, setContact] = useState(
    () => initialCloud.content?.contact || { name: "", line: "" },
  );
  const [cloudRevision, setCloudRevision] = useState(initialCloud.revision);
  const [cloudBusy, setCloudBusy] = useState(false),
    [loadConfirm, setLoadConfirm] = useState(false);
  const [savedContent, setSavedContent] = useState(
    JSON.stringify(
      initialCloud.content || {
        resume: clone(),
        contact: { name: "", line: "" },
      },
    ),
  );
  const recoveryKey = `jobplicator-resume:${userId}`;
  const [recoveryDraft, setRecoveryDraft] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(recoveryKey));
    } catch {
      return null;
    }
  });
  const recoveryPending =
    recoveryDraft &&
    JSON.stringify(recoveryDraft.content) !==
      JSON.stringify(initialCloud.content);
  const currentContent = { resume, contact };
  const dirty = JSON.stringify(currentContent) !== savedContent;
  useEffect(() => {
    if (recoveryPending) return;
    try {
      localStorage.setItem(
        recoveryKey,
        JSON.stringify({
          content: { resume, contact },
          revision: cloudRevision,
        }),
      );
      setStorageError("");
    } catch {
      setStorageError(
        "Browser recovery storage is unavailable. Save your cloud draft or export a JSON backup.",
      );
    }
  }, [resume, contact, cloudRevision, recoveryKey, recoveryPending]);
  async function saveCloud() {
    setCloudBusy(true);
    setError("");
    try {
      const result = await api("/api/resume-draft", {
        content: currentContent,
        revision: cloudRevision,
      });
      setCloudRevision(result.revision);
      setSavedContent(JSON.stringify(result.content));
      setRecoveryDraft(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCloudBusy(false);
    }
  }
  async function loadCloud() {
    setCloudBusy(true);
    setError("");
    try {
      const result = await api("/api/resume-draft");
      const data = result.content || {
        resume: clone(),
        contact: { name: "", line: "" },
      };
      setResume(data.resume);
      setContact(data.contact || { name: "", line: "" });
      setCloudRevision(result.revision);
      setSavedContent(JSON.stringify(data));
      setLoadConfirm(false);
      setRecoveryDraft(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCloudBusy(false);
    }
  }
  useEffect(() => {
    sessionStorage.setItem(`jobplicator-target:${userId}`, target);
  }, [target]);
  useEffect(() => {
    const measure = () => {
      if (!sheet.current || !content.current) return;
      const css = getComputedStyle(sheet.current);
      const usable =
        1122.52 - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom);
      setPageRatio(content.current.scrollHeight / usable);
    };
    const frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    if (content.current) observer.observe(content.current);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [resume, contact, profile.data]);
  const change = (fn) =>
    setResume((r) => {
      const n = structuredClone(r);
      fn(n);
      return n;
    });
  const updateItem = (kind, i, key, value) =>
    change((r) => {
      r[kind][i][key] = value;
    });
  const move = (kind, i, d) =>
    change((r) => {
      const t = i + d;
      if (t >= 0 && t < r[kind].length)
        [r[kind][i], r[kind][t]] = [r[kind][t], r[kind][i]];
    });
  const choose = (kind, i, j = null) => {
    setPicker({ kind, i, j });
    setSelectedEvidence(null);
    setEvidenceQuery("");
  };
  const exportHtml = () =>
    `<!doctype html><html><head><meta charset="utf-8"><title>Resume</title><style>${printCSS}</style></head><body>${sheet.current?.outerHTML || ""}</body></html>`;
  const print = () => {
    const w = window.open("", "_blank");
    if (!w) {
      setError("Please allow the print window, then try again.");
      return;
    }
    w.document.write(exportHtml());
    w.document.close();
    setTimeout(() => {
      w.focus();
      w.print();
    }, 300);
  };
  return (
    <>
      <Title
        title="Make your experience count."
        subtitle="An evidence-backed resume, shaped for your next opportunity."
        action={
          <Flex gap="2" wrap="wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                download(
                  "resume-backup.json",
                  JSON.stringify({ resume, contact }, null, 2),
                )
              }
            >
              <Download size={14} />
              Backup
            </Button>
            <Button
              size="sm"
              colorPalette="green"
              disabled={pageRatio > 1.005}
              onClick={print}
            >
              <Printer size={14} />
              Print / PDF
            </Button>
          </Flex>
        }
      />
      {(error || storageError) && (
        <Box mb="4">
          <Notice tone="red">{error || storageError}</Notice>
        </Box>
      )}
      <Panel mb="5">
        <Flex gap="3" align="center" wrap="wrap">
          <Button
            size="sm"
            colorPalette="green"
            loading={cloudBusy}
            onClick={saveCloud}
          >
            Save cloud draft
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLoadConfirm(true)}
          >
            Load latest cloud draft
          </Button>
          <Tag tone={dirty ? "orange" : "green"}>
            {dirty ? "Unsaved cloud changes" : "Cloud draft up to date"}
          </Tag>
        </Flex>
        {recoveryDraft &&
          JSON.stringify(recoveryDraft.content) !==
            JSON.stringify(initialCloud.content) && (
            <Box mt="4">
              <Notice>
                A browser recovery copy is available. Restoring it changes this
                editor only until you save it to the cloud.
              </Notice>
              <Button
                size="xs"
                mt="3"
                variant="outline"
                onClick={() => {
                  if (validResume(recoveryDraft.content?.resume)) {
                    setResume(recoveryDraft.content.resume);
                    setContact(
                      recoveryDraft.content.contact || { name: "", line: "" },
                    );
                    setRecoveryDraft(null);
                  } else
                    setError("This recovery copy has an unsupported format.");
                }}
              >
                Restore browser recovery
              </Button>
              <Button
                size="xs"
                mt="3"
                ml="2"
                variant="plain"
                onClick={() => setRecoveryDraft(null)}
              >
                Discard browser recovery
              </Button>
            </Box>
          )}
      </Panel>
      <Panel mb="5">
        <Flex gap="3" wrap="wrap" align="end">
          <Box flex="2" minW="200px">
            <Text fontSize="xs" color="muted" mb="2">
              TARGET OPPORTUNITY
            </Text>
            <Select
              label="Resume target opportunity"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              options={[
                { value: "", label: "General resume" },
                ...(jobs.data || []).map((j) => ({
                  value: j.id,
                  label: `${j.company} · ${j.title}`,
                })),
              ]}
            />
          </Box>
          <Box flex="1" minW="160px">
            <Text fontSize="xs" color="muted" mb="2">
              VERSION NAME
            </Text>
            <Input
              size="sm"
              aria-label="Resume version name"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            />
          </Box>
          <Button
            size="sm"
            colorPalette="green"
            loading={busy}
            disabled={!target || !version.trim()}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await api(`/api/jobs/${target}/resume-version`, {
                  name: version,
                  content: { ...resume, contact },
                  fit_score: null,
                });
                saved("Resume version saved to the application");
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Save size={14} />
            Save version
          </Button>
        </Flex>
        <Text fontSize="xs" color="muted" mt="3">
          Save the cloud draft to continue on another device. Browser recovery
          copies stay on this device. Choose a role to save a named version;
          saving does not recalculate fit.
        </Text>
      </Panel>
      <Flex gap="2" wrap="wrap" mb="5">
        {[
          ["summary", "Profile & summary"],
          ["education", "Education"],
          ["skills", "Skills"],
          ["experience", "Experience"],
          ["projects", "Projects"],
        ].map(([k, l]) => (
          <Button
            size="sm"
            variant={section === k ? "solid" : "outline"}
            colorPalette="green"
            key={k}
            onClick={() => setSection(k)}
          >
            {l}
          </Button>
        ))}
      </Flex>
      <SimpleGrid
        columns={{ base: 1, "2xl": 2 }}
        templateColumns={{ "2xl": "minmax(350px,1fr) minmax(0,1.25fr)" }}
        gap="5"
      >
        <Stack gap="4">
          <Panel>
            <Section
              title={`Edit ${section}`}
              subtitle="Keep claims precise and metrics grounded in evidence."
            />
            {section === "summary" && (
              <Stack gap="4">
                <Edit
                  label="Name"
                  value={contact.name}
                  onChange={(name) => setContact({ ...contact, name })}
                />
                <Edit
                  label="Contact line"
                  value={contact.line}
                  onChange={(line) => setContact({ ...contact, line })}
                />
                <Edit
                  label="Professional summary"
                  area
                  value={resume.summary}
                  onChange={(v) =>
                    change((r) => {
                      r.summary = v;
                    })
                  }
                />
              </Stack>
            )}
            {section === "education" && (
              <Stack gap="3">
                {["institution", "location", "degree", "details", "dates"].map(
                  (k) => (
                    <Edit
                      key={k}
                      label={k}
                      value={resume.education[k] || ""}
                      onChange={(v) =>
                        change((r) => {
                          r.education[k] = v;
                        })
                      }
                    />
                  ),
                )}
                <Edit
                  area
                  label="Highlights (one per line)"
                  value={(resume.education.highlights || []).join("\n")}
                  onChange={(v) =>
                    change((r) => {
                      r.education.highlights = v.split("\n");
                    })
                  }
                />
              </Stack>
            )}
            {section === "skills" && (
              <Stack gap="4">
                {resume.skills.map((s, i) => (
                  <Box
                    key={i}
                    borderBottom="1px solid"
                    borderColor="line"
                    pb="4"
                  >
                    <Edit
                      label={`Skill category ${i + 1}`}
                      value={s.label}
                      onChange={(v) =>
                        change((r) => {
                          r.skills[i].label = v;
                        })
                      }
                    />
                    <Edit
                      label={`Skills in ${s.label}`}
                      area
                      value={s.value}
                      onChange={(v) =>
                        change((r) => {
                          r.skills[i].value = v;
                        })
                      }
                    />
                    <Button
                      size="xs"
                      mt="2"
                      variant="ghost"
                      colorPalette="red"
                      onClick={() =>
                        change((r) => {
                          r.skills.splice(i, 1);
                        })
                      }
                    >
                      <Trash2 size={13} />
                      Remove category
                    </Button>
                  </Box>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    change((r) => {
                      r.skills.push({ label: "Category", value: "" });
                    })
                  }
                >
                  <Plus size={14} />
                  Add skill category
                </Button>
              </Stack>
            )}
            {["experience", "projects"].includes(section) && (
              <Stack gap="5">
                {resume[section].map((item, i) => (
                  <Box
                    key={item.id || i}
                    borderBottom="1px solid"
                    borderColor="line"
                    pb="5"
                  >
                    <Flex justify="space-between" mb="3">
                      <Tag tone="gray">{item.parentId || "Unlinked item"}</Tag>
                      <Flex gap="1">
                        <Button
                          size="xs"
                          variant="ghost"
                          disabled={i === 0}
                          aria-label={`Move ${item.role || item.title} up`}
                          onClick={() => move(section, i, -1)}
                        >
                          <ArrowUp size={13} />
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          disabled={i === resume[section].length - 1}
                          aria-label={`Move ${item.role || item.title} down`}
                          onClick={() => move(section, i, 1)}
                        >
                          <ArrowDown size={13} />
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          aria-label={`Remove ${item.role || item.title}`}
                          onClick={() =>
                            change((r) => {
                              r[section].splice(i, 1);
                            })
                          }
                        >
                          <Trash2 size={13} />
                        </Button>
                      </Flex>
                    </Flex>
                    <Stack gap="3">
                      {(section === "experience"
                        ? ["role", "org", "location", "dates"]
                        : ["title", "subtitle", "dates"]
                      ).map((k) => (
                        <Edit
                          key={k}
                          label={`${k} ${i + 1}`}
                          value={item[k] || ""}
                          onChange={(v) => updateItem(section, i, k, v)}
                        />
                      ))}
                      {item.bullets.map((b, j) => (
                        <Box key={j} bg="soft" p="3" borderRadius="lg">
                          <Edit
                            area
                            label={`Bullet ${i + 1}.${j + 1}`}
                            value={b.text}
                            onChange={(v) =>
                              change((r) => {
                                r[section][i].bullets[j].text = v;
                              })
                            }
                          />
                          <Text fontSize="10px" color="muted" mt="2">
                            Evidence:{" "}
                            {(b.evidence || []).join(", ") ||
                              "Manually authored — review support"}
                          </Text>
                          <Flex justify="space-between" mt="2">
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => choose(section, i, j)}
                            >
                              <ShieldCheck size={12} />
                              Evidence variants
                            </Button>
                            <Button
                              size="xs"
                              variant="ghost"
                              aria-label={`Remove bullet ${i + 1}.${j + 1}`}
                              onClick={() =>
                                change((r) => {
                                  r[section][i].bullets.splice(j, 1);
                                })
                              }
                            >
                              <Trash2 size={12} />
                            </Button>
                          </Flex>
                        </Box>
                      ))}
                      <Flex gap="2" wrap="wrap">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => choose(section, i)}
                        >
                          <Plus size={12} />
                          Bullet from evidence
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() =>
                            change((r) => {
                              r[section][i].bullets.push({
                                text: "",
                                evidence: [],
                              });
                            })
                          }
                        >
                          Add blank bullet
                        </Button>
                      </Flex>
                    </Stack>
                  </Box>
                ))}
                <Load {...profile}>
                  {(p) => (
                    <Box>
                      <Text fontSize="xs" color="muted" mb="2">
                        Add an existing{" "}
                        {section === "experience" ? "experience" : "project"}{" "}
                        from your evidence database
                      </Text>
                      <Select
                        label={`Add ${section}`}
                        value=""
                        options={[
                          { value: "", label: "Choose an item…" },
                          ...(section === "experience"
                            ? p.experiences.map((e) => ({
                                value: e.experience_id,
                                label: e.organisation,
                              }))
                            : p.projects.map((p) => ({
                                value: p.project_id,
                                label: p.project,
                              }))),
                        ]}
                        onChange={(e) => {
                          const id = e.target.value;
                          if (!id) return;
                          change((r) => {
                            if (section === "experience") {
                              const x = p.experiences.find(
                                (x) => x.experience_id === id,
                              );
                              r.experience.push({
                                id: crypto.randomUUID(),
                                parentId: id,
                                role: x.role,
                                org: x.organisation,
                                location: x.location,
                                dates: `${x.start} – ${x.end}`,
                                bullets: [],
                              });
                            } else {
                              const x = p.projects.find(
                                (x) => x.project_id === id,
                              );
                              r.projects.push({
                                id: crypto.randomUUID(),
                                parentId: id,
                                title: x.project,
                                subtitle: x.course_or_context,
                                dates: "",
                                bullets: [],
                              });
                            }
                          });
                        }}
                      />
                    </Box>
                  )}
                </Load>
              </Stack>
            )}
          </Panel>
          <Panel>
            <Section title="Saved versions" />
            {!target ? (
              <Text fontSize="sm" color="muted">
                Choose an opportunity to see its saved resume versions.
              </Text>
            ) : (
              <Load {...documents}>
                {(d) => (
                  <Stack gap="3">
                    {d.resume_versions.map((v) => (
                      <Flex key={v.id} justify="space-between" gap="3">
                        <Box>
                          <Text fontSize="sm">{v.name}</Text>
                          <Text fontSize="xs" color="muted">
                            {v.created_at}
                          </Text>
                        </Box>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => setRestore(v)}
                        >
                          Restore
                        </Button>
                      </Flex>
                    ))}
                    {!d.resume_versions.length && (
                      <Empty>No saved versions for this role.</Empty>
                    )}
                  </Stack>
                )}
              </Load>
            )}
          </Panel>
          <Panel>
            <Section title="Draft tools" />
            <Flex gap="2" wrap="wrap">
              <Button
                size="xs"
                variant="outline"
                onClick={() =>
                  download(
                    "tailored-resume.doc",
                    exportHtml(),
                    "application/msword",
                  )
                }
              >
                Word-compatible .doc
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={() => file.current.click()}
              >
                Restore JSON backup
              </Button>
              <Button size="xs" variant="ghost" onClick={() => setReset(true)}>
                Reset to blank template
              </Button>
            </Flex>
            <input
              ref={file}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={async (e) => {
                try {
                  const f = e.target.files[0];
                  if (!f) return;
                  const d = JSON.parse(await f.text()),
                    r = d.resume || d;
                  if (!validResume(r))
                    throw new Error("This file is not a valid resume backup.");
                  setResume(r);
                  if (d.contact) setContact(d.contact);
                  setError("");
                } catch (e) {
                  setError(e.message);
                }
                e.target.value = "";
              }}
            />
            <Text fontSize="xs" color="muted" mt="3">
              The .doc export preserves the original Word-compatible HTML
              format; it is not a native .docx file.
            </Text>
          </Panel>
        </Stack>
        <Box minW="0">
          <Panel mb="4" p="4">
            <Flex justify="space-between" gap="3">
              <Text fontSize="sm" fontWeight="600">
                Live A4 preview
              </Text>
              <Tag tone={pageRatio > 1.005 ? "orange" : "green"}>
                {pageRatio.toFixed(2)} pages of content
              </Tag>
            </Flex>
            <Text fontSize="xs" color="muted" mt="2">
              {pageRatio > 1.005
                ? "Trim lower-priority bullets before exporting a one-page PDF. Typography stays at the original 9 pt."
                : "One-page layout · Original dense typography · Print with A4 paper, no margins, and no browser headers."}
            </Text>
          </Panel>
          <Box overflowX="auto" p="2" bg="soft" borderRadius="lg">
            <div className="resume-sheet" id="resume-preview" ref={sheet}>
              <div ref={content}>
                <header>
                  <h1>{contact.name}</h1>
                  <p>{contact.line}</p>
                </header>
                <section>
                  <h2>EDUCATION</h2>
                  <div className="resume-row">
                    <h3>{resume.education.institution}</h3>
                    <b>{resume.education.location}</b>
                  </div>
                  <div className="resume-row">
                    <p>{resume.education.degree}</p>
                    <em>{resume.education.dates}</em>
                  </div>
                  <p>{resume.education.details}</p>
                  {resume.education.highlights?.length > 0 && (
                    <p>
                      {resume.education.highlights.filter(Boolean).join(" · ")}
                    </p>
                  )}
                </section>
                <section>
                  <h2>PROFESSIONAL SUMMARY</h2>
                  <p className="resume-summary">{resume.summary}</p>
                </section>
                <section>
                  <h2>TECHNICAL SKILLS</h2>
                  {resume.skills.map((s, i) => (
                    <p className="resume-skill" key={i}>
                      <b>{s.label}: </b>
                      {s.value}
                    </p>
                  ))}
                </section>
                {["experience", "projects"].map((kind) => (
                  <section key={kind}>
                    <h2>
                      {kind === "experience"
                        ? "PROFESSIONAL EXPERIENCE"
                        : "PROJECTS"}
                    </h2>
                    {resume[kind].map((x, i) => (
                      <div className="resume-item" key={i}>
                        <div className="resume-row">
                          <p>
                            <b>{x.role || x.title}</b>
                            {kind === "experience"
                              ? `, ${x.org}${x.location ? ", " + x.location : ""}`
                              : x.subtitle
                                ? `: ${x.subtitle}`
                                : ""}
                          </p>
                          <em>{x.dates}</em>
                        </div>
                        <ul>
                          {x.bullets
                            .filter((b) => b.text.trim())
                            .map((b, j) => (
                              <li key={j}>{b.text}</li>
                            ))}
                        </ul>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            </div>
          </Box>
        </Box>
      </SimpleGrid>
      <Modal
        title="Choose evidence for this bullet"
        open={!!picker}
        onClose={() => setPicker(null)}
      >
        <Load {...profile}>
          {(p) => {
            const parent = picker
              ? resume[picker.kind][picker.i]?.parentId
              : null;
            const evidence = p.evidence.filter(
              (e) =>
                e.parent_id === parent &&
                JSON.stringify(e)
                  .toLowerCase()
                  .includes(evidenceQuery.toLowerCase()),
            );
            return (
              <Stack gap="4">
                <Notice>
                  Variants use only the stored action, result, metric, and
                  technology fields. Review each claim restriction before
                  choosing.
                </Notice>
                <SearchBox
                  value={evidenceQuery}
                  onChange={setEvidenceQuery}
                  placeholder="Search this item's evidence…"
                />
                {selectedEvidence ? (
                  <>
                    <Button
                      variant="plain"
                      size="sm"
                      onClick={() => setSelectedEvidence(null)}
                    >
                      ← All evidence
                    </Button>
                    <Text fontSize="sm">
                      {selectedEvidence.claim_restriction}
                    </Text>
                    {variants(selectedEvidence).map((v) => (
                      <Panel key={v.label} p="4">
                        <Tag tone="gray">{v.label}</Tag>
                        <Text fontSize="sm" my="3">
                          {v.text}
                        </Text>
                        <Button
                          size="xs"
                          colorPalette="green"
                          onClick={() => {
                            change((r) => {
                              const arr = r[picker.kind][picker.i].bullets;
                              const b = {
                                text: v.text,
                                evidence: [selectedEvidence.evidence_id],
                              };
                              if (picker.j === null) arr.push(b);
                              else arr[picker.j] = b;
                            });
                            setPicker(null);
                          }}
                        >
                          Use this bullet
                        </Button>
                      </Panel>
                    ))}
                  </>
                ) : (
                  evidence.map((e) => (
                    <Panel key={e.evidence_id} p="4">
                      <Flex gap="2" wrap="wrap">
                        <Tag>{e.evidence_id}</Tag>
                        <Tag tone="gray">{e.evidence_level}</Tag>
                      </Flex>
                      <Text fontSize="sm" my="3">
                        {e.raw_fact}
                      </Text>
                      <Text fontSize="xs" color="muted" mb="3">
                        {e.claim_restriction}
                      </Text>
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={
                          ["unverified", "skill-only"].includes(
                            e.evidence_level,
                          ) ||
                          /do not|unverified/i.test(e.claim_restriction || "")
                        }
                        onClick={() => setSelectedEvidence(e)}
                      >
                        Generate variants
                      </Button>
                    </Panel>
                  ))
                )}
                {!evidence.length && (
                  <Empty>No evidence mapped to this item.</Empty>
                )}
              </Stack>
            );
          }}
        </Load>
      </Modal>
      <Modal
        title="Restore this saved version?"
        open={!!restore}
        onClose={() => setRestore(null)}
      >
        <Text fontSize="sm" mb="4">
          Restoring replaces the current browser draft. Export a backup first if
          you want to keep your current edits.
        </Text>
        <Button
          colorPalette="green"
          onClick={() => {
            try {
              const r = JSON.parse(restore.content_json);
              if (!validResume(r))
                throw new Error(
                  "This saved version uses an unsupported content format.",
                );
              if (r.contact) setContact(r.contact);
              setResume(r);
              setVersion(restore.name);
              setRestore(null);
            } catch (e) {
              setError(e.message);
              setRestore(null);
            }
          }}
        >
          Restore version
        </Button>
      </Modal>
      <Modal
        title="Load the latest cloud draft?"
        open={loadConfirm}
        onClose={() => setLoadConfirm(false)}
      >
        <Text mb="4">
          This replaces edits in this editor. Export a backup first if you want
          to keep them.
        </Text>
        <Button colorPalette="green" loading={cloudBusy} onClick={loadCloud}>
          Load cloud draft
        </Button>
      </Modal>
      <Modal
        title="Reset this draft?"
        open={reset}
        onClose={() => setReset(false)}
      >
        <Text fontSize="sm" mb="4">
          This replaces your current browser draft with a blank template. Saved
          cloud versions and exported backups remain available.
        </Text>
        <Flex gap="2">
          <Button variant="outline" onClick={() => setReset(false)}>
            Keep draft
          </Button>
          <Button
            colorPalette="red"
            onClick={() => {
              setResume(clone());
              setReset(false);
            }}
          >
            Reset draft
          </Button>
        </Flex>
      </Modal>
    </>
  );
}
function Edit({ label, value, onChange, area = false }) {
  const id = "resume-" + label.replaceAll(" ", "-");
  return (
    <Box>
      <Text
        as="label"
        htmlFor={id}
        display="block"
        textTransform="capitalize"
        fontSize="xs"
        color="muted"
        mb="1.5"
      >
        {label}
      </Text>
      {area ? (
        <Textarea
          id={id}
          fontSize="sm"
          rows={4}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          id={id}
          size="sm"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Box>
  );
}

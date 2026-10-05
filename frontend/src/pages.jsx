import React, { useState } from "react";
import { useAuth } from "./auth";
import { CompanyBoards } from "./boards";
import {
  Box,
  Button,
  Flex,
  Text,
  Heading,
  Stack,
  SimpleGrid,
  Textarea,
} from "@chakra-ui/react";
import {
  ArrowRight,
  ArrowUpRight,
  Plus,
  Download,
  RefreshCw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
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
  SearchBox,
  Select,
  JobCard,
  Meter,
  DataTable,
  Modal,
  Form,
  field,
  statuses,
  download,
  safeUrl,
} from "./ui";
export function Jobs({ revision, open, go }) {
  const d = useData("/api/jobs", revision),
    [search, setSearch] = useState(""),
    [role, setRole] = useState(""),
    [status, setStatus] = useState(""),
    [sort, setSort] = useState("priority_score");
  return (
    <>
      <Title
        title="Find the right fit."
        subtitle="Your opportunities, assessed against the work you’ve actually done."
        action={
          <Button size="sm" variant="outline" onClick={() => go("ingestion")}>
            <Download size={15} />
            Import jobs
          </Button>
        }
      />
      <Load {...d}>
        {(js) => {
          const list = js
            .filter(
              (j) =>
                (!role || j.role_family === role) &&
                (!status || (j.application_status || j.status) === status) &&
                JSON.stringify(j).toLowerCase().includes(search.toLowerCase()),
            )
            .sort((a, b) => (b[sort] || 0) - (a[sort] || 0));
          return (
            <>
              <Flex gap="3" wrap="wrap" mb="6">
                <SearchBox
                  value={search}
                  onChange={setSearch}
                  placeholder="Search roles, companies, skills…"
                />
                <Box w={{ base: "100%", md: "210px" }}>
                  <Select
                    label="Role family"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    options={[
                      { value: "", label: "All role families" },
                      ...[
                        ...new Set(
                          js.map((j) => j.role_family).filter(Boolean),
                        ),
                      ],
                    ]}
                  />
                </Box>
                <Box w="160px">
                  <Select
                    label="Job status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    options={[
                      { value: "", label: "All statuses" },
                      "discovered",
                      ...statuses,
                    ]}
                  />
                </Box>
                <Box w="170px">
                  <Select
                    label="Sort jobs"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    options={[
                      { value: "priority_score", label: "Highest priority" },
                      { value: "career_fit", label: "Highest career fit" },
                      { value: "resume_fit", label: "Highest resume fit" },
                    ]}
                  />
                </Box>
              </Flex>
              <Section
                title={`${list.length} opportunities`}
                subtitle="Fit scores are evidence-based signals, not hiring probabilities."
              />
              <SimpleGrid columns={{ base: 1, md: 2, "2xl": 3 }} gap="5">
                {list.map((j) => (
                  <JobCard key={j.id} job={j} open={open} />
                ))}
              </SimpleGrid>
              {!list.length && <Empty>No jobs match these filters.</Empty>}
            </>
          );
        }}
      </Load>
    </>
  );
}
const colors = [
  "#3f8f69",
  "#ab8644",
  "#6c7db5",
  "#b46c78",
  "#769aaf",
  "#8d78a8",
  "#83a653",
  "#ba815a",
  "#51a49a",
];
export function Clusters({ revision, open }) {
  const d = useData("/api/v3/clusters", revision),
    [filter, setFilter] = useState(""),
    [selected, setSelected] = useState(null),
    [zoom, setZoom] = useState(1);
  return (
    <>
      <Title
        title="See the bigger picture."
        subtitle="Explore how opportunities connect through shared skills and role families."
      />
      <Load {...d}>
        {(data) => {
          const roles = data.clusters.map((c) => c.role_family),
            nodes = data.nodes.filter(
              (n) => !filter || n.role_family === filter,
            ),
            by = Object.fromEntries(nodes.map((n) => [n.id, n])),
            job = nodes.find((n) => n.id === selected),
            x = (n) => 500 + n.x * 520,
            y = (n) => 310 + n.y * 380;
          return (
            <>
              <SimpleGrid
                columns={{ base: 1, xl: 2 }}
                templateColumns={{ xl: "minmax(0,3fr) minmax(240px,1fr)" }}
                gap="5"
              >
                <Panel p="0" overflow="hidden">
                  <Flex px="5" pt="5" gap="3" justify="space-between">
                    <Box maxW="250px">
                      <Select
                        label="Cluster role family"
                        value={filter}
                        onChange={(e) => {
                          setFilter(e.target.value);
                          setSelected(null);
                        }}
                        options={[
                          { value: "", label: "All role families" },
                          ...roles,
                        ]}
                      />
                    </Box>
                    <Flex gap="1">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Zoom out"
                        onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
                      >
                        <ZoomOut size={17} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Zoom in"
                        onClick={() => setZoom((z) => Math.min(2, z + 0.2))}
                      >
                        <ZoomIn size={17} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setZoom(1)}
                      >
                        Reset
                      </Button>
                    </Flex>
                  </Flex>
                  <svg
                    viewBox="0 0 1000 620"
                    width="100%"
                    aria-label="Interactive job cluster map"
                    role="group"
                  >
                    <defs>
                      <pattern
                        id="dots"
                        width="24"
                        height="24"
                        patternUnits="userSpaceOnUse"
                      >
                        <circle
                          cx="1"
                          cy="1"
                          r="1"
                          fill="currentColor"
                          opacity=".08"
                        />
                      </pattern>
                    </defs>
                    <rect width="1000" height="620" fill="url(#dots)" />
                    <g
                      transform={`translate(500 310) scale(${zoom}) translate(-500 -310)`}
                    >
                      {data.edges
                        .filter((e) => by[e.source] && by[e.target])
                        .map((e, i) => (
                          <line
                            key={i}
                            x1={x(by[e.source])}
                            y1={y(by[e.source])}
                            x2={x(by[e.target])}
                            y2={y(by[e.target])}
                            stroke="currentColor"
                            opacity={e.similarity * 0.3}
                          />
                        ))}
                      {nodes.map((n) => (
                        <g
                          key={n.id}
                          tabIndex={0}
                          role="button"
                          aria-label={`${n.company}: ${n.title}`}
                          className="cluster-node"
                          onClick={() => setSelected(n.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelected(n.id);
                            }
                          }}
                        >
                          <circle
                            cx={x(n)}
                            cy={y(n)}
                            r={7 + (n.priority_score || 0) / 15}
                            fill={
                              colors[
                                roles.indexOf(n.role_family) % colors.length
                              ]
                            }
                            stroke={
                              selected === n.id ? "currentColor" : "transparent"
                            }
                            strokeWidth="4"
                          />
                          <title>
                            {n.company} · {n.title} ·{" "}
                            {Math.round(n.career_fit || 0)}% fit
                          </title>
                        </g>
                      ))}
                    </g>
                  </svg>
                  <Text px="5" pb="4" fontSize="xs" color="muted">
                    Node size = priority · Lines = description similarity ·
                    Select a node to inspect
                  </Text>
                </Panel>
                <Panel>
                  <Section title="Opportunity detail" />
                  {job ? (
                    <Stack gap="4">
                      <Tag>{job.role_family}</Tag>
                      <Heading size="lg">{job.title}</Heading>
                      <Text color="muted">
                        {job.company} · {job.location}
                      </Text>
                      <Meter label="Career fit" value={job.career_fit} />
                      <Meter label="Resume fit" value={job.resume_fit} />
                      <Button colorPalette="green" onClick={() => open(job.id)}>
                        Open dossier
                        <ArrowRight size={15} />
                      </Button>
                    </Stack>
                  ) : (
                    <Text color="muted" fontSize="sm">
                      Select any node to see the role, fit, and application
                      dossier. You can also browse the accessible list below.
                    </Text>
                  )}
                  <Stack gap="3" mt="8">
                    {roles.map((r, i) => (
                      <Flex key={r} align="center" gap="2" fontSize="xs">
                        <Box
                          w="8px"
                          h="8px"
                          borderRadius="full"
                          bg={colors[i % colors.length]}
                        />
                        {r}
                      </Flex>
                    ))}
                  </Stack>
                </Panel>
              </SimpleGrid>
              <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="4" mt="5">
                {data.clusters
                  .filter((c) => !filter || c.role_family === filter)
                  .map((c) => (
                    <Panel key={c.role_family}>
                      <Section title={c.role_family} />
                      <Flex gap="5" mb="3">
                        <Text>
                          <b>{c.job_count}</b> jobs
                        </Text>
                        <Text>
                          <b>{c.avg_fit}%</b> average fit
                        </Text>
                      </Flex>
                      <Text fontSize="xs" color="muted" mb="2">
                        Top skills: {c.top_skills.join(", ") || "No skills yet"}
                      </Text>
                      <Text fontSize="xs" color="muted">
                        Gaps: {c.top_gaps.join(", ") || "None detected"}
                      </Text>
                    </Panel>
                  ))}
              </SimpleGrid>
              <Panel mt="5">
                <Section title="Explore mapped roles" />
                <Flex gap="2" wrap="wrap">
                  {nodes.map((n) => (
                    <Button
                      size="xs"
                      variant="outline"
                      key={n.id}
                      onClick={() => {
                        setSelected(n.id);
                        open(n.id);
                      }}
                    >
                      {n.company} · {n.title}
                    </Button>
                  ))}
                </Flex>
              </Panel>
            </>
          );
        }}
      </Load>
    </>
  );
}
const appFields = [
  field("status", "Application stage", { options: statuses }),
  field("applied_at", "Applied date", { type: "date" }),
  field("next_action", "Next action"),
  field("follow_up_date", "Follow-up date", { type: "date" }),
  field("resume_version", "Resume version"),
  field("cover_letter_version", "Cover letter version"),
  field("notes", "Notes", { type: "textarea" }),
];
export function Applications({ revision, open, saved }) {
  const d = useData("/api/applications", revision),
    [edit, setEdit] = useState(null),
    [outcome, setOutcome] = useState(null),
    [history, setHistory] = useState(null),
    [status, setStatus] = useState("");
  return (
    <>
      <Title
        title="Keep every door in view."
        subtitle="A thoughtful pipeline, from first interest to your next offer."
      />
      <Load {...d}>
        {(a) => (
          <>
            <SimpleGrid columns={{ base: 2, md: 4 }} gap="4" mb="6">
              {[
                ["Tracked", a.length],
                [
                  "In preparation",
                  a.filter((x) =>
                    ["saved", "shortlisted", "tailoring", "ready"].includes(
                      x.status,
                    ),
                  ).length,
                ],
                [
                  "In progress",
                  a.filter((x) =>
                    [
                      "applied",
                      "oa",
                      "phone screen",
                      "technical",
                      "final",
                    ].includes(x.status),
                  ).length,
                ],
                ["Offers", a.filter((x) => x.status === "offer").length],
              ].map(([l, n]) => (
                <Panel key={l}>
                  <Text color="muted" fontSize="xs">
                    {l}
                  </Text>
                  <Text fontSize="30px" fontWeight="600">
                    {n}
                  </Text>
                </Panel>
              ))}
            </SimpleGrid>
            <Panel>
              <Flex mb="4" maxW="220px">
                <Select
                  label="Filter applications"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  options={[
                    { value: "", label: "All application stages" },
                    ...statuses,
                  ]}
                />
              </Flex>
              <DataTable
                headers={[
                  "Company / role",
                  "Stage",
                  "Next action",
                  "Follow-up",
                  "Actions",
                ]}
              >
                {a
                  .filter((x) => !status || x.status === status)
                  .map((x) => (
                    <tr key={x.id}>
                      <td>
                        <Button
                          variant="plain"
                          size="sm"
                          height="auto"
                          p="0"
                          onClick={() => open(x.job_id)}
                        >
                          {x.company}
                        </Button>
                        <Text color="muted" fontSize="xs" mt="1">
                          {x.title}
                        </Text>
                      </td>
                      <td>
                        <Tag
                          tone={
                            x.status === "rejected"
                              ? "red"
                              : x.status === "offer"
                                ? "green"
                                : "gray"
                          }
                        >
                          {x.status}
                        </Tag>
                      </td>
                      <td>{x.next_action || "—"}</td>
                      <td>{x.follow_up_date || "—"}</td>
                      <td>
                        <Flex gap="2">
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => setEdit(x)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => setOutcome(x)}
                          >
                            Outcome
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => setHistory(x)}
                          >
                            History
                          </Button>
                        </Flex>
                      </td>
                    </tr>
                  ))}
              </DataTable>
              {!a.length && (
                <Empty>Open a job dossier and save it to your pipeline.</Empty>
              )}
            </Panel>
          </>
        )}
      </Load>
      <Modal
        title="Update application"
        open={!!edit}
        onClose={() => setEdit(null)}
      >
        {edit && (
          <Form
            key={edit.id}
            initial={edit}
            fields={appFields}
            onSubmit={async (v) => {
              await api(`/api/jobs/${edit.job_id}/application`, v);
              setEdit(null);
              saved("Application updated");
            }}
          />
        )}
      </Modal>
      <Modal
        title="Application history"
        open={!!history}
        onClose={() => setHistory(null)}
      >
        {history && <ApplicationHistory id={history.id} revision={revision} />}
      </Modal>
      <Modal
        title="Record an outcome"
        open={!!outcome}
        onClose={() => setOutcome(null)}
      >
        {outcome && (
          <Form
            fields={[
              field("rejection_stage", "Stage", { options: statuses }),
              field("reason_category", "Reason category", {
                options: [
                  "Unknown",
                  "Skills",
                  "Experience",
                  "Timing",
                  "Role closed",
                  "Other",
                ],
              }),
              field("reason_known", "Was the reason confirmed?", {
                options: ["No", "Yes"],
              }),
              field("notes", "Outcome notes", { type: "textarea" }),
            ]}
            onSubmit={async (v) => {
              await api(`/api/v3/applications/${outcome.id}/outcome`, {
                ...v,
                reason_known: v.reason_known === "Yes",
              });
              setOutcome(null);
              saved("Outcome recorded; application stage is unchanged");
            }}
          />
        )}
      </Modal>
    </>
  );
}
export function Dossier({ id, revision, open, go, saved }) {
  const { user } = useAuth();
  const d = useData(`/api/jobs/${id}`, revision),
    docs = useData(`/api/jobs/${id}/documents`, revision),
    prep = useData(`/api/v3/jobs/${id}/interview-prep`, revision),
    [edit, setEdit] = useState(false),
    [cover, setCover] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const action = async (fn) => {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Load {...d}>
      {(d) => (
        <>
          <Button
            variant="plain"
            p="0"
            size="sm"
            mb="4"
            onClick={() => go("jobs")}
          >
            ← All opportunities
          </Button>
          <Title
            title={d.job.title}
            subtitle={`${d.job.company} · ${d.job.location || "Location not listed"} · ${d.job.source}`}
            action={
              <Flex gap="2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEdit(true)}
                >
                  {d.application ? "Update application" : "Track application"}
                </Button>
                <Button
                  colorPalette="green"
                  size="sm"
                  onClick={() => go(`package/${id}`)}
                >
                  Open package
                  <ArrowRight size={15} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    sessionStorage.setItem(`jobplicator-target:${user.id}`, id);
                    go("resume");
                  }}
                >
                  Tailor resume
                  <ArrowRight size={15} />
                </Button>
              </Flex>
            }
          />
          {error && <Notice tone="red">{error}</Notice>}
          <SimpleGrid
            columns={{ base: 1, xl: 2 }}
            templateColumns={{ xl: "minmax(0,2fr) minmax(280px,1fr)" }}
            gap="6"
          >
            <Stack gap="5">
              <Panel>
                <Section
                  title="Your evidence, in context"
                  action={
                    <Button
                      size="xs"
                      variant="ghost"
                      loading={busy}
                      onClick={() =>
                        action(async () => {
                          await api(`/api/jobs/${id}/recalculate`, {});
                          saved("Match recalculated");
                        })
                      }
                    >
                      <RefreshCw size={13} />
                      Reassess
                    </Button>
                  }
                />
                <SimpleGrid columns={3} gap="4">
                  {[
                    ["Career fit", "career_fit"],
                    ["Resume fit", "resume_fit"],
                    ["Potential", "potential_fit"],
                  ].map(([l, k]) => (
                    <Box key={k}>
                      <Text color="muted" fontSize="xs">
                        {l}
                      </Text>
                      <Text fontSize="32px" fontWeight="600" color="accent">
                        {Math.round(d.match[k] || 0)}
                        <span style={{ fontSize: "16px" }}>%</span>
                      </Text>
                    </Box>
                  ))}
                </SimpleGrid>
                <Box mt="5">
                  <Notice>
                    Evidence-based estimates help prioritize tailoring.
                    Unsupported requirements should stay out of your resume.
                  </Notice>
                </Box>
              </Panel>
              <Panel>
                <Section title="Requirement & evidence matrix" />
                <Stack gap="4">
                  {d.evidence_matches.map((e) => (
                    <Box
                      key={e.id}
                      pb="3"
                      borderBottom="1px solid"
                      borderColor="line"
                    >
                      <Flex justify="space-between" gap="3">
                        <Text fontWeight="600" fontSize="sm">
                          {e.requirement}
                        </Text>
                        <Tag tone={e.evidence_id ? "green" : "orange"}>
                          {e.evidence_id || "Evidence gap"}
                        </Tag>
                      </Flex>
                      <Text fontSize="xs" color="muted" mt="2">
                        {e.reason || "Unsupported — do not add to your resume."}
                      </Text>
                    </Box>
                  ))}
                </Stack>
              </Panel>
              <Panel>
                <Section
                  title="Cover letter"
                  subtitle="Review the draft before using it."
                />
                {docs.data?.cover_letters.length > 0 && (
                  <Box mb="4">
                    <Select
                      label="Saved cover letter version"
                      defaultValue=""
                      options={[
                        { value: "", label: "Latest saved letter" },
                        ...docs.data.cover_letters.map((v) => ({
                          value: String(v.id),
                          label: `Version ${v.version} · ${v.created_at}`,
                        })),
                      ]}
                      onChange={(e) => {
                        const letter = docs.data.cover_letters.find(
                          (v) => String(v.id) === e.target.value,
                        );
                        setCover(letter?.content ?? null);
                      }}
                    />
                  </Box>
                )}
                <Textarea
                  aria-label="Cover letter"
                  minH="330px"
                  fontSize="sm"
                  lineHeight="1.8"
                  value={
                    cover ??
                    docs.data?.cover_letters[0]?.content ??
                    d.dossier.cover_letter ??
                    ""
                  }
                  onChange={(e) => setCover(e.target.value)}
                />
                <Flex gap="2" mt="4">
                  <Button
                    size="sm"
                    colorPalette="green"
                    loading={busy}
                    onClick={() =>
                      action(async () => {
                        await api(`/api/jobs/${id}/cover-letter`, {
                          content:
                            cover ??
                            docs.data?.cover_letters[0]?.content ??
                            d.dossier.cover_letter ??
                            "",
                        });
                        saved("Cover letter version saved");
                      })
                    }
                  >
                    Save version
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      download(
                        "cover-letter.txt",
                        cover ??
                          docs.data?.cover_letters[0]?.content ??
                          d.dossier.cover_letter ??
                          "",
                        "text/plain",
                      )
                    }
                  >
                    Export text
                  </Button>
                </Flex>
              </Panel>
              <Panel>
                <Section title="Prepare your story" />
                {(d.dossier.interview_questions || []).map((q, i) => (
                  <Text
                    fontSize="sm"
                    py="3"
                    borderBottom="1px solid"
                    borderColor="line"
                    key={q}
                  >
                    {i + 1}. {q}
                  </Text>
                ))}
              </Panel>
              <Panel>
                <Section title="Role description" />
                <Text
                  whiteSpace="pre-wrap"
                  color="muted"
                  fontSize="sm"
                  lineHeight="1.8"
                >
                  {d.job.description_raw}
                </Text>
                {safeUrl(d.job.source_url) && (
                  <Button asChild variant="outline" size="sm" mt="4">
                    <a
                      href={safeUrl(d.job.source_url)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Original posting
                      <ArrowUpRight size={14} />
                    </a>
                  </Button>
                )}
              </Panel>
            </Stack>
            <Stack gap="5">
              <Panel>
                <Section title="Application snapshot" />
                <Tag>{d.application?.status || "Not tracked yet"}</Tag>
                <Text color="muted" fontSize="sm" mt="4">
                  {d.application?.next_action ||
                    "Choose a next action to keep momentum."}
                </Text>
                {d.application?.follow_up_date && (
                  <Text mt="3" fontSize="xs">
                    Follow up: {d.application.follow_up_date}
                  </Text>
                )}
              </Panel>
              <Panel>
                <Section title="People & outreach" />
                {(d.dossier.people || []).map((p, i) => (
                  <Box key={i} mb="5">
                    <Text fontSize="sm" fontWeight="600">
                      {p.type}
                    </Text>
                    <Text fontSize="sm" mt="1">
                      {p.name}
                    </Text>
                    <Text color="muted" fontSize="xs" my="2">
                      {p.reason}
                    </Text>
                    {safeUrl(p.search_url) && (
                      <Button asChild size="xs" variant="outline">
                        <a
                          href={safeUrl(p.search_url)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Search people
                          <ArrowUpRight size={12} />
                        </a>
                      </Button>
                    )}
                  </Box>
                ))}
                {d.contacts.map((c) => (
                  <Text key={c.id} fontSize="sm">
                    {c.name} · {c.role}
                  </Text>
                ))}
                <Text
                  whiteSpace="pre-wrap"
                  fontSize="sm"
                  color="muted"
                  lineHeight="1.7"
                >
                  {d.dossier.outreach}
                </Text>
                <Button
                  variant="outline"
                  size="xs"
                  mt="4"
                  onClick={() =>
                    download(
                      "outreach.txt",
                      d.dossier.outreach || "",
                      "text/plain",
                    )
                  }
                >
                  Export outreach draft
                </Button>
              </Panel>
              <Panel>
                <Section title="Your coding prep set" />
                <Load {...prep}>
                  {(p) => (
                    <>
                      <Text fontSize="xs" color="muted" mb="4">
                        {p.note}
                      </Text>
                      {p.recommended_set.map((q) => (
                        <Box
                          key={q.id}
                          py="3"
                          borderTop="1px solid"
                          borderColor="line"
                        >
                          <Text fontWeight="600" fontSize="sm">
                            {q.title}
                          </Text>
                          <Text color="muted" fontSize="xs" my="1">
                            {q.difficulty} · {q.primary_topic}
                          </Text>
                          <Tag
                            tone={q.asked_in_real_interview ? "green" : "gray"}
                          >
                            {q.source_type}
                          </Tag>
                        </Box>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        mt="4"
                        onClick={() => go("questions")}
                      >
                        Open question bank
                      </Button>
                    </>
                  )}
                </Load>
              </Panel>
            </Stack>
          </SimpleGrid>
          <Modal
            title="Track this application"
            open={edit}
            onClose={() => setEdit(false)}
          >
            <Form
              key={d.application?.updated_at || "new"}
              initial={d.application || {}}
              fields={appFields}
              onSubmit={async (v) => {
                await api(`/api/jobs/${id}/application`, v);
                setEdit(false);
                saved("Application saved");
              }}
            />
          </Modal>
        </>
      )}
    </Load>
  );
}
export function Evidence({ revision }) {
  const d = useData("/api/evidence", revision),
    [q, setQ] = useState(""),
    [level, setLevel] = useState(""),
    [parent, setParent] = useState(""),
    [detail, setDetail] = useState(null);
  return (
    <>
      <Title
        title="Let your work speak."
        subtitle="A traceable library of achievements, claims, and the evidence behind them."
      />
      <Load {...d}>
        {(data) => {
          const list = data.filter(
            (e) =>
              (!level || e.evidence_level === level) &&
              (!parent || e.parent_id === parent) &&
              JSON.stringify(e).toLowerCase().includes(q.toLowerCase()),
          );
          return (
            <>
              <Flex gap="3" wrap="wrap" mb="5">
                <SearchBox
                  value={q}
                  onChange={setQ}
                  placeholder="Search facts, technologies, results…"
                />
                <Box maxW="230px">
                  <Select
                    label="Evidence level"
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    options={[
                      { value: "", label: "All evidence levels" },
                      ...[...new Set(data.map((e) => e.evidence_level))],
                    ]}
                  />
                </Box>
                <Box maxW="230px">
                  <Select
                    label="Evidence parent"
                    value={parent}
                    onChange={(e) => setParent(e.target.value)}
                    options={[
                      { value: "", label: "All experiences / projects" },
                      ...[
                        ...new Set(
                          data.map((e) => e.parent_id).filter(Boolean),
                        ),
                      ],
                    ]}
                  />
                </Box>
              </Flex>
              <Text color="muted" fontSize="xs" mb="5">
                {list.length} records · Select a record for full provenance
              </Text>
              <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="4">
                {list.map((e) => (
                  <Panel key={e.evidence_id}>
                    <Flex justify="space-between" gap="2" mb="4" wrap="wrap">
                      <Text color="accent" fontSize="xs" fontWeight="600">
                        {e.evidence_id}
                      </Text>
                      <Tag tone="gray">{e.evidence_level}</Tag>
                    </Flex>
                    <Button
                      variant="plain"
                      p="0"
                      h="auto"
                      whiteSpace="normal"
                      textAlign="left"
                      lineHeight="1.7"
                      onClick={() => setDetail(e)}
                    >
                      {e.raw_fact}
                    </Button>
                    <Text color="muted" fontSize="xs" mt="3">
                      {e.context}
                    </Text>
                    <Text
                      color="muted"
                      fontSize="xs"
                      mt="4"
                      pt="3"
                      borderTop="1px solid"
                      borderColor="line"
                    >
                      {e.claim_restriction || "No restriction noted"}
                    </Text>
                  </Panel>
                ))}
              </SimpleGrid>
              {!list.length && (
                <Empty>No evidence matches these filters.</Empty>
              )}
            </>
          );
        }}
      </Load>
      <Modal
        title={detail?.evidence_id || "Evidence"}
        open={!!detail}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <Stack gap="4">
            {Object.entries(detail).map(([k, v]) => (
              <Box key={k}>
                <Text fontSize="xs" color="muted" textTransform="capitalize">
                  {k.replaceAll("_", " ")}
                </Text>
                <Text fontSize="sm" mt="1">
                  {typeof v === "boolean"
                    ? v
                      ? "Yes"
                      : "No"
                    : String(v ?? "—")}
                </Text>
              </Box>
            ))}
          </Stack>
        )}
      </Modal>
    </>
  );
}
function Performance({ rows }) {
  return (
    <Stack gap="5">
      {rows.map((x) => (
        <Box key={x.name}>
          <Flex justify="space-between" mb="2">
            <Text fontSize="sm" fontWeight="500">
              {x.name}
            </Text>
            <Tag tone="gray">{x.signal}</Tag>
          </Flex>
          <Meter
            label={`${x.applications} applications · ${x.interviews} interviews · ${x.offers} offers`}
            value={x.screen_rate}
          />
        </Box>
      ))}
      {!rows.length && (
        <Empty>Track applications to build a performance history.</Empty>
      )}
    </Stack>
  );
}
export function Analytics({ revision }) {
  const d = useData("/api/v3/analytics", revision);
  return (
    <>
      <Title
        title="Turn experience into insight."
        subtitle="Understand your pipeline and where your search is gaining traction."
      />
      <Load {...d}>
        {(a) => (
          <>
            <SimpleGrid columns={{ base: 1, md: 3 }} gap="4" mb="6">
              {[
                ["Applications tracked", a.applications],
                [
                  "Interviews",
                  a.role_performance.reduce((n, r) => n + r.interviews, 0),
                ],
                [
                  "Offers",
                  a.role_performance.reduce((n, r) => n + r.offers, 0),
                ],
              ].map(([l, n]) => (
                <Panel key={l}>
                  <Text color="muted" fontSize="sm">
                    {l}
                  </Text>
                  <Text fontSize="36px" fontWeight="600">
                    {n}
                  </Text>
                </Panel>
              ))}
            </SimpleGrid>
            <Panel mb="6">
              <Section
                title="Application funnel"
                subtitle="Current active applications at this stage or further. Rejected and withdrawn applications are excluded."
              />
              <Stack gap="4">
                {a.funnel.map((f, i) => (
                  <Flex gap="4" align="center" key={f.stage}>
                    <Text w="105px" fontSize="sm" textTransform="capitalize">
                      {f.stage}
                    </Text>
                    <Box flex="1" bg="soft" borderRadius="md">
                      <Box
                        bg={i % 2 ? "#629471" : "#337453"}
                        w={`${(100 * f.count) / Math.max(1, ...a.funnel.map((f) => f.count))}%`}
                        h="32px"
                        minW={f.count ? "26px" : "0"}
                        borderRadius="md"
                      />
                    </Box>
                    <Text w="35px" fontWeight="600">
                      {f.count}
                    </Text>
                  </Flex>
                ))}
              </Stack>
            </Panel>
            <SimpleGrid columns={{ base: 1, xl: 2 }} gap="6">
              <Panel>
                <Section
                  title="Role-family performance"
                  subtitle="Observed screen rate from tracked applications"
                />
                <Performance rows={a.role_performance} />
              </Panel>
              <Panel>
                <Section
                  title="Source performance"
                  subtitle="See which sources lead to conversations"
                />
                <Performance rows={a.source_performance} />
              </Panel>
            </SimpleGrid>
            <Box mt="5">
              <Notice>
                Historical conversion is an observed signal, not a prediction of
                your hiring probability. Small samples are labelled explicitly.
              </Notice>
            </Box>
          </>
        )}
      </Load>
    </>
  );
}
export function Skills({ revision }) {
  const d = useData("/api/v3/skills", revision),
    [q, setQ] = useState(""),
    [gap, setGap] = useState("");
  return (
    <>
      <Title
        title="Build what matters next."
        subtitle="Connect market demand with your current evidence and meaningful skill gaps."
      />
      <Load {...d}>
        {(s) => (
          <>
            <SimpleGrid columns={{ base: 1, md: 3 }} gap="4" mb="6">
              {[
                ["Skills in demand", s.length],
                [
                  "Evidence to surface",
                  s.filter((x) => x.evidence === "Strong").length,
                ],
                ["Priority gaps", s.filter((x) => x.gap === "High").length],
              ].map(([l, n]) => (
                <Panel key={l}>
                  <Text fontSize="xs" color="muted">
                    {l}
                  </Text>
                  <Text fontSize="32px" fontWeight="600">
                    {n}
                  </Text>
                </Panel>
              ))}
            </SimpleGrid>
            <Flex gap="3" mb="5" wrap="wrap">
              <SearchBox
                value={q}
                onChange={setQ}
                placeholder="Find a skill…"
              />
              <Box w="190px">
                <Select
                  label="Gap severity"
                  value={gap}
                  onChange={(e) => setGap(e.target.value)}
                  options={[
                    { value: "", label: "All gap levels" },
                    "High",
                    "Medium",
                    "None",
                  ]}
                />
              </Box>
            </Flex>
            <Panel>
              <DataTable
                headers={[
                  "Skill",
                  "Demand",
                  "Required / preferred",
                  "Evidence",
                  "Gap",
                  "Next step",
                ]}
              >
                {s
                  .filter(
                    (x) =>
                      (!gap || x.gap === gap) &&
                      x.skill.toLowerCase().includes(q.toLowerCase()),
                  )
                  .map((x) => (
                    <tr key={x.skill}>
                      <td>
                        <b>{x.skill}</b>
                      </td>
                      <td>
                        <Box minW="100px">
                          <Meter
                            value={x.demand_pct}
                            label={`${x.jobs} jobs`}
                          />
                        </Box>
                      </td>
                      <td>
                        {x.required} / {x.preferred}
                      </td>
                      <td>{x.evidence}</td>
                      <td>
                        <Tag
                          tone={
                            x.gap === "High"
                              ? "orange"
                              : x.gap === "Medium"
                                ? "yellow"
                                : "green"
                          }
                        >
                          {x.gap}
                        </Tag>
                      </td>
                      <td>{x.action}</td>
                    </tr>
                  ))}
              </DataTable>
            </Panel>
            <Text fontSize="xs" color="muted" mt="4">
              Demand is measured from imported jobs. Evidence strength uses the
              existing v3 text-matching model and should be reviewed in context.
            </Text>
          </>
        )}
      </Load>
    </>
  );
}
export function Strategy({ revision, open, saved }) {
  const s = useData("/api/v3/strategy", revision),
    w = useData("/api/v3/weekly-report", revision),
    weights = useData("/api/v3/scoring-weights", revision),
    [edit, setEdit] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <Title
        title="A search with direction."
        subtitle="Turn your evidence, outcomes, and skill demand into a practical next step."
      />
      <Load {...s}>
        {(s) => (
          <>
            <Panel bg="soft" mb="6">
              <Text fontSize="10px" letterSpacing=".13em" color="accent" mb="3">
                YOUR CURRENT FOCUS
              </Text>
              <Heading size="xl" mb="3">
                {s.role_focus}
              </Heading>
              <Text color="muted" fontSize="sm" mb="3">
                {s.observed}
              </Text>
              <Tag>{s.confidence}</Tag>
            </Panel>
            <SimpleGrid columns={{ base: 1, xl: 3 }} gap="5">
              {[
                ["Apply with confidence", s.apply_now, "apply"],
                ["Keep the conversation going", s.follow_ups, "follow"],
                ["Invest in your next skill", s.skill_focus, "skills"],
              ].map(([title, items, type]) => (
                <Panel key={type}>
                  <Section title={title} />
                  <Stack gap="5">
                    {items.map((x, i) => (
                      <Box key={i}>
                        <Text fontSize="sm" fontWeight="600">
                          {x.company || x.skill}
                        </Text>
                        <Text fontSize="xs" color="muted" mt="1" mb="2">
                          {type === "apply"
                            ? `${x.title} · ${Math.round(x.career_fit || 0)}% career fit`
                            : type === "follow"
                              ? `${x.next_action}${x.follow_up_date ? " · " + x.follow_up_date : ""}`
                              : `${x.jobs} jobs · ${x.action}`}
                        </Text>
                        {type !== "skills" && (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => open(x.id)}
                          >
                            View dossier
                            <ArrowRight size={12} />
                          </Button>
                        )}
                      </Box>
                    ))}
                    {!items.length && <Empty>No recommendations yet.</Empty>}
                  </Stack>
                </Panel>
              ))}
            </SimpleGrid>
          </>
        )}
      </Load>
      <SimpleGrid columns={{ base: 1, xl: 2 }} gap="5" mt="6">
        <Panel>
          <Section title="Your weekly snapshot" />
          <Load {...w}>
            {(w) => (
              <Stack gap="4">
                <Text fontSize="xs" color="muted">
                  Week beginning {w.week_start}
                </Text>
                <Text>
                  {w.applications} applications tracked · {w.apply_now}{" "}
                  apply-now recommendations · {w.follow_ups} follow-ups
                </Text>
                <Text fontSize="sm" color="muted">
                  Skill focus:{" "}
                  {w.skill_focus.join(", ") || "Keep collecting evidence"}
                </Text>
                <Flex gap="2">
                  <Button
                    size="sm"
                    colorPalette="green"
                    onClick={async () => {
                      try {
                        await api("/api/v3/weekly-report", {});
                        saved("Weekly snapshot saved");
                      } catch (e) {
                        setError(e.message);
                      }
                    }}
                  >
                    Save snapshot
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      download(
                        `weekly-${w.week_start}.json`,
                        JSON.stringify(w, null, 2),
                      )
                    }
                  >
                    Export
                  </Button>
                </Flex>
                {error && <Notice tone="red">{error}</Notice>}
              </Stack>
            )}
          </Load>
        </Panel>
        <Panel>
          <Section
            title="Transparent scoring history"
            action={
              <Button size="xs" variant="outline" onClick={() => setEdit(true)}>
                Record weights
              </Button>
            }
          />
          <Load {...weights}>
            {(w) => (
              <>
                <Notice>
                  These weights are recorded for review. The preserved v3
                  scoring engine does not apply saved weight changes to fit
                  calculations.
                </Notice>
                <Stack gap="2" mt="4">
                  {Object.entries(w.current).map(([k, v]) => (
                    <Flex key={k} justify="space-between" fontSize="xs">
                      <Text textTransform="capitalize" color="muted">
                        {k.replaceAll("_", " ")}
                      </Text>
                      <b>{v}</b>
                    </Flex>
                  ))}
                </Stack>
                {w.history.map((h) => (
                  <Box
                    key={h.id}
                    mt="4"
                    pt="3"
                    borderTop="1px solid"
                    borderColor="line"
                  >
                    <Text fontSize="xs">
                      {h.created_at} · {h.reason}
                    </Text>
                    <Text fontSize="xs" color="muted" overflowWrap="anywhere">
                      {h.weights_json}
                    </Text>
                  </Box>
                ))}
              </>
            )}
          </Load>
        </Panel>
      </SimpleGrid>
      <Modal
        title="Record a scoring-weight proposal"
        open={edit}
        onClose={() => setEdit(false)}
      >
        {weights.data && (
          <Form
            fields={[
              ...Object.keys(weights.data.current).map((k) =>
                field(k, k.replaceAll("_", " "), {
                  type: "number",
                  min: 0,
                  max: 100,
                  required: true,
                }),
              ),
              field("reason", "Reason for this proposal", { required: true }),
            ]}
            initial={weights.data.current}
            onSubmit={async (v) => {
              const { reason, ...numbers } = v;
              const values = Object.fromEntries(
                Object.entries(numbers).map(([k, n]) => [k, Number(n)]),
              );
              if (Object.values(values).reduce((a, b) => a + b, 0) !== 100)
                throw new Error("Weights must total 100.");
              await api("/api/v3/scoring-weights", { weights: values, reason });
              setEdit(false);
              saved("Weight proposal recorded");
            }}
          />
        )}
      </Modal>
    </>
  );
}
export function Ingestion({ revision, saved }) {
  const registry = useData("/api/adapters", revision),
    runs = useData("/api/ingestion", revision);
  return (
    <>
      <Title
        title="Bring your opportunities together."
        subtitle="Import from supported public boards or add a posting manually."
      />
      <SimpleGrid columns={{ base: 1, xl: 3 }} gap="5">
        {[
          [
            "Greenhouse",
            "greenhouse",
            [field("board_token", "Board token", { required: true })],
          ],
          [
            "Lever",
            "lever",
            [field("company_token", "Company token", { required: true })],
          ],
          [
            "Posting URL",
            "generic_url",
            [
              field("url", "Public posting URL", {
                type: "url",
                required: true,
              }),
              field("company", "Company", { required: true }),
              field("title", "Job title", { required: true }),
            ],
          ],
        ].map(([title, id, fields]) => (
          <Panel key={id}>
            <Section title={title} />
            <Form
              fields={fields}
              submit="Import jobs"
              onSubmit={async (v) => {
                const r = await api(`/api/ingest/${id}`, v);
                saved(`${r.count} jobs imported. ${r.detail || ""}`);
              }}
            />
          </Panel>
        ))}
      </SimpleGrid>
      <CompanyBoards revision={revision} saved={saved} />
      <SimpleGrid columns={{ base: 1, xl: 2 }} gap="5" mt="6">
        <Panel>
          <Section title="Connector availability" />
          <Load {...registry}>
            {(d) => (
              <Stack gap="4">
                {Object.entries(d).map(([k, v]) => (
                  <Box key={k}>
                    <Text fontSize="sm" fontWeight="600">
                      {k}
                    </Text>
                    <Tag tone="gray">{v.status}</Tag>
                    <Text color="muted" fontSize="xs" mt="2">
                      {v.notes}
                    </Text>
                  </Box>
                ))}
              </Stack>
            )}
          </Load>
        </Panel>
        <Panel>
          <Section title="Recent imports" />
          <Load {...runs}>
            {(runs) => (
              <Stack gap="4">
                {runs.map((r) => (
                  <Box key={r.id}>
                    <Text fontSize="sm">
                      {r.source} · {r.found_count} jobs
                    </Text>
                    <Text fontSize="xs" color="muted">
                      {r.created_at} · {r.detail}
                    </Text>
                  </Box>
                ))}
                {!runs.length && <Empty>No imports yet.</Empty>}
              </Stack>
            )}
          </Load>
        </Panel>
      </SimpleGrid>
    </>
  );
}

function ApplicationHistory({ id, revision }) {
  const d = useData(`/api/applications/${id}/history`, revision);
  return (
    <Load {...d}>
      {(h) => (
        <Stack gap="4">
          <Section title="Stage changes" />
          {h.events.map((e) => (
            <Text key={e.id} fontSize="sm">
              {e.created_at} · {e.detail}
            </Text>
          ))}
          <Section title="Recorded outcomes" />
          {h.outcomes.map((o) => (
            <Panel key={o.id} p="4">
              <Text fontSize="sm">
                {o.rejection_stage} · {o.reason_category} ·{" "}
                {o.reason_known ? "Confirmed reason" : "Unconfirmed reason"}
              </Text>
              <Text fontSize="xs" color="muted" mt="2">
                {o.created_at}
              </Text>
              <Text fontSize="sm" mt="2">
                {o.notes}
              </Text>
            </Panel>
          ))}
          {!h.outcomes.length && <Empty>No outcomes recorded.</Empty>}
        </Stack>
      )}
    </Load>
  );
}

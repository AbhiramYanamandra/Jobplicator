import React, { useState } from "react";
import { Box, Button, Flex, Text, Stack, SimpleGrid } from "@chakra-ui/react";
import { Plus, ArrowUpRight } from "lucide-react";
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
  Meter,
  DataTable,
  Modal,
  Form,
  field,
  sources,
  safeUrl,
} from "./ui";
const sourceFields = [
  field("source_type", "Question provenance", {
    options: sources,
    help: "Choose “Real interview” only when it was actually asked in an interview.",
  }),
  field("company", "Company tags (comma-separated)"),
  field("role", "Role"),
  field("interview_stage", "Interview stage"),
  field("notes", "Notes", { type: "textarea" }),
];
export function QuestionBank({ revision, saved }) {
  const d = useData("/api/v3/questions", revision),
    [search, setSearch] = useState(""),
    [difficulty, setDifficulty] = useState(""),
    [source, setSource] = useState(""),
    [add, setAdd] = useState(false),
    [attempt, setAttempt] = useState(null),
    [detail, setDetail] = useState(null);
  return (
    <>
      <Title
        title="Practice with purpose."
        subtitle="One bank for coding practice, company signals, and questions you’ve actually faced."
        action={
          <Button colorPalette="green" size="sm" onClick={() => setAdd(true)}>
            <Plus size={16} />
            Add question
          </Button>
        }
      />
      <Load {...d}>
        {(d) => (
          <>
            <SimpleGrid columns={{ base: 1, md: 3 }} gap="4" mb="6">
              {["Easy", "Medium", "Hard"].map((level, i) => (
                <Panel key={level}>
                  <Flex justify="space-between">
                    <Tag tone={["green", "orange", "red"][i]}>{level}</Tag>
                    <Text fontSize="xs" color="muted">
                      PROBLEMS
                    </Text>
                  </Flex>
                  <Text fontSize="32px" fontWeight="600" mt="3">
                    {d.difficulty[level] || 0}
                  </Text>
                </Panel>
              ))}
            </SimpleGrid>
            <Flex gap="3" mb="5" wrap="wrap">
              <SearchBox
                value={search}
                onChange={setSearch}
                placeholder="Search titles, topics, companies, roles…"
              />
              <Box w="170px">
                <Select
                  label="Difficulty"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  options={[
                    { value: "", label: "All difficulties" },
                    "Easy",
                    "Medium",
                    "Hard",
                  ]}
                />
              </Box>
              <Box w="220px">
                <Select
                  label="Question provenance"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  options={[
                    { value: "", label: "All provenance types" },
                    ...sources,
                  ]}
                />
              </Box>
            </Flex>
            <Panel>
              <DataTable
                headers={[
                  "Problem",
                  "Difficulty / topic",
                  "Company signals",
                  "Provenance",
                  "Practice",
                ]}
              >
                {d.questions
                  .filter(
                    (q) =>
                      (!difficulty || q.difficulty === difficulty) &&
                      (!source || q.source_type === source) &&
                      JSON.stringify({ ...q, attempts: undefined })
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                  )
                  .map((q) => (
                    <tr key={q.id}>
                      <td>
                        <Button
                          size="sm"
                          variant="plain"
                          p="0"
                          h="auto"
                          whiteSpace="normal"
                          textAlign="left"
                          onClick={() => setDetail(q)}
                        >
                          {q.title}
                        </Button>
                        <Text color="muted" fontSize="xs" mt="1">
                          {q.platform}
                          {q.leetcode_number ? ` · #${q.leetcode_number}` : ""}
                        </Text>
                      </td>
                      <td>
                        <Tag
                          tone={
                            q.difficulty === "Easy"
                              ? "green"
                              : q.difficulty === "Hard"
                                ? "red"
                                : "orange"
                          }
                        >
                          {q.difficulty || "Unspecified"}
                        </Tag>
                        <Text fontSize="xs" color="muted" mt="2">
                          {q.primary_topic || "No topic"}
                        </Text>
                      </td>
                      <td>
                        {q.companies.map((c) => (
                          <Box key={c.id} mb="2">
                            <Text fontSize="xs">
                              {c.company}{" "}
                              <span
                                style={{ color: "var(--chakra-colors-muted)" }}
                              >
                                ({c.confidence})
                              </span>
                            </Text>
                            <Text fontSize="11px" color="muted">
                              {[c.role, c.interview_stage]
                                .filter(Boolean)
                                .join(" · ")}
                            </Text>
                          </Box>
                        ))}
                        {!q.companies.length && "—"}
                      </td>
                      <td>
                        <Tag
                          tone={q.asked_in_real_interview ? "green" : "gray"}
                        >
                          {q.source_type}
                        </Tag>
                      </td>
                      <td>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => setAttempt(q)}
                        >
                          Log attempt
                        </Button>
                        <Text color="muted" fontSize="xs" mt="2">
                          {q.attempts.length} attempts
                        </Text>
                      </td>
                    </tr>
                  ))}
              </DataTable>
              {!d.questions.length && (
                <Empty>Add your first practice question.</Empty>
              )}
            </Panel>
            <SimpleGrid
              columns={{ base: 1, xl: 2 }}
              templateColumns={{ xl: "minmax(250px,1fr) minmax(0,2fr)" }}
              gap="5"
              mt="6"
            >
              <Panel>
                <Section
                  title="Topic readiness"
                  subtitle="Solve rate across all logged attempts"
                />
                <Stack gap="5">
                  {d.topic_readiness.map((t) => (
                    <Meter
                      key={t.topic}
                      label={`${t.topic} · ${t.attempted} attempts`}
                      value={t.rate}
                      note={t.attempted ? `${t.rate}%` : "Not attempted"}
                    />
                  ))}
                </Stack>
              </Panel>
              <Panel>
                <Section
                  title="Company × topic"
                  subtitle="Question counts by company tag, including reported practice signals"
                />
                <Heatmap rows={d.company_topics} />
              </Panel>
            </SimpleGrid>
            <Box mt="5">
              <Notice>
                Company-tagged prep is kept separate from confirmed interview
                questions. Tags describe provenance, not a guarantee of what a
                company will ask.
              </Notice>
            </Box>
          </>
        )}
      </Load>
      <Modal
        title="Add a coding question"
        open={add}
        onClose={() => setAdd(false)}
      >
        <Form
          fields={[
            field("title", "Problem title", { required: true }),
            field("platform", "Platform", { default: "LeetCode" }),
            field("leetcode_number", "LeetCode number"),
            field("url", "Problem URL", { type: "url" }),
            field("difficulty", "Difficulty", {
              options: ["Easy", "Medium", "Hard"],
            }),
            field("primary_topic", "Primary topic", { required: true }),
            field("secondary_topics", "Secondary topics (comma-separated)"),
            ...sourceFields,
          ]}
          onSubmit={async (v) => {
            const { company, role, interview_stage, ...q } = v;
            await api("/api/v3/coding-questions", {
              ...q,
              secondary_topics: v.secondary_topics
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
              asked_in_real_interview: v.source_type === "Real interview",
              companies: company
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean)
                .map((company) => ({
                  company,
                  role,
                  interview_stage,
                  source_type: v.source_type,
                  confidence:
                    v.source_type === "Real interview" ? "Direct" : "Reported",
                })),
            });
            setAdd(false);
            saved("Question added");
          }}
        />
      </Modal>
      <Modal
        title={`Log attempt${attempt ? " · " + attempt.title : ""}`}
        open={!!attempt}
        onClose={() => setAttempt(null)}
      >
        {attempt && (
          <Form
            key={attempt.id}
            fields={[
              field("solved", "Solved?", { options: ["No", "Yes"] }),
              field("hint_used", "Used a hint?", { options: ["No", "Yes"] }),
              field("solved_within_target", "Solved within target time?", {
                options: ["No", "Yes"],
              }),
              field("time_taken_minutes", "Time taken (minutes)", {
                type: "number",
                min: 0,
              }),
              field("confidence", "Confidence", {
                options: ["Low", "Medium", "High"],
              }),
              field("notes", "What did you learn?", { type: "textarea" }),
            ]}
            onSubmit={async (v) => {
              await api(`/api/v3/coding-questions/${attempt.id}/attempts`, {
                ...v,
                solved: v.solved === "Yes",
                hint_used: v.hint_used === "Yes",
                solved_within_target: v.solved_within_target === "Yes",
                time_taken_minutes:
                  v.time_taken_minutes === ""
                    ? null
                    : Number(v.time_taken_minutes),
              });
              setAttempt(null);
              saved("Practice attempt logged");
            }}
          />
        )}
      </Modal>
      <Modal
        title={detail?.title || "Question details"}
        open={!!detail}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <Stack gap="4">
            <Text>
              {detail.primary_topic} · {detail.difficulty}
            </Text>
            <Tag>{detail.source_type}</Tag>
            <Text fontSize="sm" color="muted">
              Secondary topics:{" "}
              {parseTopics(detail.secondary_topics).join(", ") || "None"}
            </Text>
            <Text fontSize="sm" whiteSpace="pre-wrap">
              {detail.notes || "No notes yet."}
            </Text>
            {safeUrl(detail.url) && (
              <Button asChild variant="outline" size="sm">
                <a href={safeUrl(detail.url)} target="_blank" rel="noreferrer">
                  Open problem
                  <ArrowUpRight size={14} />
                </a>
              </Button>
            )}
            <Section title="Attempt history" />
            {detail.attempts.map((a) => (
              <Panel key={a.id} p="4">
                <Tag tone={a.solved ? "green" : "orange"}>
                  {a.solved ? "Solved" : "Not solved"}
                </Tag>
                <Text fontSize="xs" color="muted" my="2">
                  {a.attempted_at} · {a.time_taken_minutes ?? "—"} min ·{" "}
                  {a.confidence || "No confidence rating"} ·{" "}
                  {a.hint_used ? "Hint used" : "No hint"} ·{" "}
                  {a.solved_within_target
                    ? "Within target"
                    : "Outside target / unrecorded"}
                </Text>
                <Text fontSize="sm">{a.notes}</Text>
              </Panel>
            ))}
            {!detail.attempts.length && <Empty>No attempts logged yet.</Empty>}
          </Stack>
        )}
      </Modal>
    </>
  );
}
function parseTopics(s) {
  try {
    return JSON.parse(s || "[]");
  } catch {
    return [s];
  }
}
function Heatmap({ rows }) {
  if (!rows.length)
    return <Empty>Add company tags to reveal topic patterns.</Empty>;
  const companies = [...new Set(rows.map((r) => r.company))],
    topics = [...new Set(rows.map((r) => r.primary_topic))],
    max = Math.max(...rows.map((r) => r.count));
  return (
    <Box overflowX="auto">
      <table className="data-table" aria-label="Company topic heatmap">
        <thead>
          <tr>
            <th>Company</th>
            {topics.map((t) => (
              <th key={t}>{t || "Other"}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => (
            <tr key={c}>
              <td>{c}</td>
              {topics.map((t) => {
                const n =
                  rows.find((r) => r.company === c && r.primary_topic === t)
                    ?.count || 0;
                return (
                  <td key={t} style={{ padding: 4 }}>
                    <Box
                      textAlign="center"
                      p="3"
                      borderRadius="md"
                      bg={
                        n ? `rgba(58,142,87,${0.18 + (0.6 * n) / max})` : "soft"
                      }
                      color={n ? "ink" : "muted"}
                      title={`${c}, ${t}: ${n} questions`}
                    >
                      {n}
                    </Box>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}
export function InterviewPrep({ revision, saved, open }) {
  const d = useData("/api/v3/interview-questions", revision),
    stats = useData("/api/v3/questions", revision),
    jobs = useData("/api/jobs", revision),
    profile = useData("/api/profile", revision),
    [add, setAdd] = useState(false),
    [search, setSearch] = useState(""),
    [target, setTarget] = useState("");
  return (
    <>
      <Title
        title="Walk in prepared."
        subtitle="Connect your stories, technical practice, and the role in front of you."
        action={
          <Button size="sm" colorPalette="green" onClick={() => setAdd(true)}>
            <Plus size={15} />
            Add interview question
          </Button>
        }
      />
      <SimpleGrid columns={{ base: 1, xl: 2 }} gap="5" mb="6">
        <Panel>
          <Section title="Prepare for a specific opportunity" />
          <Select
            label="Interview target job"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            options={[
              { value: "", label: "Choose an opportunity" },
              ...(jobs.data || []).map((j) => ({
                value: j.id,
                label: `${j.company} · ${j.title}`,
              })),
            ]}
          />
          <Button
            mt="4"
            size="sm"
            colorPalette="green"
            disabled={!target}
            onClick={() => open(target)}
          >
            Open tailored preparation
          </Button>
        </Panel>
        <Panel>
          <Section title="Focus your next practice session" />
          <Load {...stats}>
            {(q) => {
              const weak = q.topic_readiness.filter(
                (t) => t.attempted && t.rate < 70,
              );
              return (
                <>
                  <Flex wrap="wrap" gap="2" mb="4">
                    {weak.length ? (
                      weak.map((t) => (
                        <Tag tone="orange" key={t.topic}>
                          {t.topic} · {t.rate}%
                        </Tag>
                      ))
                    ) : (
                      <Tag tone="gray">Log attempts to reveal focus areas</Tag>
                    )}
                  </Flex>
                  <Text fontSize="sm" color="muted">
                    Use confirmed interview questions, relevant company-tagged
                    prep, and general practice as distinct sources.
                  </Text>
                </>
              );
            }}
          </Load>
        </Panel>
      </SimpleGrid>
      <SearchBox
        value={search}
        onChange={setSearch}
        placeholder="Search interview questions, companies, categories…"
      />
      <Box mt="5">
        <Load {...d}>
          {(questions) => (
            <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
              {questions
                .filter((q) =>
                  JSON.stringify(q)
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((q) => (
                  <Panel key={q.id}>
                    <Flex gap="2" mb="4" wrap="wrap">
                      <Tag tone={q.asked_in_real_interview ? "green" : "gray"}>
                        {q.source_type || "Unspecified"}
                      </Tag>
                      <Tag tone="gray">{q.question_category || "General"}</Tag>
                    </Flex>
                    <Text fontWeight="600" mb="3">
                      {q.question_text}
                    </Text>
                    <Text color="muted" fontSize="xs">
                      {[q.company || "General", q.role, q.interview_stage]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                    {q.answer && (
                      <Box mt="4" p="3" bg="soft" borderRadius="md">
                        <Text fontSize="xs" color="muted" mb="1">
                          YOUR ANSWER
                        </Text>
                        <Text fontSize="sm" whiteSpace="pre-wrap">
                          {q.answer}
                        </Text>
                      </Box>
                    )}
                    {q.notes && (
                      <Text fontSize="xs" color="muted" mt="3">
                        {q.notes}
                      </Text>
                    )}
                  </Panel>
                ))}
              {!questions.length && (
                <Empty>No interview questions saved yet.</Empty>
              )}
            </SimpleGrid>
          )}
        </Load>
      </Box>
      <Panel mt="6">
        <Section
          title="Your evidence-backed STAR stories"
          subtitle="A starting point for behavioral interviews"
        />
        <Load {...profile}>
          {(p) => (
            <SimpleGrid columns={{ base: 1, md: 2 }} gap="5">
              {p.star_stories.map((s) => (
                <Box key={s.story_id}>
                  <Tag tone="gray">{s.parent_id}</Tag>
                  {["situation", "task", "action", "result"].map((k) => (
                    <Box key={k} mt="3">
                      <Text
                        textTransform="uppercase"
                        fontSize="10px"
                        color="accent"
                        fontWeight="600"
                      >
                        {k}
                      </Text>
                      <Text fontSize="sm" color="muted">
                        {s[k]}
                      </Text>
                    </Box>
                  ))}
                </Box>
              ))}
            </SimpleGrid>
          )}
        </Load>
      </Panel>
      <Modal
        title="Record an interview question"
        open={add}
        onClose={() => setAdd(false)}
      >
        <Form
          fields={[
            field("question_text", "Question", {
              type: "textarea",
              required: true,
            }),
            field("question_category", "Category", {
              options: [
                "Technical",
                "Behavioral",
                "System design",
                "Culture",
                "Other",
              ],
            }),
            ...sourceFields.map((f) =>
              f.key === "company" ? { ...f, label: "Company" } : f,
            ),
            field("answer", "Your answer / preparation notes", {
              type: "textarea",
            }),
          ]}
          onSubmit={async (v) => {
            await api("/api/v3/interview-questions", {
              ...v,
              asked_in_real_interview: v.source_type === "Real interview",
            });
            setAdd(false);
            saved("Interview question saved");
          }}
        />
      </Modal>
    </>
  );
}

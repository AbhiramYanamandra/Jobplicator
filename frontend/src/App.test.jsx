import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  cleanup,
  within,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { ThemeProvider } from "next-themes";
import App from "./App";
import { resumeHtml } from "./packages";
import { system } from "./theme";
import fixtures from "./test-fixtures.json";
let calls = [];
beforeEach(() => {
  calls = [];
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path, options) => {
      calls.push({ path, options });
      if (options?.method === "POST") {
        return {
          ok: true,
          json: async () => ({ id: 999, ok: true, count: 2 }),
          headers: { get: () => 'attachment; filename="Resume_Test.docx"' },
          blob: async () => new Blob(["docx"]),
        };
      }
      const data = fixtures[path];
      if (data === undefined) throw new Error("Missing fixture " + path);
      return { ok: true, json: async () => structuredClone(data) };
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function show(route = "dashboard") {
  window.location.hash = route;
  return render(
    <ChakraProvider value={system}>
      <ThemeProvider attribute="class">
        <App />
      </ThemeProvider>
    </ChakraProvider>,
  );
}
const pages = [
  ["dashboard", "Make your next move."],
  ["jobs", "Find the right fit."],
  ["clusters", "See the bigger picture."],
  ["applications", "Keep every door in view."],
  ["packages", "Your application packages."],
  ["resume", "Make your experience count."],
  ["evidence", "Let your work speak."],
  ["analytics", "Turn experience into insight."],
  ["interview", "Walk in prepared."],
  ["questions", "Practice with purpose."],
  ["skills", "Build what matters next."],
  ["strategy", "A search with direction."],
  ["ingestion", "Bring your opportunities together."],
  ["profile", "Your profile. Your evidence."],
];
describe("All pages render against the original v3 payloads", () => {
  for (const [route, title] of pages) {
    it(route, async () => {
      show(route);
      expect(
        await screen.findByRole("heading", { name: title }),
      ).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.queryAllByText("Loading your workspace…")).toHaveLength(
          0,
        ),
      );
      expect(
        screen.queryByText(/Could not load this page/),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("main").textContent.length).toBeGreaterThan(100);
    });
  }
});
it("shows dossier, requirements and coding prep", async () => {
  const j = fixtures["/api/jobs"][0];
  show("job/" + j.id);
  expect(
    await screen.findByRole("heading", { name: j.title }),
  ).toBeInTheDocument();
  expect(
    await screen.findByRole("heading", {
      name: "Requirement & evidence matrix",
    }),
  ).toBeInTheDocument();
  expect(
    await screen.findByRole("heading", { name: "Your coding prep set" }),
  ).toBeInTheDocument();
});
it("filters jobs and opens the selected dossier", async () => {
  const u = userEvent.setup();
  show("jobs");
  await screen.findByText(/opportunities$/, { selector: "h2" });
  await u.type(
    screen.getByPlaceholderText("Search roles, companies, skills…"),
    "no-such-company",
  );
  expect(
    await screen.findByText("No jobs match these filters."),
  ).toBeInTheDocument();
  await u.clear(
    screen.getByPlaceholderText("Search roles, companies, skills…"),
  );
  const j = fixtures["/api/jobs"][0];
  await u.click(screen.getByRole("button", { name: j.title, exact: true }));
  expect(
    await screen.findByRole("heading", { name: j.title }),
  ).toBeInTheDocument();
});
it("submits a job with complete posting data", async () => {
  const u = userEvent.setup();
  show();
  await u.click(screen.getByRole("button", { name: "Add job", exact: true }));
  const dialog = screen.getByRole("dialog");
  await u.type(within(dialog).getByLabelText("Company *"), "Test Co");
  await u.type(
    within(dialog).getByLabelText("Job title *"),
    "Software Engineer",
  );
  await u.type(
    within(dialog).getByLabelText("Full job description *"),
    "React, Python, SQL required.",
  );
  await u.click(
    within(dialog).getByRole("button", { name: "Add & assess job" }),
  );
  await waitFor(() =>
    expect(
      calls.find((c) => c.path === "/api/jobs" && c.options?.method === "POST"),
    ).toBeTruthy(),
  );
  const body = JSON.parse(
    calls.find((c) => c.path === "/api/jobs" && c.options?.method === "POST")
      .options.body,
  );
  expect(body).toMatchObject({
    company: "Test Co",
    title: "Software Engineer",
    source: "Manual",
  });
});
it("records question provenance, secondary topics, role and stage", async () => {
  const u = userEvent.setup();
  show("questions");
  await screen.findByRole("heading", { name: "Practice with purpose." });
  await u.click(screen.getByRole("button", { name: "Add question" }));
  const dialog = screen.getByRole("dialog");
  await u.type(within(dialog).getByLabelText("Problem title *"), "Test arrays");
  await u.type(within(dialog).getByLabelText("Primary topic *"), "Arrays");
  await u.type(
    within(dialog).getByLabelText("Secondary topics (comma-separated)"),
    "Hashing, Sorting",
  );
  await u.selectOptions(
    within(dialog).getByLabelText("Question provenance"),
    "Company-tagged prep",
  );
  await u.type(
    within(dialog).getByLabelText("Company tags (comma-separated)"),
    "Acme, Example",
  );
  await u.type(within(dialog).getByLabelText("Role"), "Graduate");
  await u.type(within(dialog).getByLabelText("Interview stage"), "OA");
  await u.click(
    within(dialog).getByRole("button", { name: "Save", exact: true }),
  );
  await waitFor(() =>
    expect(calls.some((c) => c.path === "/api/v3/coding-questions")).toBe(true),
  );
  const b = JSON.parse(
    calls.find((c) => c.path === "/api/v3/coding-questions").options.body,
  );
  expect(b.asked_in_real_interview).toBe(false);
  expect(b.secondary_topics).toEqual(["Hashing", "Sorting"]);
  expect(b.companies).toHaveLength(2);
  expect(b.companies[0]).toMatchObject({
    role: "Graduate",
    interview_stage: "OA",
    confidence: "Reported",
  });
});
it("logs solved, hint and target-time fields", async () => {
  const u = userEvent.setup();
  show("questions");
  const buttons = await screen.findAllByRole("button", { name: "Log attempt" });
  await u.click(buttons[0]);
  const dialog = screen.getByRole("dialog");
  await u.selectOptions(within(dialog).getByLabelText("Solved?"), "Yes");
  await u.selectOptions(
    within(dialog).getByLabelText("Solved within target time?"),
    "Yes",
  );
  await u.type(within(dialog).getByLabelText("Time taken (minutes)"), "12");
  await u.click(
    within(dialog).getByRole("button", { name: "Save", exact: true }),
  );
  await waitFor(() =>
    expect(calls.some((c) => c.path.endsWith("/attempts"))).toBe(true),
  );
  expect(
    JSON.parse(calls.find((c) => c.path.endsWith("/attempts")).options.body),
  ).toMatchObject({
    solved: true,
    hint_used: false,
    solved_within_target: true,
    time_taken_minutes: 12,
  });
});
it("persists resume edits, adds an evidence-backed variant and saves application version", async () => {
  const u = userEvent.setup();
  show("resume");
  await screen.findByLabelText("Professional summary");
  fireEvent.change(screen.getByLabelText("Professional summary"), {
    target: { value: "A precise new summary." },
  });
  await waitFor(() =>
    expect(
      JSON.parse(
        localStorage.getItem(
          "jobplicator-resume:00000000-0000-4000-8000-000000000001",
        ),
      ).content.resume.summary,
    ).toBe("A precise new summary."),
  );
  await u.click(
    screen.getByRole("button", { name: "Experience", exact: true }),
  );
  await u.click(
    screen.getAllByRole("button", { name: "Bullet from evidence" })[0],
  );
  const dialog = screen.getByRole("dialog");
  await u.click(
    within(dialog)
      .getAllByRole("button", { name: "Generate variants" })
      .find((b) => !b.disabled),
  );
  await u.click(
    within(dialog).getAllByRole("button", { name: "Use this bullet" })[0],
  );
  expect(
    JSON.parse(
      localStorage.getItem(
        "jobplicator-resume:00000000-0000-4000-8000-000000000001",
      ),
    ).content.resume.experience[0].bullets.at(-1).evidence,
  ).toHaveLength(1);
  await u.selectOptions(
    screen.getByLabelText("Resume target opportunity"),
    fixtures["/api/jobs"][0].id,
  );
  await u.click(
    screen.getByRole("button", { name: "Save version", exact: true }),
  );
  await waitFor(() =>
    expect(calls.some((c) => c.path.endsWith("/resume-version"))).toBe(true),
  );
  const body = JSON.parse(
    calls.find((c) => c.path.endsWith("/resume-version")).options.body,
  );
  expect(body.content.summary).toBe("A precise new summary.");
  expect(body.fit_score).toBeNull();
});
it("validates weights without claiming changes affect scores", async () => {
  const u = userEvent.setup();
  show("strategy");
  expect(
    await screen.findByText(/does not apply saved weight changes/),
  ).toBeInTheDocument();
  await u.click(screen.getByRole("button", { name: "Record weights" }));
  const dialog = screen.getByRole("dialog");
  const weight = within(dialog).getAllByRole("spinbutton")[0];
  fireEvent.change(weight, { target: { value: "99" } });
  await u.type(
    within(dialog).getByLabelText("Reason for this proposal *"),
    "Testing",
  );
  await u.click(
    within(dialog).getByRole("button", { name: "Save", exact: true }),
  );
  expect(
    await within(dialog).findByText("Weights must total 100."),
  ).toBeInTheDocument();
  expect(calls.filter((c) => c.options?.method === "POST")).toHaveLength(0);
});
it("supports keyboard selection of cluster nodes", async () => {
  show("clusters");
  const map = await screen.findByRole("group", {
    name: "Interactive job cluster map",
  });
  await waitFor(() =>
    expect(within(map).getAllByRole("button").length).toBeGreaterThan(0),
  );
  fireEvent.keyDown(within(map).getAllByRole("button")[0], { key: "Enter" });
  expect(
    await screen.findByRole("button", { name: "Open dossier" }),
  ).toBeInTheDocument();
});
it("presents API failures with a retry route", async () => {
  fetch.mockImplementation(async () => ({
    ok: false,
    text: async () => JSON.stringify({ detail: "Database unavailable" }),
  }));
  show("jobs");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Database unavailable",
  );
  expect(
    screen.getByRole("button", { name: "Refresh data" }),
  ).toBeInTheDocument();
});

it("saves CRM stage, follow-up, notes and version references from the dossier", async () => {
  const u = userEvent.setup(),
    j = fixtures["/api/jobs"][0];
  show("job/" + j.id);
  await u.click(
    await screen.findByRole("button", { name: "Track application" }),
  );
  const dialog = screen.getByRole("dialog");
  await u.selectOptions(
    within(dialog).getByLabelText("Application stage"),
    "applied",
  );
  fireEvent.change(within(dialog).getByLabelText("Applied date"), {
    target: { value: "2026-10-02" },
  });
  fireEvent.change(within(dialog).getByLabelText("Follow-up date"), {
    target: { value: "2026-10-09" },
  });
  await u.type(
    within(dialog).getByLabelText("Next action"),
    "Ask recruiter for an update",
  );
  await u.type(within(dialog).getByLabelText("Resume version"), "Graduate v2");
  await u.type(
    within(dialog).getByLabelText("Notes"),
    "Contacted via careers page",
  );
  await u.click(
    within(dialog).getByRole("button", { name: "Save", exact: true }),
  );
  await waitFor(() =>
    expect(calls.some((c) => c.path.endsWith("/application"))).toBe(true),
  );
  expect(
    JSON.parse(calls.find((c) => c.path.endsWith("/application")).options.body),
  ).toMatchObject({
    status: "applied",
    applied_at: "2026-10-02",
    follow_up_date: "2026-10-09",
    resume_version: "Graduate v2",
    notes: "Contacted via careers page",
  });
});
it("loads the latest stored cover letter and saves an edited version", async () => {
  const j = fixtures["/api/jobs"][0],
    realFetch = fetch.getMockImplementation();
  fetch.mockImplementation(async (path, options) =>
    path === `/api/jobs/${j.id}/documents`
      ? {
          ok: true,
          json: async () => ({
            resume_versions: [],
            cover_letters: [
              {
                id: 77,
                version: 3,
                content: "Stored letter draft",
                created_at: "2026-10-02",
              },
            ],
          }),
        }
      : realFetch(path, options),
  );
  const u = userEvent.setup();
  show("job/" + j.id);
  await waitFor(() =>
    expect(screen.getByLabelText("Cover letter")).toHaveValue(
      "Stored letter draft",
    ),
  );
  fireEvent.change(screen.getByLabelText("Cover letter"), {
    target: { value: "Reviewed cover letter" },
  });
  await u.click(
    screen.getByRole("button", { name: "Save version", exact: true }),
  );
  await waitFor(() =>
    expect(calls.some((c) => c.path.endsWith("/cover-letter"))).toBe(true),
  );
  expect(
    JSON.parse(calls.find((c) => c.path.endsWith("/cover-letter")).options.body)
      .content,
  ).toBe("Reviewed cover letter");
});
it("restores a saved SQLite resume without losing its evidence references", async () => {
  const j = fixtures["/api/jobs"][0],
    realFetch = fetch.getMockImplementation();
  const { INITIAL_RESUME } = await import("./resume-data");
  const r = structuredClone(fixtures["/api/resume-draft"].content.resume);
  r.summary = "Restored named version";
  fetch.mockImplementation(async (path, options) =>
    path === `/api/jobs/${j.id}/documents`
      ? {
          ok: true,
          json: async () => ({
            resume_versions: [
              {
                id: 78,
                name: "Stored resume",
                content_json: JSON.stringify(r),
                created_at: "2026-10-02",
              },
            ],
            cover_letters: [],
          }),
        }
      : realFetch(path, options),
  );
  sessionStorage.setItem(
    "jobplicator-target:00000000-0000-4000-8000-000000000001",
    j.id,
  );
  const u = userEvent.setup();
  show("resume");
  await u.click(
    await screen.findByRole("button", { name: "Restore", exact: true }),
  );
  await u.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Restore version",
    }),
  );
  expect(screen.getByLabelText("Professional summary")).toHaveValue(
    "Restored named version",
  );
  expect(
    JSON.parse(
      localStorage.getItem(
        "jobplicator-resume:00000000-0000-4000-8000-000000000001",
      ),
    ).content.resume.experience[0].bullets[0].evidence,
  ).toEqual(r.experience[0].bullets[0].evidence);
});
it("keeps a failed question submission open with an actionable error", async () => {
  const realFetch = fetch.getMockImplementation();
  fetch.mockImplementation(async (path, options) =>
    options?.method === "POST"
      ? {
          ok: false,
          text: async () =>
            JSON.stringify({ detail: "Write failed; try again" }),
        }
      : realFetch(path, options),
  );
  const u = userEvent.setup();
  show("questions");
  await u.click(screen.getByRole("button", { name: "Add question" }));
  const dialog = screen.getByRole("dialog");
  await u.type(
    within(dialog).getByLabelText("Problem title *"),
    "Keep my draft",
  );
  await u.type(within(dialog).getByLabelText("Primary topic *"), "Arrays");
  await u.click(
    within(dialog).getByRole("button", { name: "Save", exact: true }),
  );
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    "Write failed; try again",
  );
  expect(within(dialog).getByLabelText("Problem title *")).toHaveValue(
    "Keep my draft",
  );
});

it("collapses the sidebar, preserves icon navigation, and remembers the choice", async () => {
  const u = userEvent.setup();
  const view = show();
  await screen.findByRole("heading", { name: "Make your next move." });
  await u.click(screen.getByLabelText("Collapse sidebar"));
  expect(screen.getByLabelText("Expand sidebar")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  expect(localStorage.getItem("jobplicator-sidebar-collapsed")).toBe("true");
  await u.click(screen.getByLabelText("Jobs"));
  expect(window.location.hash).toBe("#jobs");
  view.unmount();
  show();
  expect(screen.getByLabelText("Expand sidebar")).toBeInTheDocument();
  await u.click(screen.getByLabelText("Expand sidebar"));
  expect(localStorage.getItem("jobplicator-sidebar-collapsed")).toBe("false");
});
it("keeps browser recovery through reload until explicitly restored or discarded", async () => {
  const key = "jobplicator-resume:00000000-0000-4000-8000-000000000001";
  const recovered = structuredClone(fixtures["/api/resume-draft"]);
  recovered.content.resume.summary = "Previously unsaved work";
  localStorage.setItem(key, JSON.stringify(recovered));
  const view = show("resume");
  await screen.findByRole("button", { name: "Restore browser recovery" });
  expect(JSON.parse(localStorage.getItem(key)).content.resume.summary).toBe(
    "Previously unsaved work",
  );
  view.unmount();
  show("resume");
  await userEvent.click(
    await screen.findByRole("button", { name: "Restore browser recovery" }),
  );
  expect(screen.getByLabelText("Professional summary")).toHaveValue(
    "Previously unsaved work",
  );
  expect(screen.getByText("Unsaved cloud changes")).toBeInTheDocument();
});
it("saves a cloud draft with its revision and preserves edits on a conflict", async () => {
  const normalFetch = fetch.getMockImplementation();
  let conflict = false;
  fetch.mockImplementation(async (path, options) => {
    if (path === "/api/resume-draft" && options?.method === "POST") {
      calls.push({ path, options });
      if (conflict)
        return {
          ok: false,
          text: async () =>
            JSON.stringify({ detail: "The draft was updated elsewhere." }),
        };
      const body = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({ ...body, revision: body.revision + 1 }),
      };
    }
    return normalFetch(path, options);
  });
  show("resume");
  fireEvent.change(await screen.findByLabelText("Professional summary"), {
    target: { value: "Cloud saved summary" },
  });
  await userEvent.click(
    screen.getByRole("button", { name: "Save cloud draft" }),
  );
  await screen.findByText("Cloud draft up to date");
  const body = JSON.parse(
    calls.find(
      (c) => c.path === "/api/resume-draft" && c.options?.method === "POST",
    ).options.body,
  );
  expect(body.revision).toBe(fixtures["/api/resume-draft"].revision);
  expect(body.content.resume.summary).toBe("Cloud saved summary");
  conflict = true;
  fireEvent.change(screen.getByLabelText("Professional summary"), {
    target: { value: "Keep my later edits" },
  });
  await userEvent.click(
    screen.getByRole("button", { name: "Save cloud draft" }),
  );
  await screen.findByText("The draft was updated elsewhere.");
  expect(screen.getByLabelText("Professional summary")).toHaveValue(
    "Keep my later edits",
  );
});

it("lists packages and saves an edited package as a new version", async () => {
  const user = userEvent.setup();
  const row = fixtures["/api/packages"].packages[0];
  show("packages");
  await user.click(await screen.findByRole("button", { name: row.title }));
  expect(
    await screen.findByRole("heading", { name: row.title }),
  ).toBeInTheDocument();
  const field = screen.getAllByRole("textbox", { name: /bullet 1$/ })[0];
  expect(field.value).toBe(
    "Built a Python reporting tool for a sample dataset.",
  );
  expect(
    screen.getAllByRole("button", { name: "Remove evidence DEMO-01" }).length,
  ).toBeGreaterThan(0);
  const save = screen.getByRole("button", { name: /Save as new version/ });
  expect(save).toBeDisabled();
  await user.clear(field);
  await user.type(field, "Built a Python reporting tool.");
  expect(save).toBeEnabled();
  expect(screen.getByRole("button", { name: /Approve/ })).toBeDisabled();
  await user.click(save);
  await waitFor(() => {
    const post = calls.find(
      (c) =>
        c.path === `/api/jobs/${row.job_id}/package` &&
        c.options?.method === "POST",
    );
    expect(post).toBeTruthy();
    const body = JSON.parse(post.options.body);
    expect(body.source).toBe("manual");
    expect(body.content.resume.experience[0].bullets[0]).toEqual({
      text: "Built a Python reporting tool.",
      evidence_ids: ["DEMO-01"],
    });
  });
});

it("offers to build a package for a job that has none", async () => {
  const user = userEvent.setup();
  const job = fixtures["/api/jobs"].find(
    (j) => !fixtures[`/api/jobs/${j.id}/package`].package,
  );
  show(`package/${job.id}`);
  await user.click(
    await screen.findByRole("button", { name: /Create package from evidence/ }),
  );
  await waitFor(() =>
    expect(
      calls.some(
        (c) =>
          c.path === `/api/jobs/${job.id}/package/draft` &&
          c.options?.method === "POST",
      ),
    ).toBe(true),
  );
});

it("queues a package for the AI generator with a note", async () => {
  const user = userEvent.setup();
  const row = fixtures["/api/packages"].packages[0];
  show(`package/${row.job_id}`);
  await user.click(
    await screen.findByRole("button", { name: /Ask AI to rewrite/ }),
  );
  await user.type(
    screen.getByRole("textbox", { name: "Note for the AI generator" }),
    "Lead with FPGA work",
  );
  await user.click(screen.getByRole("button", { name: "Queue for AI" }));
  await waitFor(() => {
    const post = calls.find(
      (c) =>
        c.path === `/api/jobs/${row.job_id}/package/request` &&
        c.options?.method === "POST",
    );
    expect(JSON.parse(post.options.body)).toEqual({
      note: "Lead with FPGA work",
    });
  });
});

it("adds suggested company boards and syncs them", async () => {
  const user = userEvent.setup();
  show("ingestion");
  await user.click(
    await screen.findByRole("button", { name: "Add suggested companies" }),
  );
  await waitFor(() => {
    const post = calls.find(
      (c) => c.path === "/api/boards" && c.options?.method === "POST",
    );
    expect(JSON.parse(post.options.body).boards.length).toBe(
      fixtures["/api/boards"].suggested.length,
    );
  });
  await user.click(screen.getByRole("button", { name: /Sync now/ }));
  await waitFor(() =>
    expect(
      calls.some(
        (c) => c.path === "/api/boards/sync" && c.options?.method === "POST",
      ),
    ).toBe(true),
  );
});

it("runs the daily company-board check when the dashboard opens", async () => {
  show("dashboard");
  await waitFor(() => {
    const post = calls.find((c) => c.path === "/api/boards/sync");
    expect(JSON.parse(post.options.body)).toEqual({ stale_only: true });
  });
});

it("renders the resume template with markup, marks and the Honours WAM", () => {
  const html = resumeHtml(
    {
      name: "Alex Example",
      phone: "+61 400 000 000",
      email: "alex@example.test",
      github: "https://github.com/example",
      work_rights: "Australian Permanent Resident",
    },
    {
      tagline: { text: "Embedded engineer", evidence_ids: [] },
      summary: { text: "Built <b>things</b>", evidence_ids: [] },
      skills: [{ label: "Programming", value: "C; **Python**" }],
      education: {
        institution: "UNSW",
        degree: "BE in **Computer Engineering**",
        dates: "Mar 2022 – Aug 2026",
        details: "Honours WAM: 74.5",
        highlights: [{ text: "Placed 2^nd^", dates: "2023", evidence_ids: [] }],
      },
      experience: [
        {
          title: "Intern",
          org: "Lab",
          location: "Sydney",
          dates: "2025",
          bullets: [{ text: "Wrote **firmware**", evidence_ids: [] }],
        },
      ],
      projects: [
        { title: "Thesis", org: "UNSW", mark: "89 HD", dates: "", bullets: [] },
      ],
    },
  );
  expect(html).toContain('<a href="mailto:alex@example.test">Email</a>');
  expect(html).toContain("+61 400 000 000 | <a");
  expect(html).toContain("\u201cEmbedded engineer\u201d");
  expect(html).toContain("<em>Honours WAM: 74.5</em>");
  expect(html).toContain("Placed 2<sup>nd</sup>");
  expect(html).toContain("<b>Computer Engineering</b>");
  expect(html).toContain("Wrote <b>firmware</b>");
  expect(html).toContain("<b>Thesis: UNSW – 89 HD</b>");
  expect(html).toContain("Built &lt;b&gt;things&lt;/b&gt;");
  expect(html).not.toContain("**");
});

it("edits template fields and downloads the resume as Word", async () => {
  const user = userEvent.setup();
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:x"),
      revokeObjectURL: vi.fn(),
    }),
  );
  const row = fixtures["/api/packages"].packages[0];
  show(`package/${row.job_id}`);
  const tagline = await screen.findByRole("textbox", {
    name: "Resume tagline",
  });
  await user.type(tagline, "Embedded engineer");
  await user.click(screen.getByRole("button", { name: /Add highlight/ }));
  await user.type(
    screen.getByRole("textbox", { name: "Highlight 1" }),
    "Thesis – 89 HD",
  );
  await user.click(screen.getByRole("button", { name: "Word" }));
  await waitFor(() => {
    const post = calls.find(
      (c) => c.path === `/api/jobs/${row.job_id}/package/resume.docx`,
    );
    expect(post).toBeTruthy();
    const body = JSON.parse(post.options.body);
    expect(body.resume.tagline.text).toBe("Embedded engineer");
    expect(body.resume.education.highlights[0].text).toBe("Thesis – 89 HD");
  });
  expect(URL.createObjectURL).toHaveBeenCalled();
});

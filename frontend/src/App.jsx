import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Flex,
  Text,
  Heading,
  Stack,
  SimpleGrid,
} from "@chakra-ui/react";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Briefcase,
  Network,
  Columns3,
  FileText,
  ShieldCheck,
  ChartNoAxesCombined,
  MessagesSquare,
  Code2,
  Sparkles,
  Compass,
  Plus,
  Sun,
  Moon,
  Menu,
  X,
  RefreshCw,
  ArrowRight,
  Leaf,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Settings,
} from "lucide-react";
import {
  api,
  useData,
  Panel,
  Title,
  Section,
  Tag,
  Load,
  JobCard,
  Notice,
  Empty,
  Modal,
  Form,
  field,
} from "./ui";
import {
  Jobs,
  Clusters,
  Applications,
  Dossier,
  Evidence,
  Analytics,
  Skills,
  Strategy,
  Ingestion,
} from "./pages";
import { QuestionBank, InterviewPrep } from "./questions";
import ResumeStudio from "./resume";
import { useAuth } from "./auth";
import Profile from "./profile";
const nav = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["jobs", "Jobs", Briefcase],
  ["clusters", "Clusters", Network],
  ["applications", "Applications", Columns3],
  ["resume", "Resume Studio", FileText],
  ["evidence", "Evidence", ShieldCheck],
  ["analytics", "Analytics", ChartNoAxesCombined],
  ["interview", "Interview Prep", MessagesSquare],
  ["questions", "Question Bank", Code2],
  ["skills", "Skills", Sparkles],
  ["strategy", "Strategy", Compass],
  ["profile", "Profile & Data", Settings],
];
const route = () => location.hash.slice(1) || "dashboard";
export default function App() {
  const [page, setPage] = useState(route),
    [revision, setRevision] = useState(0),
    [menu, setMenu] = useState(false),
    [add, setAdd] = useState(false),
    [toast, setToast] = useState("");
  const { resolvedTheme, setTheme } = useTheme();
  const { user, config, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("jobplicator-sidebar-collapsed") === "true",
  );
  useEffect(() => {
    try {
      localStorage.setItem("jobplicator-sidebar-collapsed", String(collapsed));
    } catch {}
  }, [collapsed]);
  useEffect(() => {
    const close = (e) => {
      if (e.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  const profileInfo = useData("/api/profile", revision);
  const name =
    profileInfo.data?.profile?.find((p) => p.Field === "Name")?.Value ||
    user.email ||
    "Your workspace";
  const initials = name
    .split(/[ @]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
  const labelDisplay = { base: "inline", lg: collapsed ? "none" : "inline" };
  const sidebarWidth = { base: "238px", lg: collapsed ? "76px" : "238px" };
  useEffect(() => {
    const cb = () => {
      setPage(route());
      setMenu(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", cb);
    return () => window.removeEventListener("hashchange", cb);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  const go = (p) => (location.hash = p),
    open = (id) => go(`job/${id}`),
    refresh = () => setRevision((v) => v + 1),
    saved = (message) => {
      refresh();
      setToast(message || "Saved successfully");
    };
  const props = { revision, go, open, saved };
  let content;
  if (page.startsWith("job/"))
    content = <Dossier key={page} id={page.slice(4)} {...props} />;
  else
    content = {
      dashboard: <Dashboard {...props} />,
      jobs: <Jobs {...props} />,
      clusters: <Clusters {...props} />,
      applications: <Applications {...props} />,
      resume: <ResumeStudio {...props} />,
      evidence: <Evidence {...props} />,
      analytics: <Analytics {...props} />,
      interview: <InterviewPrep {...props} />,
      questions: <QuestionBank {...props} />,
      skills: <Skills {...props} />,
      strategy: <Strategy {...props} />,
      ingestion: <Ingestion {...props} />,
      profile: <Profile {...props} />,
    }[page] || <Dashboard {...props} />;
  return (
    <Box minH="100vh">
      <Box
        display={{ base: menu ? "block" : "none", lg: "block" }}
        position="fixed"
        inset="0 auto 0 0"
        id="workspace-sidebar"
        as="aside"
        aria-label="Workspace navigation"
        width={sidebarWidth}
        transition="width .2s"
        zIndex="30"
        bg="#11271f"
        color="#d9e4dc"
        px={{ base: 4, lg: collapsed ? 2 : 4 }}
        py="7"
        overflowY="auto"
      >
        <Flex
          px={{ base: 3, lg: collapsed ? 1 : 3 }}
          gap="3"
          align="center"
          mb="5"
        >
          <Flex
            bg="#c6e7a3"
            color="#19372b"
            borderRadius="lg"
            w="34px"
            h="34px"
            align="center"
            justify="center"
          >
            <Leaf size={20} />
          </Flex>
          <Heading size="md" letterSpacing="-.5px" display={labelDisplay}>
            jobplicator<span style={{ color: "#bcdc9c" }}>.</span>
          </Heading>
        </Flex>
        <Button
          display={{ base: "none", lg: "flex" }}
          variant="plain"
          color="#a5bcad"
          mb="5"
          size="sm"
          width="full"
          justifyContent={collapsed ? "center" : "start"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          aria-controls="workspace-sidebar"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? (
            <PanelLeftOpen size={19} />
          ) : (
            <PanelLeftClose size={19} />
          )}
          <Text display={labelDisplay}>Collapse sidebar</Text>
        </Button>
        <Button
          display={{ base: "flex", lg: "none" }}
          variant="plain"
          color="white"
          mb="4"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        >
          <X size={18} />
          Close
        </Button>
        <Text
          display={labelDisplay}
          px="3"
          color="#8aab98"
          fontSize="10px"
          letterSpacing=".15em"
          mb="3"
        >
          YOUR WORKSPACE
        </Text>
        <Stack gap="1">
          {nav.map(([id, label, Icon], i) => (
            <React.Fragment key={id}>
              {[4, 7].includes(i) && (
                <Box h="1px" bg="#ffffff12" my="3" mx="3" />
              )}
              <Button
                justifyContent={{
                  base: "start",
                  lg: collapsed ? "center" : "start",
                }}
                aria-label={label}
                title={collapsed ? label : undefined}
                variant="plain"
                size="sm"
                h="40px"
                px="3"
                color={page === id ? "#e7f4de" : "#a5bcad"}
                bg={page === id ? "#294336" : "transparent"}
                borderRadius="lg"
                fontWeight={page === id ? 600 : 400}
                onClick={() => go(id)}
                aria-current={page === id ? "page" : undefined}
                _hover={{ bg: "#ffffff0b", color: "white" }}
              >
                <Icon size={17} />
                <Text as="span" display={labelDisplay}>
                  {label}
                </Text>
              </Button>
            </React.Fragment>
          ))}
        </Stack>
        <Box mt="8" mx="2" borderTop="1px solid #ffffff18" pt="5">
          <Flex gap="3" align="center">
            <Flex
              borderRadius="full"
              bg="#395344"
              w="32px"
              h="32px"
              align="center"
              justify="center"
              fontSize="xs"
            >
              {initials}
            </Flex>
            <Box display={labelDisplay}>
              <Text fontSize="xs" fontWeight="600" overflowWrap="anywhere">
                {name}
              </Text>
              <Text fontSize="10px" color="#94ad9d">
                Your next chapter starts here
              </Text>
            </Box>
          </Flex>
          <Text fontSize="10px" color="#71927e" mt="4" display={labelDisplay}>
            JOBPLICATOR 4.0 ·{" "}
            {config.auth_mode === "local"
              ? "LOCAL DEVELOPMENT"
              : "PRIVATE WORKSPACE"}
          </Text>
          {config.auth_mode !== "local" && (
            <Button
              aria-label="Sign out"
              title="Sign out"
              variant="plain"
              color="#a5bcad"
              size="sm"
              mt="3"
              onClick={async () => {
                try {
                  await signOut();
                } catch (e) {
                  setToast(e.message);
                }
              }}
            >
              <LogOut size={16} />
              <Text as="span" display={labelDisplay}>
                Sign out
              </Text>
            </Button>
          )}
        </Box>
      </Box>
      {menu && (
        <Box
          position="fixed"
          inset="0"
          bg="blackAlpha.600"
          zIndex="25"
          onClick={() => setMenu(false)}
        />
      )}
      <Box
        ml={{ base: 0, lg: collapsed ? "76px" : "238px" }}
        transition="margin-left .2s"
        minW="0"
      >
        <Flex
          as="header"
          h="76px"
          px={{ base: 5, md: 9 }}
          align="center"
          justify="space-between"
          borderBottom="1px solid"
          borderColor="line"
          bg="panel"
          gap="3"
        >
          <Flex align="center" gap="3">
            <Button
              display={{ base: "flex", lg: "none" }}
              variant="ghost"
              size="sm"
              aria-label="Toggle navigation"
              aria-expanded={menu}
              aria-controls="workspace-sidebar"
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X size={19} /> : <Menu size={19} />}
            </Button>
            <Text
              color="muted"
              fontSize="xs"
              display={{ base: "none", md: "block" }}
            >
              Workspace{" "}
              <span style={{ margin: "0 12px", opacity: 0.4 }}>/</span>
              <span style={{ color: "var(--chakra-colors-ink)" }}>
                {page.startsWith("job/")
                  ? "Job dossier"
                  : nav.find((n) => n[0] === page)?.[1] || "Import jobs"}
              </span>
            </Text>
          </Flex>
          <Flex gap="2" align="center">
            <Box display={{ base: "none", md: "block" }} mr="3">
              <Tag tone="gray">
                {config.auth_mode === "local"
                  ? "Local development"
                  : "Private workspace"}
              </Tag>
            </Box>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Refresh data"
              onClick={refresh}
            >
              <RefreshCw size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Toggle color mode"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
            >
              {resolvedTheme === "dark" ? (
                <Sun size={17} />
              ) : (
                <Moon size={17} />
              )}
            </Button>
            <Button colorPalette="green" size="sm" onClick={() => setAdd(true)}>
              <Plus size={16} />
              Add job
            </Button>
          </Flex>
        </Flex>
        <Box as="main" maxW="1640px" mx="auto" p={{ base: 5, md: 9, xl: 10 }}>
          {content}
        </Box>
      </Box>
      {toast && (
        <Box
          role="status"
          position="fixed"
          bottom="6"
          right="6"
          zIndex="1500"
          bg="#173f2c"
          color="white"
          px="6"
          py="4"
          borderRadius="lg"
          shadow="lg"
        >
          {toast}
        </Box>
      )}
      <Modal
        title="Add a new opportunity"
        open={add}
        onClose={() => setAdd(false)}
      >
        <Form
          fields={[
            field("company", "Company", { required: true }),
            field("title", "Job title", { required: true }),
            field("location", "Location"),
            field("work_mode", "Work mode", {
              options: ["", "Hybrid", "Remote", "On-site"],
            }),
            field("source", "Source", { default: "Manual" }),
            field("source_url", "Posting URL", { type: "url" }),
            field("closing_date", "Closing date", { type: "date" }),
            field("description_raw", "Full job description", {
              type: "textarea",
              rows: 7,
              required: true,
            }),
          ]}
          submit="Add & assess job"
          onSubmit={async (v) => {
            const d = await api("/api/jobs", {
              ...v,
              source_url: v.source_url || null,
            });
            setAdd(false);
            saved("Job added and assessed");
            open(d.id);
          }}
        />
      </Modal>
    </Box>
  );
}
function Dashboard({ revision, open, go }) {
  const jobs = useData("/api/jobs", revision),
    an = useData("/api/analytics", revision),
    st = useData("/api/v3/strategy", revision),
    rem = useData("/api/v3/reminders", revision);
  return (
    <>
      <Title
        title="Make your next move."
        subtitle="A little clarity. A focused plan. Work that fits you."
        action={
          <Button variant="outline" size="sm" onClick={() => go("strategy")}>
            Your strategy
            <ArrowRight size={15} />
          </Button>
        }
      />
      <Load {...jobs}>
        {(js) => (
          <>
            <Box
              bg="#e5eddc"
              _dark={{ bg: "#263c2c" }}
              borderRadius="xl"
              p={{ base: 6, md: 8 }}
              mb="6"
              position="relative"
              overflow="hidden"
            >
              <Box maxW="540px" position="relative" zIndex="1">
                <Text
                  fontSize="10px"
                  letterSpacing=".15em"
                  color="accent"
                  fontWeight="700"
                  mb="3"
                >
                  PURPOSEFUL PROGRESS
                </Text>
                <Heading
                  fontSize={{ base: "24px", md: "29px" }}
                  letterSpacing="-.7px"
                  mb="3"
                >
                  Good opportunities deserve
                  <br />
                  your best evidence.
                </Heading>
                <Text fontSize="sm" color="muted" lineHeight="1.7">
                  You have {js.filter((j) => j.career_fit >= 80).length} strong
                  matches in your workspace. Start with the roles that connect
                  to what you’ve already accomplished.
                </Text>
                <Button
                  mt="5"
                  colorPalette="green"
                  size="sm"
                  onClick={() => go("jobs")}
                >
                  Explore your matches
                  <ArrowRight size={15} />
                </Button>
              </Box>
              <Box
                position="absolute"
                right="-38px"
                top="-40px"
                w="320px"
                h="320px"
                opacity=".45"
                display={{ base: "none", xl: "block" }}
              >
                <svg viewBox="0 0 320 320" fill="none">
                  <circle cx="160" cy="160" r="146" stroke="#83a06b" />
                  <circle cx="160" cy="160" r="105" stroke="#83a06b" />
                  <circle cx="160" cy="160" r="64" stroke="#83a06b" />
                  <path
                    d="M70 250L160 160l96-61M160 160l35 98"
                    stroke="#6f9851"
                  />
                  <circle cx="160" cy="160" r="14" fill="#4e7944" />
                  <circle cx="256" cy="99" r="9" fill="#4e7944" />
                  <circle cx="195" cy="258" r="7" fill="#4e7944" />
                </svg>
              </Box>
            </Box>
            <SimpleGrid columns={{ base: 2, xl: 4 }} gap="4" mb="8">
              {[
                ["Opportunities", js.length, "In your workspace"],
                [
                  "Strong matches",
                  js.filter((j) => j.career_fit >= 80).length,
                  "80%+ career fit",
                ],
                [
                  "Applications",
                  an.data?.applied ?? "—",
                  "Applied and progressing",
                ],
                [
                  "Interviews",
                  an.data?.interviews ?? "—",
                  "Phone screen or further",
                ],
              ].map(([label, n, note], i) => (
                <Panel key={label} p="5">
                  <Flex justify="space-between">
                    <Text color="muted" fontSize="xs">
                      {label}
                    </Text>
                    <Text color="accent" fontSize="xs">
                      0{i + 1}
                    </Text>
                  </Flex>
                  <Text
                    fontSize="32px"
                    fontWeight="600"
                    letterSpacing="-1px"
                    mt="3"
                  >
                    {n}
                  </Text>
                  <Text color="muted" fontSize="11px" mt="1">
                    {note}
                  </Text>
                </Panel>
              ))}
            </SimpleGrid>
            <SimpleGrid
              columns={{ base: 1, xl: 2 }}
              templateColumns={{ xl: "minmax(0,1.65fr) minmax(0,1fr)" }}
              gap="6"
            >
              <Box>
                <Section
                  title="Your strongest opportunities"
                  subtitle="Ranked by evidence-backed priority"
                  action={
                    <Button
                      size="xs"
                      variant="plain"
                      onClick={() => go("jobs")}
                    >
                      View all <ArrowRight size={14} />
                    </Button>
                  }
                />
                <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
                  {js.slice(0, 4).map((j) => (
                    <JobCard key={j.id} job={j} open={open} />
                  ))}
                </SimpleGrid>
                {!js.length && (
                  <Empty>Add a job to discover your strongest matches.</Empty>
                )}
              </Box>
              <Panel>
                <Section
                  title="A focused to-do list"
                  subtitle="Small steps that move things forward"
                />
                <Load {...st}>
                  {(s) => (
                    <Stack gap="5">
                      {[
                        ...s.apply_now
                          .slice(0, 3)
                          .map((j) => ({ ...j, label: "Prepare application" })),
                        ...s.follow_ups
                          .slice(0, 2)
                          .map((j) => ({ ...j, label: "Follow up" })),
                      ].map((j, i) => (
                        <Flex key={j.id} gap="3" align="start">
                          <Flex
                            flexShrink="0"
                            w="27px"
                            h="27px"
                            borderRadius="full"
                            bg="soft"
                            color="accent"
                            fontSize="xs"
                            align="center"
                            justify="center"
                          >
                            {i + 1}
                          </Flex>
                          <Box flex="1">
                            <Button
                              variant="plain"
                              h="auto"
                              p="0"
                              fontSize="sm"
                              onClick={() => open(j.id)}
                            >
                              {j.label}
                            </Button>
                            <Text color="muted" fontSize="xs" mt="1">
                              {j.company} ·{" "}
                              {j.label === "Follow up"
                                ? j.next_action
                                : j.title}
                            </Text>
                          </Box>
                        </Flex>
                      ))}
                      {!s.apply_now.length && !s.follow_ups.length && (
                        <Empty>Track a role to build your action list.</Empty>
                      )}
                      <Box mt="3">
                        <Notice>
                          <Text fontWeight="600" mb="1">
                            Your current direction
                          </Text>
                          <Text>{s.role_focus}</Text>
                          <Text fontSize="xs" color="muted" mt="2">
                            {s.confidence} · Based on stored evidence and
                            application history.
                          </Text>
                        </Notice>
                      </Box>
                    </Stack>
                  )}
                </Load>
              </Panel>
            </SimpleGrid>
            {rem.data?.items.length > 0 && (
              <Panel mt="6">
                <Section title="Dates to keep in view" />
                {rem.data.items.map((r) => (
                  <Flex key={r.id} justify="space-between" gap="3" py="2">
                    <Button
                      variant="plain"
                      size="sm"
                      onClick={() => open(r.job_id)}
                    >
                      {r.company} · {r.title}
                    </Button>
                    <Text fontSize="sm" color="muted">
                      {r.follow_up_date || r.closing_date}
                    </Text>
                  </Flex>
                ))}
              </Panel>
            )}
          </>
        )}
      </Load>
    </>
  );
}

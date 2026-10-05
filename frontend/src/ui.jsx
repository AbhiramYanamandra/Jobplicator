import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  Text,
  Badge,
  Input,
  Textarea,
  NativeSelect,
  Dialog,
  Portal,
  Stack,
  Spinner,
} from "@chakra-ui/react";
import { ArrowUpRight, Search, X } from "lucide-react";
export const statuses = [
  "saved",
  "shortlisted",
  "tailoring",
  "ready",
  "applied",
  "oa",
  "phone screen",
  "technical",
  "final",
  "offer",
  "rejected",
  "withdrawn",
];
export const sources = [
  "General practice",
  "Company-tagged prep",
  "Real interview",
];
let accessToken = null;
export function setAccessToken(value) {
  accessToken = value;
}
async function request(path, body) {
  const r = await fetch(
    path,
    body === undefined
      ? {
          headers: accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : {},
        }
      : {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify(body),
        },
  );
  if (!r.ok) {
    let message = await r.text();
    try {
      const j = JSON.parse(message);
      message =
        typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {}
    throw new Error(message || `Request failed (${r.status})`);
  }
  return r;
}
export async function api(path, body) {
  return (await request(path, body)).json();
}
// POST a body and save the binary response (e.g. a .docx) as a file.
export async function downloadFrom(path, body, fallbackName) {
  const r = await request(path, body);
  const name =
    /filename="([^"]+)"/.exec(
      r.headers.get("Content-Disposition") || "",
    )?.[1] || fallbackName;
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function useData(path, revision = 0) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    if (!path) return;
    api(path)
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [path, revision]);
  return { data, error };
}
export function Load({ data, error, children }) {
  if (error)
    return (
      <Notice tone="red">
        Could not load this page: {error}. Use Refresh to retry.
      </Notice>
    );
  if (data === null)
    return (
      <Flex p="16" justify="center" gap="3" role="status">
        <Spinner />
        Loading your workspace…
      </Flex>
    );
  return children(data);
}
export const Panel = ({ children, ...props }) => (
  <Box
    bg="panel"
    border="1px solid"
    borderColor="line"
    borderRadius="xl"
    p={{ base: 5, md: 6 }}
    {...props}
  >
    {children}
  </Box>
);
export function Title({ title, subtitle, action }) {
  return (
    <Flex justify="space-between" align="start" gap="4" mb="7" wrap="wrap">
      <Box>
        <Heading
          as="h1"
          fontSize={{ base: "27px", md: "34px" }}
          letterSpacing="-1.2px"
          fontWeight="650"
        >
          {title}
        </Heading>
        <Text color="muted" mt="2" fontSize="sm">
          {subtitle}
        </Text>
      </Box>
      {action}
    </Flex>
  );
}
export function Section({ title, subtitle, action }) {
  return (
    <Flex justify="space-between" align="center" gap="3" mb="5">
      <Box>
        <Heading size="md" fontWeight="600">
          {title}
        </Heading>
        {subtitle && (
          <Text color="muted" fontSize="xs" mt="1">
            {subtitle}
          </Text>
        )}
      </Box>
      {action}
    </Flex>
  );
}
export function Tag({ children, tone = "green" }) {
  return (
    <Badge
      colorPalette={tone}
      variant="subtle"
      borderRadius="md"
      px="2"
      py=".5"
      fontWeight="500"
      textTransform="none"
    >
      {children}
    </Badge>
  );
}
export function Notice({ children, tone = "green" }) {
  return (
    <Box
      role={tone === "red" ? "alert" : undefined}
      bg={tone === "red" ? "red.subtle" : "soft"}
      color={tone === "red" ? "red.fg" : "ink"}
      borderRadius="lg"
      p="4"
      fontSize="sm"
      lineHeight="1.7"
    >
      {children}
    </Box>
  );
}
export function Empty({
  children = "No records yet. Add your first one to get started.",
}) {
  return (
    <Box py="12" textAlign="center" color="muted">
      {children}
    </Box>
  );
}
export function Select({ label, options, ...props }) {
  return (
    <NativeSelect.Root size="sm" minW="150px">
      <NativeSelect.Field
        aria-label={label}
        borderColor="line"
        bg="panel"
        {...props}
      >
        {options.map((o) => (
          <option
            key={typeof o === "string" ? o : o.value}
            value={typeof o === "string" ? o : o.value}
          >
            {typeof o === "string" ? o : o.label}
          </option>
        ))}
      </NativeSelect.Field>
      <NativeSelect.Indicator />
    </NativeSelect.Root>
  );
}
export function SearchBox({ value, onChange, placeholder = "Search…" }) {
  return (
    <Flex
      align="center"
      gap="2"
      bg="panel"
      border="1px solid"
      borderColor="line"
      borderRadius="lg"
      px="3"
      flex="1"
      minW="190px"
    >
      <Search size={16} />
      <Input
        border="0"
        px="0"
        size="sm"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Flex>
  );
}
export function Meter({ value, label, note, tone = "green" }) {
  return (
    <Box>
      <Flex justify="space-between" fontSize="xs" mb="2">
        <Text color="muted">{label}</Text>
        <Text fontWeight="600">{note ?? `${Math.round(value || 0)}%`}</Text>
      </Flex>
      <Box h="5px" bg="soft" borderRadius="full">
        <Box
          h="full"
          w={`${Math.max(0, Math.min(100, value || 0))}%`}
          bg={tone === "green" ? "accent" : "orange.400"}
          borderRadius="full"
        />
      </Box>
    </Box>
  );
}
export function JobCard({ job: j, open }) {
  return (
    <Panel
      p="5"
      transition="all .18s"
      _hover={{
        borderColor: "accent",
        transform: "translateY(-2px)",
        shadow: "sm",
      }}
    >
      <Flex align="start" gap="3">
        <Flex
          bg="soft"
          color="accent"
          w="40px"
          h="40px"
          borderRadius="lg"
          align="center"
          justify="center"
          fontWeight="700"
          flexShrink="0"
        >
          {j.company?.slice(0, 2).toUpperCase()}
        </Flex>
        <Box flex="1" minW="0">
          <Text color="muted" fontSize="xs" mb="1">
            {j.company}
          </Text>
          <Button
            variant="plain"
            display="block"
            textAlign="left"
            height="auto"
            whiteSpace="normal"
            p="0"
            fontSize="sm"
            fontWeight="600"
            onClick={() => open(j.id)}
          >
            {j.title}
          </Button>
        </Box>
        <ArrowUpRight size={16} color="#799382" />
      </Flex>
      <Text color="muted" fontSize="xs" mt="3">
        {j.location || "Location not specified"}
        {j.work_mode ? ` · ${j.work_mode}` : ""}
      </Text>
      <Flex gap="2" my="4" wrap="wrap">
        <Tag tone="gray">{j.role_family || "Other"}</Tag>
        <Tag tone={j.application_status ? "green" : "gray"}>
          {j.application_status || j.status || "discovered"}
        </Tag>
      </Flex>
      <Meter value={j.career_fit} label="Career fit" />
      <Flex justify="space-between" mt="4" fontSize="xs" color="muted">
        <Text>Resume {Math.round(j.resume_fit || 0)}%</Text>
        <Text>Priority {Math.round(j.priority_score || 0)}</Text>
      </Flex>
    </Panel>
  );
}
export function DataTable({ headers, children }) {
  return (
    <Box overflowX="auto">
      <table className="data-table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th scope="col" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </Box>
  );
}
export function Modal({ title, open, onClose, children }) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => !e.open && onClose()}
      size="lg"
      scrollBehavior="inside"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg="panel" color="ink" mx="4">
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body pb="6">{children}</Dialog.Body>
            <Dialog.CloseTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                position="absolute"
                top="3"
                right="3"
                aria-label="Close"
              >
                <X size={18} />
              </Button>
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
export function Form({
  fields,
  initial = {},
  onSubmit,
  submit = "Save",
  children,
}) {
  const [values, setValues] = useState(() => ({
      ...Object.fromEntries(
        fields.map((f) => [
          f.key,
          f.default ?? (f.options ? f.options[0] : ""),
        ]),
      ),
      ...initial,
    })),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await onSubmit(
            Object.fromEntries(fields.map((f) => [f.key, values[f.key]])),
          );
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Stack gap="4">
        {fields.map((f) => (
          <Box key={f.key}>
            <Text
              as="label"
              htmlFor={`field-${f.key}`}
              fontSize="sm"
              fontWeight="500"
              mb="1.5"
              display="block"
            >
              {f.label}
              {f.required ? " *" : ""}
            </Text>
            {f.options ? (
              <Select
                id={`field-${f.key}`}
                label={f.label}
                options={f.options}
                value={values[f.key] ?? ""}
                onChange={(e) =>
                  setValues({ ...values, [f.key]: e.target.value })
                }
              />
            ) : f.type === "textarea" ? (
              <Textarea
                id={`field-${f.key}`}
                rows={f.rows || 4}
                value={values[f.key] ?? ""}
                required={f.required}
                onChange={(e) =>
                  setValues({ ...values, [f.key]: e.target.value })
                }
              />
            ) : (
              <Input
                id={`field-${f.key}`}
                type={f.type || "text"}
                min={f.min}
                max={f.max}
                required={f.required}
                value={values[f.key] ?? ""}
                onChange={(e) =>
                  setValues({ ...values, [f.key]: e.target.value })
                }
              />
            )}
            {f.help && (
              <Text fontSize="xs" color="muted" mt="1">
                {f.help}
              </Text>
            )}
          </Box>
        ))}
        {children}
        {error && <Notice tone="red">{error}</Notice>}
        <Button
          type="submit"
          colorPalette="green"
          loading={busy}
          alignSelf="start"
        >
          {submit}
        </Button>
      </Stack>
    </form>
  );
}
export const field = (key, label, extra = {}) => ({ key, label, ...extra });
export function download(name, content, type = "application/json") {
  const u = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
export const safeUrl = (value) => {
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) ? u.href : undefined;
  } catch {
    return undefined;
  }
};

import React, { useState } from "react";
import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { RefreshCw, Trash2 } from "lucide-react";
import {
  api,
  useData,
  Load,
  Panel,
  Section,
  Tag,
  Notice,
  Empty,
  DataTable,
  Form,
  field,
} from "./ui";

export function CompanyBoards({ revision, saved }) {
  const d = useData("/api/boards", revision);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const act = async (fn, message) => {
    setBusy(true);
    setError("");
    try {
      const r = await fn();
      saved(typeof message === "function" ? message(r) : message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel mt="6">
      <Section
        title="Company job boards"
        subtitle="Greenhouse and Lever boards checked automatically once a day when you open the dashboard. Only graduate, junior and intern technical roles in Australia, Singapore or remote are imported."
        action={
          <Button
            size="sm"
            colorPalette="green"
            disabled={busy}
            onClick={() =>
              act(
                () => api("/api/boards/sync", {}),
                (r) => `${r.created ?? 0} new jobs from company boards`,
              )
            }
          >
            <RefreshCw size={15} />
            Sync now
          </Button>
        }
      />
      {error && <Notice tone="red">{error}</Notice>}
      <Load {...d}>
        {(d) => (
          <>
            <Text fontSize="xs" color="muted" mb="3">
              Last synced:{" "}
              {d.last_sync
                ? d.last_sync.slice(0, 16).replace("T", " ")
                : "never"}
            </Text>
            {d.boards.length ? (
              <DataTable headers={["Company", "Board", "Last result", ""]}>
                {d.boards.map((b) => (
                  <tr key={b.id}>
                    <td>{b.label}</td>
                    <td>
                      <Tag tone="gray">
                        {b.adapter} · {b.token}
                      </Tag>
                    </td>
                    <td>
                      <Text
                        fontSize="xs"
                        color={
                          b.last_result?.startsWith("Error")
                            ? "red.fg"
                            : "muted"
                        }
                      >
                        {b.last_result || "Not synced yet"}
                      </Text>
                    </td>
                    <td>
                      <Button
                        size="xs"
                        variant="ghost"
                        aria-label={`Remove ${b.label}`}
                        disabled={busy}
                        onClick={() =>
                          act(
                            () => api(`/api/boards/${b.id}/delete`, {}),
                            `${b.label} removed`,
                          )
                        }
                      >
                        <Trash2 size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </DataTable>
            ) : (
              <Empty>
                No company boards yet. Add suggested companies or your own
                below.
              </Empty>
            )}
            {d.suggested.length > 0 && (
              <Flex gap="2" align="center" wrap="wrap" mt="4">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    act(
                      () => api("/api/boards", { boards: d.suggested }),
                      "Suggested companies added",
                    )
                  }
                >
                  Add suggested companies
                </Button>
                <Text fontSize="xs" color="muted">
                  {d.suggested.map((s) => s.label).join(", ")}
                </Text>
              </Flex>
            )}
            <Box mt="5" maxW="520px">
              <Form
                fields={[
                  field("adapter", "Board type", {
                    options: ["greenhouse", "lever"],
                  }),
                  field("token", "Board token", {
                    required: true,
                    help: "The name in the company's job URL: job-boards.greenhouse.io/<token> or jobs.lever.co/<token>.",
                  }),
                  field("label", "Company name"),
                ]}
                submit="Add board"
                onSubmit={(v) =>
                  act(
                    () => api("/api/boards", v),
                    `${v.label || v.token} added`,
                  )
                }
              />
            </Box>
          </>
        )}
      </Load>
    </Panel>
  );
}

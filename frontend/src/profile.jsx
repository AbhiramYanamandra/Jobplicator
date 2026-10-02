import React, { useRef, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Input,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import {
  api,
  useData,
  Load,
  Title,
  Panel,
  Section,
  Notice,
  download,
} from "./ui";
export default function Profile({ revision, saved }) {
  const d = useData("/api/profile", revision),
    file = useRef(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState(null);
  async function store(value) {
    setBusy(true);
    setError("");
    try {
      await api("/api/profile", value);
      setPending(null);
      saved("Career profile saved");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Title
        title="Your profile. Your evidence."
        subtitle="Private career data belongs to your account and stays out of the source repository."
      />
      {error && (
        <Box mb="4">
          <Notice tone="red">{error}</Notice>
        </Box>
      )}
      <Load {...d}>
        {(profile) => (
          <Stack gap="5">
            <Panel>
              <Section
                title="Career identity"
                subtitle="Used in your workspace and generated cover-letter drafts."
              />
              <Identity
                key={revision}
                profile={profile}
                onSave={store}
                busy={busy}
              />
            </Panel>
            <Panel>
              <Section title="Import or back up career evidence" />
              <Text color="muted" fontSize="sm" mb="4">
                Import your existing career_evidence.json file. Review the
                counts before replacing your account's profile. Jobs and
                applications are kept separately.
              </Text>
              <Flex gap="3" wrap="wrap">
                <Button variant="outline" onClick={() => file.current.click()}>
                  Choose profile JSON
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    download(
                      "career-evidence-backup.json",
                      JSON.stringify(profile, null, 2),
                    )
                  }
                >
                  Export current profile
                </Button>
              </Flex>
              <input
                type="file"
                accept="application/json,.json"
                hidden
                ref={file}
                onChange={async (e) => {
                  try {
                    const f = e.target.files[0];
                    if (!f) return;
                    if (f.size > 1000000)
                      throw new Error(
                        "Profile file must be smaller than 1 MB.",
                      );
                    const p = JSON.parse(await f.text());
                    if (!Array.isArray(p.evidence) || !Array.isArray(p.profile))
                      throw new Error(
                        "Choose a career profile JSON with profile and evidence arrays.",
                      );
                    setPending(p);
                    setError("");
                  } catch (e) {
                    setError(e.message);
                  }
                  e.target.value = "";
                }}
              />
              {pending && (
                <Box mt="5">
                  <Notice>
                    Selected profile: {pending.evidence.length} evidence
                    records, {pending.experiences?.length || 0} experiences,{" "}
                    {pending.projects?.length || 0} projects. Importing replaces
                    the current career profile. Export a backup first if needed.
                  </Notice>
                  <Flex gap="3" mt="4">
                    <Button
                      colorPalette="green"
                      loading={busy}
                      onClick={() => store(pending)}
                    >
                      Import selected profile
                    </Button>
                    <Button variant="ghost" onClick={() => setPending(null)}>
                      Cancel
                    </Button>
                  </Flex>
                </Box>
              )}
              <Text color="muted" fontSize="xs" mt="4">
                After changing evidence, use Reassess in a job dossier to update
                its stored fit scores. Existing resume drafts are edited
                separately in Resume Studio.
              </Text>
            </Panel>
          </Stack>
        )}
      </Load>
    </>
  );
}
function Identity({ profile, onSave, busy }) {
  const fields = [
    "Name",
    "Location",
    "Degree",
    "Work rights",
    "Primary positioning",
  ];
  const [values, setValues] = useState(
    Object.fromEntries(
      fields.map((f) => [
        f,
        profile.profile.find((r) => r.Field === f)?.Value || "",
      ]),
    ),
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          ...profile,
          profile: [
            ...profile.profile.filter((r) => !fields.includes(r.Field)),
            ...fields.map((Field) => ({
              Field,
              Value: values[Field],
              "Status / Notes": "User provided",
            })),
          ],
        });
      }}
    >
      <Stack gap="4">
        {fields.map((f) => (
          <Box key={f}>
            <Text as="label" htmlFor={"identity-" + f} fontSize="sm">
              {f}
            </Text>
            <Input
              id={"identity-" + f}
              value={values[f]}
              onChange={(e) => setValues({ ...values, [f]: e.target.value })}
            />
          </Box>
        ))}
        <Button
          type="submit"
          colorPalette="green"
          alignSelf="start"
          loading={busy}
        >
          Save identity
        </Button>
      </Stack>
    </form>
  );
}

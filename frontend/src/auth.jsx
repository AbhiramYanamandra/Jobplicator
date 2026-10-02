import React, { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Box,
  Button,
  Flex,
  Heading,
  Input,
  Stack,
  Text,
  Spinner,
} from "@chakra-ui/react";
import { Leaf } from "lucide-react";
import { api, Notice, Panel, setAccessToken } from "./ui";
const LOCAL_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "local@example.test",
};
const AuthContext = createContext({
  user: LOCAL_USER,
  config: { auth_mode: "local" },
  signOut: async () => {},
});
export const useAuth = () => useContext(AuthContext);
function initialPasswordMode() {
  const hashType = new URLSearchParams(window.location.hash.slice(1)).get(
    "type",
  );
  const queryType = new URLSearchParams(window.location.search).get("type");
  return hashType === "invite" || queryType === "invite" ? "invite" : null;
}
export function AuthGate({ children }) {
  const [config, setConfig] = useState(null),
    [client, setClient] = useState(null),
    [user, setUser] = useState(null),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [passwordMode, setPasswordMode] = useState(initialPasswordMode);
  useEffect(() => {
    let active = true,
      unsubscribe;
    async function init() {
      try {
        const c = await api("/api/config");
        if (!active) return;
        setConfig(c);
        if (c.auth_mode === "local") {
          const u = await api("/api/me");
          if (active) {
            setUser(u);
            setReady(true);
          }
          return;
        }
        const supabase = createClient(
          c.supabase_url,
          c.supabase_publishable_key,
          {
            auth: {
              persistSession: true,
              autoRefreshToken: true,
              detectSessionInUrl: true,
            },
          },
        );
        setClient(supabase);
        let generation = 0;
        async function applySession(session) {
          const current = ++generation;
          if (!active) return;
          setUser((previous) =>
            previous?.id === session?.user?.id ? previous : null,
          );
          setAccessToken(session?.access_token || null);
          setError("");
          if (!session) {
            if (active) {
              setUser(null);
              setReady(true);
            }
            return;
          }
          try {
            const verified = await api("/api/me");
            if (active && current === generation) {
              setUser(verified);
              setReady(true);
            }
          } catch (e) {
            if (active && current === generation) {
              setUser(null);
              setError(e.message);
              setReady(true);
            }
          }
        }
        const { data } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === "PASSWORD_RECOVERY" && active)
            setPasswordMode("recovery");
          if (event === "SIGNED_OUT" && active) setPasswordMode(null);
          queueMicrotask(() => {
            if (active) applySession(session);
          });
        });
        unsubscribe = () => data.subscription.unsubscribe();
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error) throw error;
        await applySession(session);
      } catch (e) {
        if (active) {
          setError(e.message);
          setReady(true);
        }
      }
    }
    init();
    return () => {
      active = false;
      unsubscribe?.();
      setAccessToken(null);
    };
  }, []);
  const signOut = async () => {
    if (client) {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    }
    setAccessToken(null);
    setUser(null);
    setPasswordMode(null);
    location.hash = "dashboard";
  };
  if (!ready)
    return (
      <Flex minH="100vh" align="center" justify="center" gap="3">
        <Spinner />
        Opening your workspace…
      </Flex>
    );
  if (!user || passwordMode)
    return (
      <Login
        client={client}
        passwordMode={passwordMode}
        done={() => setPasswordMode(null)}
        error={error}
        clearError={() => setError("")}
      />
    );
  return (
    <AuthContext.Provider value={{ user, config, signOut }}>
      <React.Fragment key={user.id}>{children}</React.Fragment>
    </AuthContext.Provider>
  );
}
function Login({ client, passwordMode, done, error, clearError }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [failure, setFailure] = useState("");
  const run = async (fn) => {
    setBusy(true);
    setFailure("");
    setMessage("");
    clearError();
    try {
      await fn();
    } catch (e) {
      setFailure(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Flex minH="100vh" align="center" justify="center" p="5">
      <Box w="full" maxW="430px">
        <Flex align="center" gap="3" mb="7">
          <Leaf color="#438d61" />
          <Heading size="xl">jobplicator.</Heading>
        </Flex>
        <Panel>
          <Heading size="lg" mb="2">
            {passwordMode === "invite"
              ? "Choose your password"
              : passwordMode === "recovery"
                ? "Choose a new password"
                : "Your next chapter, securely saved."}
          </Heading>
          <Text color="muted" fontSize="sm" mb="6">
            {passwordMode === "invite"
              ? "Set a password to finish accepting your invitation."
              : passwordMode === "recovery"
                ? "Update your password to continue."
                : "Sign in with your invited account to access your private workspace."}
          </Text>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                if (!client)
                  throw new Error(
                    "Authentication is not configured. Check the server settings.",
                  );
                if (passwordMode) {
                  const { error } = await client.auth.updateUser({ password });
                  if (error) throw error;
                  window.history.replaceState(
                    window.history.state,
                    "",
                    `${window.location.pathname}#dashboard`,
                  );
                  done();
                } else {
                  const { error } = await client.auth.signInWithPassword({
                    email,
                    password,
                  });
                  if (error) throw error;
                }
              });
            }}
          >
            <Stack gap="4">
              {!passwordMode && (
                <Box>
                  <Text as="label" htmlFor="login-email" fontSize="sm">
                    Email address
                  </Text>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Box>
              )}
              <Box>
                <Text as="label" htmlFor="login-password" fontSize="sm">
                  {passwordMode ? "New password" : "Password"}
                </Text>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete={
                    passwordMode ? "new-password" : "current-password"
                  }
                  minLength={passwordMode ? 12 : undefined}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Box>
              {(failure || error) && (
                <Notice tone="red">{failure || error}</Notice>
              )}
              {message && <Notice>{message}</Notice>}
              <Button
                type="submit"
                colorPalette="green"
                loading={busy}
                disabled={!client}
              >
                {passwordMode === "invite"
                  ? "Set password"
                  : passwordMode === "recovery"
                    ? "Update password"
                    : "Sign in"}
              </Button>
            </Stack>
          </form>
          {!passwordMode && (
            <Button
              variant="plain"
              size="sm"
              mt="4"
              disabled={!client || !email || busy}
              onClick={() =>
                run(async () => {
                  const { error } = await client.auth.resetPasswordForEmail(
                    email,
                    { redirectTo: location.origin },
                  );
                  if (error) throw error;
                  setMessage(
                    "If that account exists, a password reset link will arrive by email.",
                  );
                })
              }
            >
              Forgot your password?
            </Button>
          )}
        </Panel>
      </Box>
    </Flex>
  );
}

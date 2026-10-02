import React from "react";
import {
  render,
  screen,
  waitFor,
  cleanup,
  act,
  fireEvent,
} from "@testing-library/react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "./theme";
const auth = vi.hoisted(() => ({
  callback: null,
  session: null,
  unsubscribe: vi.fn(),
  updateUser: vi.fn(async () => ({ error: null })),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: (callback) => {
        auth.callback = callback;
        return { data: { subscription: { unsubscribe: auth.unsubscribe } } };
      },
      getSession: async () => ({ data: { session: auth.session } }),
      signOut: async () => ({ error: null }),
      updateUser: auth.updateUser,
    },
  }),
}));
import { AuthGate, useAuth } from "./auth";
function Content() {
  const { user } = useAuth();
  return <p>Workspace for {user.email}</p>;
}
const show = () =>
  render(
    <ChakraProvider value={system}>
      <AuthGate>
        <Content />
      </AuthGate>
    </ChakraProvider>,
  );
beforeEach(() => {
  auth.session = null;
  auth.callback = null;
  auth.updateUser.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path, options) => {
      if (path === "/api/config")
        return {
          ok: true,
          json: async () => ({
            auth_mode: "supabase",
            supabase_url: "https://example.supabase.co",
            supabase_publishable_key: "sb_publishable_test",
          }),
        };
      if (path === "/api/me") {
        if (options.headers.Authorization === "Bearer allowed")
          return {
            ok: true,
            json: async () => ({ id: "alice", email: "alice@example.test" }),
          };
        return {
          ok: false,
          text: async () =>
            JSON.stringify({ detail: "This account has not been invited" }),
        };
      }
      throw new Error(path);
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});
it("requires sign-in before rendering private content", async () => {
  show();
  await screen.findByRole("button", { name: "Sign in" });
  expect(screen.queryByText(/Workspace for/)).not.toBeInTheDocument();
  expect(fetch.mock.calls.some(([p]) => p === "/api/me")).toBe(false);
});
it("checks the bearer session with the backend and clears private content on sign-out", async () => {
  auth.session = { access_token: "allowed", user: { id: "alice" } };
  show();
  await screen.findByText("Workspace for alice@example.test");
  expect(fetch).toHaveBeenCalledWith("/api/me", {
    headers: { Authorization: "Bearer allowed" },
  });
  await act(async () => auth.callback("SIGNED_OUT", null));
  await screen.findByRole("button", { name: "Sign in" });
  expect(screen.queryByText(/Workspace for/)).not.toBeInTheDocument();
});
it("refuses a valid-looking session if the backend rejects the account", async () => {
  auth.session = { access_token: "not-allowed", user: { id: "bob" } };
  show();
  await screen.findByText("This account has not been invited");
  expect(screen.queryByText(/Workspace for/)).not.toBeInTheDocument();
});
it("asks invited users to set a password before opening their workspace", async () => {
  window.history.replaceState(
    {},
    "",
    "/#access_token=fake&refresh_token=fake&type=invite",
  );
  auth.session = { access_token: "allowed", user: { id: "alice" } };
  show();
  await screen.findByRole("button", { name: "Set password" });
  expect(screen.queryByText(/Workspace for/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: "a-long-new-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Set password" }));
  await waitFor(() =>
    expect(auth.updateUser).toHaveBeenCalledWith({
      password: "a-long-new-password",
    }),
  );
  await screen.findByText("Workspace for alice@example.test");
  expect(window.location.hash).toBe("#dashboard");
});

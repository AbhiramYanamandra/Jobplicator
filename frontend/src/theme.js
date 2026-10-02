import { createSystem, defaultConfig } from "@chakra-ui/react";
export const system = createSystem(defaultConfig, {
  theme: {
    tokens: {
      fonts: {
        heading: { value: "Inter, ui-sans-serif, system-ui, sans-serif" },
        body: { value: "Inter, ui-sans-serif, system-ui, sans-serif" },
      },
    },
    semanticTokens: {
      colors: {
        canvas: { value: { base: "#f5f6f2", _dark: "#111a17" } },
        panel: { value: { base: "#ffffff", _dark: "#19251f" } },
        ink: { value: { base: "#1b3028", _dark: "#edf4ef" } },
        muted: { value: { base: "#6a7971", _dark: "#a4b5aa" } },
        line: { value: { base: "#e2e8e1", _dark: "#304238" } },
        accent: { value: { base: "#287653", _dark: "#89d6a8" } },
        soft: { value: { base: "#eaf2e9", _dark: "#263d30" } },
      },
    },
  },
  globalCss: {
    body: { bg: "canvas", color: "ink" },
    "::selection": { bg: "#bfdfb8" },
    button: { cursor: "pointer" },
  },
});

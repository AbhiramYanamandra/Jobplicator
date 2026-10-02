import React from "react";
import { createRoot } from "react-dom/client";
import { ChakraProvider } from "@chakra-ui/react";
import { ThemeProvider } from "next-themes";
import App from "./App";
import { AuthGate } from "./auth";
import "./styles.css";
import { system } from "./theme";
createRoot(document.getElementById("root")).render(
  <ChakraProvider value={system}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthGate>
        <App />
      </AuthGate>
    </ThemeProvider>
  </ChakraProvider>,
);

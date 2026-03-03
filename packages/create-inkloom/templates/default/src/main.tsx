import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./app";
import { DataProvider } from "./data-provider";
import { ThemeProvider } from "./theme-provider";
import { SearchProvider } from "./search-provider";
import "./globals.css";

// Disable browser scroll restoration — managed by DocsLayout
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

const root = document.getElementById("root")!;
createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <DataProvider>
        <ThemeProvider>
          <SearchProvider>
            <App />
          </SearchProvider>
        </ThemeProvider>
      </DataProvider>
    </BrowserRouter>
  </StrictMode>
);

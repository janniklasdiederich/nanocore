import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// Patch DefaultColorStyle before any board store loads custom-* shape colors
import "./tldraw/customColors";
// Extra fill/dash options (true solid + dash none) before the editor mounts
import "./tldraw/styleExtras";
import { AuthProvider } from "./auth";
import { I18nProvider } from "./i18n";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>,
);

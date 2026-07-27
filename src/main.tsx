import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { getPublicPreviewSlug, PublicPreviewPortal } from "./components/PublicPreviewPortal";
import "./styles.css";
import "./refined.css";
import "./vnext.css";
import "./vnext-rules.css";

const previewSlug = getPublicPreviewSlug(window.location.pathname);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {previewSlug ? <PublicPreviewPortal slug={previewSlug} /> : <App />}
  </StrictMode>,
);

import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { getPublicPreviewSlug, PublicPreviewPortal } from "./components/PublicPreviewPortal";
import "./styles.css";
import "./refined.css";
import "./vnext.css";
import "./vnext-rules.css";

const previewSlug = getPublicPreviewSlug(window.location.pathname);
const isCrmRoute = window.location.pathname === "/crm" || window.location.pathname.startsWith("/crm/");
const SitesLanding = lazy(() =>
  import("./components/SitesLanding").then(({ PortalHome }) => ({ default: PortalHome })),
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {previewSlug ? (
      <PublicPreviewPortal slug={previewSlug} />
    ) : isCrmRoute ? (
      <App />
    ) : (
      <Suspense fallback={null}>
        <SitesLanding />
      </Suspense>
    )}
  </StrictMode>,
);

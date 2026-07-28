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
const normalizedPath =
  window.location.pathname === "/portifolio"
    ? "/portfolio"
    : window.location.pathname;
if (normalizedPath !== window.location.pathname) {
  window.history.replaceState({}, "", `${normalizedPath}${window.location.search}`);
}
const portfolioMatch = normalizedPath.match(/^\/portfolio\/([^/]+)\/?$/);
const isPortfolioIndex = normalizedPath === "/portfolio" || normalizedPath === "/portfolio/";
const SitesLanding = lazy(() =>
  import("./components/SitesLanding").then(({ PortalHome }) => ({ default: PortalHome })),
);
const PortfolioGallery = lazy(() =>
  import("./components/PublicPortfolio").then(({ PortfolioGalleryPage }) => ({
    default: PortfolioGalleryPage,
  })),
);
const PortfolioCase = lazy(() =>
  import("./components/PublicPortfolio").then(({ PortfolioCasePage }) => ({
    default: PortfolioCasePage,
  })),
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {previewSlug ? (
      <PublicPreviewPortal slug={previewSlug} />
    ) : isCrmRoute ? (
      <App />
    ) : isPortfolioIndex ? (
      <Suspense fallback={null}>
        <PortfolioGallery />
      </Suspense>
    ) : portfolioMatch ? (
      <Suspense fallback={null}>
        <PortfolioCase slug={decodeURIComponent(portfolioMatch[1])} />
      </Suspense>
    ) : (
      <Suspense fallback={null}>
        <SitesLanding />
      </Suspense>
    )}
  </StrictMode>,
);

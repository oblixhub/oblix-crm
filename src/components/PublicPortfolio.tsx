import { ArrowLeft, ArrowUpRight, ExternalLink, MonitorPlay } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  fetchPublicPortfolio,
  fetchPublicPortfolioProject,
} from "../lib/portfolio";
import type { PublicPortfolioProject } from "../types";
import { PortfolioPublicHeader, portfolioWhatsappUrl } from "./PortfolioPublicHeader";
import "../sites-landing.css";
import "../portfolio-public.css";

function ProjectCover({
  project,
  eager = false,
}: {
  project: PublicPortfolioProject;
  eager?: boolean;
}) {
  const source = project.coverDesktopUrl || project.coverMobileUrl;
  if (!source) {
    return (
      <span className="portfolio-cover-fallback" aria-hidden="true">
        <span>{project.title}</span>
        <small>{project.category}</small>
      </span>
    );
  }
  return (
    <picture>
      {project.coverMobileUrl ? (
        <source media="(max-width: 680px)" srcSet={project.coverMobileUrl} />
      ) : null}
      <img
        src={source}
        alt={`Capa do projeto ${project.title}`}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
      />
    </picture>
  );
}

function PortfolioFooterCta() {
  return (
    <section className="portfolio-footer-cta">
      <h2>Seu trabalho merece uma presença à altura.</h2>
      <p>
        Conte o que você faz. A OBLIX transforma isso em um site feito para ser
        visto, entendido e lembrado.
      </p>
      <a href={portfolioWhatsappUrl} target="_blank" rel="noreferrer">
        Quero conversar
        <ArrowUpRight size={22} />
      </a>
    </section>
  );
}

export function PortfolioGalleryPage() {
  const [projects, setProjects] = useState<PublicPortfolioProject[]>([]);
  const [filter, setFilter] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Portfólio — OBLIX Sites";
    void fetchPublicPortfolio()
      .then(setProjects)
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível carregar o portfólio.",
        ),
      )
      .finally(() => setLoading(false));
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const categories = useMemo(
    () => [
      "Todos",
      ...Array.from(new Set(projects.map((project) => project.category))).filter(
        Boolean,
      ),
    ],
    [projects],
  );
  const visibleProjects =
    filter === "Todos"
      ? projects
      : projects.filter((project) => project.category === filter);

  return (
    <main className="portfolio-public-page">
      <PortfolioPublicHeader />
      <section className="portfolio-gallery-hero">
        <h1>Cada projeto começa com uma presença diferente.</h1>
        <p>
          Identidade, conteúdo e conversão organizados para mostrar o valor de
          cada negócio sem parecer mais do mesmo.
        </p>
      </section>
      <section className="portfolio-gallery" aria-busy={loading}>
        <div className="portfolio-filters" aria-label="Filtrar projetos">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className={filter === category ? "is-active" : ""}
              onClick={() => setFilter(category)}
            >
              {category}
            </button>
          ))}
        </div>

        {error ? <p className="portfolio-public-message">{error}</p> : null}
        {!loading && !error && visibleProjects.length === 0 ? (
          <div className="portfolio-empty-public">
            <h2>Novos projetos estão entrando em cena.</h2>
            <p>Volte em breve para navegar pelos trabalhos selecionados.</p>
          </div>
        ) : null}
        <div className="portfolio-gallery-grid">
          {visibleProjects.map((project, index) => (
            <a
              className={`portfolio-gallery-card ${
                index % 5 === 0 ? "is-wide" : ""
              }`}
              key={project.id}
              href={`/portfolio/${encodeURIComponent(project.slug)}`}
            >
              <span className="portfolio-gallery-cover">
                <ProjectCover project={project} eager={index < 2} />
              </span>
              <span className="portfolio-gallery-meta">
                <span>
                  <strong>{project.title}</strong>
                  <small>{project.category}</small>
                </span>
                <ArrowUpRight aria-hidden="true" />
              </span>
            </a>
          ))}
        </div>
      </section>
      <PortfolioFooterCta />
    </main>
  );
}

export function PortfolioCasePage({ slug }: { slug: string }) {
  const [project, setProject] = useState<PublicPortfolioProject | null>(null);
  const [nextProject, setNextProject] =
    useState<PublicPortfolioProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    let active = true;
    void Promise.all([
      fetchPublicPortfolioProject(slug),
      fetchPublicPortfolio({ limit: 100 }),
    ])
      .then(([current, all]) => {
        if (!active) return;
        setProject(current);
        if (current) {
          document.title = `${current.title} — Portfólio OBLIX`;
          const currentIndex = all.findIndex((item) => item.id === current.id);
          setNextProject(
            all.length > 1
              ? all[(currentIndex + 1 + all.length) % all.length]
              : null,
          );
        } else {
          setError("Projeto não encontrado.");
        }
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível carregar este projeto.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      document.title = previousTitle;
    };
  }, [slug]);

  return (
    <main className="portfolio-public-page portfolio-case-page">
      <PortfolioPublicHeader />
      <a className="portfolio-back-link" href="/portfolio">
        <ArrowLeft size={18} />
        Voltar ao portfólio
      </a>

      {loading ? (
        <p className="portfolio-public-message">Carregando projeto…</p>
      ) : null}
      {error ? <p className="portfolio-public-message">{error}</p> : null}
      {project ? (
        <>
          <article className="portfolio-case-hero">
            <div className="portfolio-case-copy">
              <h1>{project.title}</h1>
              <span>{project.category}</span>
              <p>{project.description || project.shortDescription}</p>
              {project.services.length > 0 ? (
                <ul>
                  {project.services.map((service) => (
                    <li key={service}>{service}</li>
                  ))}
                </ul>
              ) : null}
              <div className="portfolio-case-actions">
                <button type="button" onClick={() => setViewerOpen(true)}>
                  <MonitorPlay size={20} />
                  Navegar pelo projeto
                </button>
                {project.showLiveLink && project.liveUrl ? (
                  <a href={project.liveUrl} target="_blank" rel="noreferrer">
                    <ExternalLink size={19} />
                    Ver site no ar
                  </a>
                ) : null}
              </div>
            </div>
            <div className="portfolio-case-cover">
              <ProjectCover project={project} eager />
            </div>
          </article>

          <section className="portfolio-case-story">
            <p>
              Cada detalhe foi organizado para transformar o trabalho em uma
              presença clara, responsiva e pronta para conversar com o público.
            </p>
          </section>

          {viewerOpen ? (
            <section className="portfolio-site-viewer" id="navegar">
              <header>
                <div>
                  <h2>Navegue pelo projeto</h2>
                  <p>Visualização completa em uma área isolada e segura.</p>
                </div>
                <button type="button" onClick={() => setViewerOpen(false)}>
                  Fechar visualização
                </button>
              </header>
              <iframe
                src={project.contentUrl}
                title={`Site ${project.title}`}
                loading="lazy"
                sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
                referrerPolicy="no-referrer"
              />
            </section>
          ) : null}

          {nextProject && nextProject.id !== project.id ? (
            <a
              className="portfolio-next-project"
              href={`/portfolio/${encodeURIComponent(nextProject.slug)}`}
            >
              <span>Próximo projeto</span>
              <strong>{nextProject.title}</strong>
              <ArrowUpRight />
            </a>
          ) : null}
          <PortfolioFooterCta />
        </>
      ) : null}
    </main>
  );
}

export { ProjectCover };

import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchPublicPortfolio } from "../lib/portfolio";
import type { PublicPortfolioProject } from "../types";
import { ProjectCover } from "./PublicPortfolio";

export function FeaturedPortfolioSection() {
  const [projects, setProjects] = useState<PublicPortfolioProject[]>([]);

  useEffect(() => {
    let active = true;
    void fetchPublicPortfolio({ featured: true, limit: 3 })
      .then(async (featured) => {
        if (featured.length > 0) return featured;
        return fetchPublicPortfolio({ limit: 3 });
      })
      .then((data) => {
        if (active) setProjects(data);
      })
      .catch(() => {
        // A landing remains usable if the public portfolio service is unavailable.
      });
    return () => {
      active = false;
    };
  }, []);

  if (projects.length === 0) return null;

  return (
    <section className="featured-portfolio" id="projetos">
      <div className="featured-portfolio-heading">
        <h2>Projetos feitos para ocupar espaço.</h2>
        <a href="/portfolio">
          Ver todo o portfólio
          <ArrowRight size={22} />
        </a>
      </div>
      <div className="featured-portfolio-grid">
        {projects.map((project, index) => (
          <a
            className={index === 0 ? "featured-project is-primary" : "featured-project"}
            key={project.id}
            href={`/portfolio/${encodeURIComponent(project.slug)}`}
          >
            <span className="featured-project-cover">
              <ProjectCover project={project} eager={index === 0} />
            </span>
            <span className="featured-project-meta">
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
  );
}

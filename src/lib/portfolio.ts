import type { PublicPortfolioProject } from "../types";
import { supabasePublishableKey, supabaseUrl } from "./supabase";

type PortfolioListOptions = {
  featured?: boolean;
  limit?: number;
};

const demoProjects: PublicPortfolioProject[] = [
  {
    id: "demo-catty",
    title: "Catty Lopes",
    slug: "catty-lopes",
    category: "Site",
    shortDescription: "Presença editorial para uma atuação profissional.",
    description:
      "Uma direção sóbria e editorial, construída para organizar conteúdo e reforçar a percepção de autoridade.",
    services: ["Direção visual", "Copy", "Responsividade"],
    coverDesktopUrl: "/media/direction-identity.png",
    coverMobileUrl: "/media/direction-identity.png",
    contentUrl: "about:blank",
    showLiveLink: false,
    featured: true,
    sortOrder: 0,
  },
  {
    id: "demo-hanna",
    title: "Hanna Neri",
    slug: "hanna-neri",
    category: "Landing page",
    shortDescription: "Uma página focada em clareza e contato.",
    description:
      "Conteúdo e hierarquia visual pensados para apresentar o trabalho com rapidez e conduzir a conversa.",
    services: ["Landing page", "Mobile first"],
    coverDesktopUrl: "/media/direction-content.png",
    coverMobileUrl: "/media/direction-content.png",
    contentUrl: "about:blank",
    showLiveLink: false,
    featured: true,
    sortOrder: 1,
  },
  {
    id: "demo-leticia",
    title: "Letícia Lima",
    slug: "leticia-lima",
    category: "Site",
    shortDescription: "Informação organizada em uma experiência leve.",
    description:
      "Um site responsivo para apresentar serviços, criar confiança e facilitar o primeiro contato.",
    services: ["Site", "Responsividade"],
    coverDesktopUrl: "/media/direction-conversion.png",
    coverMobileUrl: "/media/direction-conversion.png",
    contentUrl: "about:blank",
    showLiveLink: false,
    featured: true,
    sortOrder: 2,
  },
];

const usePortfolioDemo = () =>
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("preview");

const portfolioEndpoint = () =>
  supabaseUrl
    ? `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/portfolio-public`
    : null;

const portfolioHeaders = () => ({
  apikey: supabasePublishableKey ?? "",
  "Content-Type": "application/json",
});

export async function fetchPublicPortfolio(
  options: PortfolioListOptions = {},
): Promise<PublicPortfolioProject[]> {
  if (usePortfolioDemo()) {
    const source = options.featured
      ? demoProjects.filter((project) => project.featured)
      : demoProjects;
    return source.slice(0, options.limit ?? source.length);
  }
  const endpoint = portfolioEndpoint();
  if (!endpoint || !supabasePublishableKey) return [];
  const url = new URL(endpoint);
  if (options.featured) url.searchParams.set("featured", "true");
  if (options.limit) url.searchParams.set("limit", String(options.limit));
  url.searchParams.set("_refresh", String(Date.now()));
  const response = await fetch(url, {
    headers: portfolioHeaders(),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Não foi possível carregar o portfólio.");
  const payload = (await response.json()) as {
    projects?: PublicPortfolioProject[];
  };
  return payload.projects ?? [];
}

export async function fetchPublicPortfolioProject(
  slug: string,
): Promise<PublicPortfolioProject | null> {
  if (usePortfolioDemo()) {
    return demoProjects.find((project) => project.slug === slug) ?? null;
  }
  const endpoint = portfolioEndpoint();
  if (!endpoint || !supabasePublishableKey) return null;
  const url = new URL(endpoint);
  url.searchParams.set("slug", slug);
  url.searchParams.set("_refresh", String(Date.now()));
  const response = await fetch(url, {
    headers: portfolioHeaders(),
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Não foi possível carregar este projeto.");
  const payload = (await response.json()) as {
    project?: PublicPortfolioProject;
  };
  return payload.project ?? null;
}

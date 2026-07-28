import {
  Archive,
  ArrowDown,
  ArrowUp,
  Check,
  ExternalLink,
  FileArchive,
  ImagePlus,
  LoaderCircle,
  Pencil,
  Plus,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { supabase, supabaseUrl } from "../lib/supabase";
import type {
  Lead,
  PortfolioProject,
  PortfolioSourceType,
  PortfolioStatus,
} from "../types";
import "../portfolio-manager.css";

type PortfolioManagerProps = {
  leads: Lead[];
  currentUserId?: string;
  onToast?: (message: string) => void;
};

type PortfolioFormState = {
  id?: string;
  sourceType: PortfolioSourceType;
  leadId: string;
  title: string;
  slug: string;
  category: string;
  shortDescription: string;
  description: string;
  services: string;
  liveUrl: string;
  showLiveLink: boolean;
  featured: boolean;
  publicationAuthorized: boolean;
  authorizationNote: string;
  sourcePath?: string;
  coverDesktopPath?: string;
  coverMobilePath?: string;
  status: PortfolioStatus;
};

const emptyForm = (): PortfolioFormState => ({
  sourceType: "lead_preview",
  leadId: "",
  title: "",
  slug: "",
  category: "Site",
  shortDescription: "",
  description: "",
  services: "",
  liveUrl: "",
  showLiveLink: false,
  featured: false,
  publicationAuthorized: false,
  authorizationNote: "",
  status: "draft",
});

const toSlug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const safeFileName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

const publicCoverUrl = (path?: string) =>
  path && supabaseUrl
    ? `${supabaseUrl.replace(
        /\/+$/,
        "",
      )}/storage/v1/object/public/portfolio-covers/${path
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`
    : undefined;

const mapPortfolioProject = (row: Record<string, unknown>): PortfolioProject => ({
  id: String(row.id),
  leadId: row.lead_id ? String(row.lead_id) : undefined,
  title: String(row.title ?? ""),
  slug: String(row.slug ?? ""),
  category: String(row.category ?? "Site"),
  shortDescription: String(row.short_description ?? ""),
  description: String(row.description ?? ""),
  services: Array.isArray(row.services)
    ? row.services.map(String)
    : [],
  sourceType: row.source_type as PortfolioSourceType,
  sourcePath: row.source_path ? String(row.source_path) : undefined,
  publicKey: row.public_key ? String(row.public_key) : undefined,
  currentVersion: Number(row.current_version ?? 0),
  contentUrl: row.content_url ? String(row.content_url) : undefined,
  coverDesktopPath: row.cover_desktop_path
    ? String(row.cover_desktop_path)
    : undefined,
  coverMobilePath: row.cover_mobile_path
    ? String(row.cover_mobile_path)
    : undefined,
  coverDesktopUrl: publicCoverUrl(
    row.cover_desktop_path ? String(row.cover_desktop_path) : undefined,
  ),
  coverMobileUrl: publicCoverUrl(
    row.cover_mobile_path ? String(row.cover_mobile_path) : undefined,
  ),
  liveUrl: row.live_url ? String(row.live_url) : undefined,
  showLiveLink: Boolean(row.show_live_link),
  featured: Boolean(row.featured),
  sortOrder: Number(row.sort_order ?? 0),
  status: row.status as PortfolioStatus,
  publicationAuthorized: Boolean(row.publication_authorized),
  authorizationNote: String(row.authorization_note ?? ""),
  publishedAt: row.published_at ? String(row.published_at) : undefined,
  createdAt: row.created_at ? String(row.created_at) : undefined,
  updatedAt: row.updated_at ? String(row.updated_at) : undefined,
});

const projectToForm = (project: PortfolioProject): PortfolioFormState => ({
  id: project.id,
  sourceType: project.sourceType,
  leadId: project.leadId ?? "",
  title: project.title,
  slug: project.slug,
  category: project.category,
  shortDescription: project.shortDescription,
  description: project.description,
  services: project.services.join(", "),
  liveUrl: project.liveUrl ?? "",
  showLiveLink: project.showLiveLink,
  featured: project.featured,
  publicationAuthorized: project.publicationAuthorized,
  authorizationNote: project.authorizationNote,
  sourcePath: project.sourcePath,
  coverDesktopPath: project.coverDesktopPath,
  coverMobilePath: project.coverMobilePath,
  status: project.status,
});

export function PortfolioManager({
  leads,
  currentUserId,
  onToast,
}: PortfolioManagerProps) {
  const portfolioPublicPrefix = `${window.location.host}/portfolio/`;
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<PortfolioFormState>(emptyForm);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [desktopCover, setDesktopCover] = useState<File | null>(null);
  const [mobileCover, setMobileCover] = useState<File | null>(null);
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const [localMessage, setLocalMessage] = useState("");

  const eligibleLeads = useMemo(
    () =>
      [...leads]
        .filter((lead) => lead.remoteId && lead.preview.sourcePath)
        .sort((a, b) =>
          (a.fullName ?? a.handle).localeCompare(b.fullName ?? b.handle),
        ),
    [leads],
  );

  const notify = useCallback(
    (message: string) => {
      setLocalMessage(message);
      onToast?.(message);
      window.setTimeout(() => setLocalMessage(""), 4500);
    },
    [onToast],
  );

  const loadProjects = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("portfolio_projects")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      notify(`Não foi possível carregar o portfólio: ${error.message}`);
    } else {
      setProjects(
        ((data ?? []) as Record<string, unknown>[]).map(mapPortfolioProject),
      );
    }
    setLoading(false);
  }, [notify]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (!drawerOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  const openNew = (sourceType: PortfolioSourceType = "lead_preview") => {
    setForm({ ...emptyForm(), sourceType });
    setZipFile(null);
    setDesktopCover(null);
    setMobileCover(null);
    setDrawerOpen(true);
  };

  const openEdit = (project: PortfolioProject) => {
    setForm(projectToForm(project));
    setZipFile(null);
    setDesktopCover(null);
    setMobileCover(null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (saving) return;
    setDrawerOpen(false);
  };

  const chooseLead = (leadId: string) => {
    const lead = eligibleLeads.find((item) => item.remoteId === leadId);
    setForm((current) => ({
      ...current,
      leadId,
      title:
        current.title || lead?.fullName || lead?.handle.replace(/^@/, "") || "",
      slug:
        current.slug ||
        toSlug(lead?.fullName || lead?.handle.replace(/^@/, "") || ""),
      category:
        current.category === "Site" && lead?.category
          ? lead.category
          : current.category,
      sourcePath: lead?.preview.sourcePath,
    }));
  };

  const uploadFile = async (
    projectId: string,
    file: File,
    kind: "zip" | "desktop" | "mobile",
  ) => {
    if (!supabase) throw new Error("Supabase indisponível.");
    const timestamp = Date.now();
    const fileName = safeFileName(file.name) || `${kind}-${timestamp}`;
    const isZip = kind === "zip";
    const bucket = isZip ? "portfolio-zips" : "portfolio-covers";
    const path = isZip
      ? `${projectId}/source/${timestamp}-${fileName}`
      : `${projectId}/${kind}-${timestamp}-${fileName}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: false,
      cacheControl: isZip ? "0" : "31536000",
      contentType: file.type || undefined,
    });
    if (error) throw error;
    return path;
  };

  const persist = async (publish: boolean) => {
    if (!supabase || !currentUserId) {
      notify("Sua sessão não está pronta. Entre novamente no CRM.");
      return;
    }
    const normalizedSlug = toSlug(form.slug || form.title);
    if (!form.title.trim() || !normalizedSlug) {
      notify("Preencha o título e o endereço do projeto.");
      return;
    }
    if (form.sourceType === "lead_preview" && !form.leadId) {
      notify("Selecione o lead que contém o site.");
      return;
    }
    if (form.sourceType === "standalone_zip" && !zipFile && !form.sourcePath) {
      notify("Selecione o ZIP do projeto avulso.");
      return;
    }
    if (publish && !form.publicationAuthorized) {
      notify("Confirme a autorização para publicar o trabalho.");
      return;
    }
    if (form.showLiveLink && !/^https:\/\//i.test(form.liveUrl.trim())) {
      notify("O link do site no ar precisa começar com https://.");
      return;
    }

    setSaving(publish ? "publish" : "draft");
    try {
      const selectedLead = eligibleLeads.find(
        (lead) => lead.remoteId === form.leadId,
      );
      const basePayload = {
        lead_id: form.sourceType === "lead_preview" ? form.leadId : null,
        title: form.title.trim(),
        slug: normalizedSlug,
        category: form.category.trim() || "Site",
        short_description: form.shortDescription.trim(),
        description: form.description.trim(),
        services: form.services
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        source_type: form.sourceType,
        source_path:
          form.sourceType === "lead_preview"
            ? selectedLead?.preview.sourcePath ?? form.sourcePath ?? null
            : form.sourcePath ?? null,
        live_url: form.liveUrl.trim() || null,
        show_live_link: form.showLiveLink && Boolean(form.liveUrl.trim()),
        featured: form.featured,
        publication_authorized: form.publicationAuthorized,
        authorization_note: form.authorizationNote.trim(),
        status:
          publish || form.status === "published" ? form.status : "draft",
        updated_at: new Date().toISOString(),
      };

      let projectId = form.id;
      if (projectId) {
        const { error } = await supabase
          .from("portfolio_projects")
          .update(basePayload)
          .eq("id", projectId);
        if (error) throw error;
      } else {
        const nextOrder =
          projects.reduce(
            (highest, project) => Math.max(highest, project.sortOrder),
            -1,
          ) + 1;
        const { data, error } = await supabase
          .from("portfolio_projects")
          .insert({
            ...basePayload,
            created_by: currentUserId,
            sort_order: nextOrder,
          })
          .select("id")
          .single();
        if (error) throw error;
        projectId = data.id;
      }
      if (!projectId) throw new Error("Não foi possível identificar o projeto.");

      const [newSourcePath, newDesktopPath, newMobilePath] = await Promise.all([
        zipFile
          ? uploadFile(projectId, zipFile, "zip")
          : Promise.resolve(form.sourcePath),
        desktopCover
          ? uploadFile(projectId, desktopCover, "desktop")
          : Promise.resolve(form.coverDesktopPath),
        mobileCover
          ? uploadFile(projectId, mobileCover, "mobile")
          : Promise.resolve(form.coverMobilePath),
      ]);

      const { error: fileUpdateError } = await supabase
        .from("portfolio_projects")
        .update({
          source_path:
            form.sourceType === "lead_preview"
              ? selectedLead?.preview.sourcePath ?? form.sourcePath ?? null
              : newSourcePath ?? null,
          cover_desktop_path: newDesktopPath ?? null,
          cover_mobile_path: newMobilePath ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);
      if (fileUpdateError) throw fileUpdateError;

      if (publish) {
        const { data, error } = await supabase.functions.invoke(
          "publish-portfolio",
          { body: { projectId } },
        );
        if (error) {
          let message = error.message;
          const context = (error as { context?: Response }).context;
          if (context) {
            try {
              const payload = await context.json();
              if (typeof payload?.error === "string") message = payload.error;
            } catch {
              // Keep the platform error when the response has no JSON body.
            }
          }
          throw new Error(message);
        }
        if (data?.error) throw new Error(String(data.error));
        notify("Projeto publicado e pronto para aparecer no portfólio.");
      } else {
        notify("Rascunho salvo.");
      }

      setDrawerOpen(false);
      await loadProjects();
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o projeto.",
      );
    } finally {
      setSaving(null);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void persist(false);
  };

  const updateInline = async (
    project: PortfolioProject,
    patch: Record<string, unknown>,
    successMessage: string,
  ) => {
    if (!supabase) return;
    const { error } = await supabase
      .from("portfolio_projects")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", project.id);
    if (error) {
      notify(error.message);
      return;
    }
    notify(successMessage);
    await loadProjects();
  };

  const reorder = async (project: PortfolioProject, direction: -1 | 1) => {
    const activeProjects = projects.filter(
      (item) => item.status !== "archived",
    );
    const index = activeProjects.findIndex((item) => item.id === project.id);
    const swap = activeProjects[index + direction];
    if (!swap || !supabase) return;
    const [projectUpdate, swapUpdate] = await Promise.all([
      supabase
        .from("portfolio_projects")
        .update({ sort_order: swap.sortOrder })
        .eq("id", project.id),
      supabase
        .from("portfolio_projects")
        .update({ sort_order: project.sortOrder })
        .eq("id", swap.id),
    ]);
    if (projectUpdate.error || swapUpdate.error) {
      notify(projectUpdate.error?.message || swapUpdate.error?.message || "Não foi possível alterar a ordem.");
      return;
    }
    await loadProjects();
  };

  const publishedCount = projects.filter(
    (project) => project.status === "published",
  ).length;
  const draftCount = projects.filter(
    (project) => project.status === "draft",
  ).length;

  return (
    <section className="portfolio-manager-page">
      <header className="portfolio-manager-heading">
        <div>
          <h1>Portfólio</h1>
          <p>
            {publishedCount} {publishedCount === 1 ? "publicado" : "publicados"}
            {" · "}
            {draftCount} {draftCount === 1 ? "rascunho" : "rascunhos"}
          </p>
        </div>
        <button
          type="button"
          className="portfolio-manager-primary"
          onClick={() => openNew()}
        >
          <Plus size={20} />
          Novo projeto
        </button>
      </header>

      {localMessage ? (
        <div className="portfolio-manager-message" role="status">
          <Check size={17} />
          {localMessage}
        </div>
      ) : null}

      <div className="portfolio-source-actions">
        <button type="button" onClick={() => openNew("lead_preview")}>
          <UserRound size={27} />
          <span>
            <strong>Usar site de um lead</strong>
            <small>Escolha um ZIP já publicado no CRM</small>
          </span>
          <Plus size={19} />
        </button>
        <button type="button" onClick={() => openNew("standalone_zip")}>
          <FileArchive size={27} />
          <span>
            <strong>Enviar ZIP avulso</strong>
            <small>Adicione um trabalho que não está nos leads</small>
          </span>
          <Plus size={19} />
        </button>
      </div>

      {loading ? (
        <div className="portfolio-manager-loading">
          <LoaderCircle className="spin" size={24} />
          Carregando projetos…
        </div>
      ) : projects.length === 0 ? (
        <div className="portfolio-manager-empty">
          <FileArchive size={34} />
          <h2>Seu portfólio começa aqui.</h2>
          <p>
            Publique um site de lead ou envie um ZIP avulso. Nada aparece na
            landing antes da sua confirmação.
          </p>
        </div>
      ) : (
        <div className="portfolio-project-list">
          <div className="portfolio-project-list-head" aria-hidden="true">
            <span>Projeto</span>
            <span>Fonte</span>
            <span>Status</span>
            <span>Destaque</span>
            <span>Ordem</span>
            <span>Ações</span>
          </div>
          {projects.map((project) => (
            <article
              className={`portfolio-project-row is-${project.status}`}
              key={project.id}
            >
              <div className="portfolio-project-identity">
                <span className="portfolio-project-thumb">
                  {project.coverDesktopUrl || project.coverMobileUrl ? (
                    <img
                      src={project.coverDesktopUrl || project.coverMobileUrl}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <span>{project.title.slice(0, 2).toUpperCase()}</span>
                  )}
                </span>
                <span>
                  <strong>{project.title}</strong>
                  <small>{project.category}</small>
                </span>
              </div>
              <span className="portfolio-project-source">
                {project.sourceType === "lead_preview" ? (
                  <UserRound size={15} />
                ) : (
                  <FileArchive size={15} />
                )}
                {project.sourceType === "lead_preview" ? "Lead do CRM" : "ZIP avulso"}
              </span>
              <span className={`portfolio-project-status is-${project.status}`}>
                {project.status === "published"
                  ? "Publicado"
                  : project.status === "archived"
                    ? "Arquivado"
                    : "Rascunho"}
              </span>
              <label className="portfolio-manager-switch">
                <input
                  type="checkbox"
                  checked={project.featured}
                  disabled={project.status === "archived"}
                  onChange={(event) =>
                    void updateInline(
                      project,
                      { featured: event.target.checked },
                      event.target.checked
                        ? "Projeto destacado na landing."
                        : "Destaque removido.",
                    )
                  }
                />
                <span />
                <small>Destacar</small>
              </label>
              <span className="portfolio-order-actions">
                <button
                  type="button"
                  aria-label={`Mover ${project.title} para cima`}
                  onClick={() => void reorder(project, -1)}
                >
                  <ArrowUp size={17} />
                </button>
                <button
                  type="button"
                  aria-label={`Mover ${project.title} para baixo`}
                  onClick={() => void reorder(project, 1)}
                >
                  <ArrowDown size={17} />
                </button>
              </span>
              <span className="portfolio-row-actions">
                {project.status === "published" ? (
                  <a
                    href={`/portfolio/${encodeURIComponent(project.slug)}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Abrir ${project.title} no portfólio`}
                  >
                    <ExternalLink size={18} />
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => openEdit(project)}
                  aria-label={`Editar ${project.title}`}
                >
                  <Pencil size={18} />
                </button>
                {project.status !== "archived" ? (
                  <button
                    type="button"
                    className="is-danger"
                    onClick={() =>
                      void updateInline(
                        project,
                        { status: "archived", featured: false },
                        "Projeto arquivado e removido do site público.",
                      )
                    }
                    aria-label={`Arquivar ${project.title}`}
                  >
                    <Archive size={18} />
                  </button>
                ) : null}
              </span>
            </article>
          ))}
        </div>
      )}

      {drawerOpen ? (
        <>
          <button
            className="portfolio-drawer-backdrop"
            type="button"
            onClick={closeDrawer}
            aria-label="Fechar editor"
          />
          <aside
            className="portfolio-editor-drawer"
            aria-label={form.id ? "Editar projeto" : "Novo projeto"}
          >
            <header>
              <div>
                <h2>{form.id ? "Editar projeto" : "Novo projeto"}</h2>
                <p>Preencha só o que precisa aparecer no portfólio público.</p>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                disabled={Boolean(saving)}
                aria-label="Fechar"
              >
                <X size={22} />
              </button>
            </header>
            <form onSubmit={submit}>
              <div className="portfolio-source-tabs" role="tablist">
                <button
                  type="button"
                  className={
                    form.sourceType === "lead_preview" ? "is-active" : ""
                  }
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      sourceType: "lead_preview",
                    }))
                  }
                >
                  Lead do CRM
                </button>
                <button
                  type="button"
                  className={
                    form.sourceType === "standalone_zip" ? "is-active" : ""
                  }
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      sourceType: "standalone_zip",
                      leadId: "",
                      sourcePath:
                        current.sourceType === "standalone_zip"
                          ? current.sourcePath
                          : undefined,
                    }))
                  }
                >
                  ZIP avulso
                </button>
              </div>

              {form.sourceType === "lead_preview" ? (
                <label className="portfolio-field">
                  <span>Lead com ZIP publicado</span>
                  <select
                    value={form.leadId}
                    onChange={(event) => chooseLead(event.target.value)}
                    required
                  >
                    <option value="">Selecione o lead</option>
                    {eligibleLeads.map((lead) => (
                      <option key={lead.remoteId} value={lead.remoteId}>
                        {lead.fullName || lead.handle} · {lead.handle}
                      </option>
                    ))}
                  </select>
                  <small>
                    Apenas leads com arquivo-fonte disponível aparecem aqui.
                  </small>
                </label>
              ) : (
                <label className="portfolio-upload-box">
                  <input
                    type="file"
                    accept=".zip,application/zip,application/x-zip-compressed"
                    onChange={(event) =>
                      setZipFile(event.target.files?.[0] ?? null)
                    }
                  />
                  <Upload size={26} />
                  <strong>
                    {zipFile?.name ||
                      (form.sourcePath ? "ZIP já salvo" : "Enviar ZIP avulso")}
                  </strong>
                  <span>Máximo de 20 MB · exportado pelo Claude Design</span>
                </label>
              )}

              <div className="portfolio-fields-two">
                <label className="portfolio-field">
                  <span>Título</span>
                  <input
                    value={form.title}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        title: event.target.value,
                        slug: current.slug || toSlug(event.target.value),
                      }))
                    }
                    placeholder="Ex.: Catty Lopes"
                    required
                  />
                </label>
                <label className="portfolio-field">
                  <span>Categoria</span>
                  <input
                    value={form.category}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                    placeholder="Site"
                    required
                  />
                </label>
              </div>

              <label className="portfolio-field">
                <span>Endereço público</span>
                <div className="portfolio-slug-field">
                  <small>{portfolioPublicPrefix}</small>
                  <input
                    value={form.slug}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        slug: toSlug(event.target.value),
                      }))
                    }
                    placeholder="catty-lopes"
                    required
                  />
                </div>
              </label>

              <label className="portfolio-field">
                <span>Resumo curto</span>
                <textarea
                  value={form.shortDescription}
                  maxLength={180}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      shortDescription: event.target.value,
                    }))
                  }
                  placeholder="Uma frase para a galeria."
                />
                <small>{form.shortDescription.length}/180</small>
              </label>

              <label className="portfolio-field">
                <span>Descrição do projeto</span>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Explique a direção e o objetivo do projeto sem expor dados do lead."
                />
              </label>

              <label className="portfolio-field">
                <span>Serviços entregues</span>
                <input
                  value={form.services}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      services: event.target.value,
                    }))
                  }
                  placeholder="Design, copy, responsividade"
                />
                <small>Separe por vírgulas.</small>
              </label>

              <div className="portfolio-cover-fields">
                <label className="portfolio-cover-upload">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/avif"
                    onChange={(event) =>
                      setDesktopCover(event.target.files?.[0] ?? null)
                    }
                  />
                  <ImagePlus size={23} />
                  <span>
                    <strong>Capa desktop</strong>
                    <small>
                      {desktopCover?.name ||
                        (form.coverDesktopPath
                          ? "Capa já salva"
                          : "Recomendado 1920 × 1200")}
                    </small>
                  </span>
                </label>
                <label className="portfolio-cover-upload">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/avif"
                    onChange={(event) =>
                      setMobileCover(event.target.files?.[0] ?? null)
                    }
                  />
                  <ImagePlus size={23} />
                  <span>
                    <strong>Capa mobile</strong>
                    <small>
                      {mobileCover?.name ||
                        (form.coverMobilePath
                          ? "Capa já salva"
                          : "Opcional · 1080 × 1350")}
                    </small>
                  </span>
                </label>
              </div>

              <label className="portfolio-field">
                <span>Site no ar (opcional)</span>
                <input
                  type="url"
                  value={form.liveUrl}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      liveUrl: event.target.value,
                    }))
                  }
                  placeholder="https://cliente.com.br"
                />
              </label>

              <div className="portfolio-form-toggles">
                <label>
                  <input
                    type="checkbox"
                    checked={form.showLiveLink}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        showLiveLink: event.target.checked,
                      }))
                    }
                  />
                  <span />
                  Mostrar link do site
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        featured: event.target.checked,
                      }))
                    }
                  />
                  <span />
                  Destacar na landing
                </label>
              </div>

              <label className="portfolio-authorization">
                <input
                  type="checkbox"
                  checked={form.publicationAuthorized}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      publicationAuthorized: event.target.checked,
                    }))
                  }
                />
                <span>
                  <strong>Confirmo a autorização para publicação.</strong>
                  <small>
                    O projeto ficará visível publicamente no portfólio da OBLIX.
                  </small>
                </span>
              </label>

              <label className="portfolio-field">
                <span>Observação da autorização (opcional)</span>
                <input
                  value={form.authorizationNote}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      authorizationNote: event.target.value,
                    }))
                  }
                  placeholder="Ex.: autorizado no WhatsApp em 28/07"
                />
              </label>

              <footer className="portfolio-editor-actions">
                <button
                  type="submit"
                  className="portfolio-save-draft"
                  disabled={Boolean(saving)}
                >
                  {saving === "draft" ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : null}
                  Salvar rascunho
                </button>
                <button
                  type="button"
                  className="portfolio-publish"
                  disabled={Boolean(saving)}
                  onClick={() => void persist(true)}
                >
                  {saving === "publish" ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : (
                    <Upload size={18} />
                  )}
                  Publicar projeto
                </button>
              </footer>
            </form>
          </aside>
        </>
      ) : null}
    </section>
  );
}

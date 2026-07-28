import { Eye, EyeOff, FileSpreadsheet, Plus, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AppShell } from "./components/AppShell";
import { Brand } from "./components/Brand";
import { ClientPreview } from "./components/ClientPreview";
import { Dashboard } from "./components/Dashboard";
import { FinanceView } from "./components/FinanceView";
import { LeadDetail } from "./components/LeadDetail";
import { resolveLeadPreviewSource } from "./lib/preview-links";
import { LeadDirectory } from "./components/LeadDirectory";
import { MessageLibrary } from "./components/MessageLibrary";
import { MessageManager } from "./components/MessageManager";
import { Modal } from "./components/Modal";
import { PreviewHub } from "./components/PreviewHub";
import { ProspectingBoard } from "./components/ProspectingBoard";
import {
  ValidationQueue,
  type BatchValidationSettings,
} from "./components/ValidationQueue";
import { initialLeads, initialTemplates } from "./data";
import {
  supabase,
  supabaseConfigured,
  supabasePublishableKey,
  supabaseUrl,
} from "./lib/supabase";
import type {
  Activity,
  Lead,
  MessageTemplate,
  NavKey,
  Owner,
  Priority,
  ProspectingOutcome,
  Stage,
  WeekDay,
} from "./types";
import { ownerLabels, owners } from "./types";

type ModalState =
  | { type: "new-lead" }
  | { type: "import" }
  | { type: "client-preview"; leadId: number }
  | { type: "scripts"; leadId: number }
  | null;

const CRM_WORKSPACE_STORAGE_KEY = "oblix-crm-workspace-v1";
const navKeys: readonly NavKey[] = [
  "dashboard",
  "validation",
  "prospecting",
  "leads",
  "previews",
  "finance",
  "messages",
];

const UNDO_DELETE_TIMEOUT_MS = 10_000;

type UndoDeleteState = {
  lead: Lead;
  index: number;
};

type CrmWorkspace = {
  activeNav?: NavKey;
  selectedLeadId?: number | null;
};

const loadCrmWorkspace = (): CrmWorkspace => {
  try {
    const saved = window.sessionStorage.getItem(CRM_WORKSPACE_STORAGE_KEY);
    if (!saved) return {};
    const parsed = JSON.parse(saved) as Record<string, unknown>;
    const activeNav =
      typeof parsed.activeNav === "string" &&
      navKeys.includes(parsed.activeNav as NavKey)
        ? (parsed.activeNav as NavKey)
        : undefined;
    const selectedLeadId =
      typeof parsed.selectedLeadId === "number" ? parsed.selectedLeadId : null;
    return { activeNav, selectedLeadId };
  } catch {
    return {};
  }
};

const nowLabel = () =>
  new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

const scheduleToIso = (day: WeekDay, time: string) => {
  const date = new Date();
  const targetDays: Partial<Record<WeekDay, number>> = {
    Seg: 1,
    Ter: 2,
    Qua: 3,
    Qui: 4,
    Sex: 5,
  };
  if (day !== "Hoje") {
    const target = targetDays[day] ?? date.getDay();
    let delta = target - date.getDay();
    if (delta < 0) delta += 7;
    date.setDate(date.getDate() + delta);
  }
  const [hours, minutes] = time.split(":").map(Number);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date.toISOString();
};

type ImportedLead = {
  handle: string;
  fullName?: string;
  profileUrl: string;
  segment?: string;
  priority: Priority;
  whatsappUrl?: string;
};

const normalizeColumn = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const normalizeHandle = (value: string) => {
  const fromUrl = value.match(/instagram\.com\/([^/?#]+)/i)?.[1];
  const clean = (fromUrl ?? value).trim().replace(/^@/, "").replace(/\/$/, "");
  return clean ? `@${clean.toLowerCase()}` : "";
};

const normalizeWhatsappUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\/(?:wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)/i.test(trimmed)) {
    return trimmed;
  }
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 10 ? `https://wa.me/${digits}` : undefined;
};

const parseLeadFile = async (file: File): Promise<ImportedLead[]> => {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer());
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  const getValue = (
    row: Record<string, unknown>,
    aliases: string[],
  ): string => {
    const normalizedAliases = aliases.map(normalizeColumn);
    const entry = Object.entries(row).find(([key]) =>
      normalizedAliases.includes(normalizeColumn(key)),
    );
    return String(entry?.[1] ?? "").trim();
  };

  const unique = new Map<string, ImportedLead>();
  rows.forEach((row) => {
    const profileUrl = getValue(row, [
      "profile_url",
      "link",
      "link do perfil",
      "url",
      "instagram url",
    ]);
    const handle = normalizeHandle(
      getValue(row, [
        "handle",
        "usuario",
        "usuário",
        "perfil",
        "perfil do instagram",
        "instagram",
      ]) || profileUrl,
    );
    if (!handle) return;
    const priorityValue = getValue(row, [
      "prioridade",
      "priority",
      "priority_marked",
    ]).toLowerCase();
    const priority: Priority = priorityValue.includes("urgent")
      ? "Urgente"
      : priorityValue.includes("alta") ||
          ["sim", "true", "1", "x"].includes(priorityValue)
        ? "Alta"
        : priorityValue.includes("baixa")
          ? "Baixa"
          : "Normal";

    unique.set(handle, {
      handle,
      fullName:
        getValue(row, ["full_name", "nome", "nome completo", "negocio"]) ||
        undefined,
      profileUrl:
        profileUrl ||
        `https://www.instagram.com/${handle.replace(/^@/, "")}/`,
      segment:
        getValue(row, ["segment", "segmento", "categoria", "nicho"]) ||
        undefined,
      priority,
      whatsappUrl: normalizeWhatsappUrl(
        getValue(row, [
          "whatsapp",
          "telefone",
          "phone",
          "contato",
          "whatsapp url",
        ]),
      ),
    });
  });
  return [...unique.values()];
};

type DbLead = {
  id: string;
  handle: string;
  full_name: string | null;
  profile_url: string;
  priority_marked: boolean;
  segment: string | null;
  stage: string;
  site_status: string | null;
  offer_suggestion: string | null;
  has_whatsapp: boolean;
  whatsapp_url?: string | null;
  whatsapp_number?: string | null;
  validation_status: "pending" | "valid" | "discarded";
  professional_evidence: string | null;
  owner: string | null;
  notes: string | null;
  priority?: Priority | null;
  next_action?: string | null;
  next_action_at?: string | null;
  validated_at?: string | null;
  discard_reason?: string | null;
  source_type?: "excel" | "manual" | "instagram" | null;
  batch_id?: string | null;
  preview_url?: string | null;
  preview_file_name?: string | null;
  preview_version?: number | null;
  preview_published_at?: string | null;
  preview_slug?: string | null;
  preview_site_url?: string | null;
  preview_source_path?: string | null;
  preview_requires_login?: boolean | null;
  prospecting_done?: boolean | null;
  lead_batches?: {
    id: string;
    name: string;
    week_start: string | null;
    status: "active" | "completed" | "archived";
  } | null;
};

type UserProfile = {
  display_name: string;
  role: "owner" | "seller";
};

const stableLeadId = (remoteId: string) => {
  const uuidPrefix = remoteId.replaceAll("-", "").slice(0, 13);
  if (/^[\da-f]{13}$/i.test(uuidPrefix)) {
    return Number.parseInt(uuidPrefix, 16);
  }

  let hash = 2166136261;
  for (let index = 0; index < remoteId.length; index += 1) {
    hash ^= remoteId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const mapDbLead = (row: DbLead, index: number): Lead => ({
  id: row.id ? stableLeadId(row.id) : index + 1,
  remoteId: row.id,
  fullName: row.full_name ?? undefined,
  handle: row.handle,
  initialMessageSent: Boolean(row.prospecting_done),
  category: row.segment ?? "A classificar",
  validationStatus: row.validation_status ?? "pending",
  validatedAt: row.validated_at ?? undefined,
  discardReason: row.discard_reason ?? undefined,
  batchId: row.batch_id ?? undefined,
  batchName:
    row.lead_batches?.name ?? (row.source_type === "manual" ? "Cadastro manual" : "Lote 1"),
  sourceType: row.source_type ?? "excel",
  owner:
    row.owner === "Sócia" || row.owner === "Equipe" ? row.owner : "Você",
  stage: (row.validation_status === "pending" ? "Validar" : row.stage) as Stage,
  nextAction:
    row.next_action ??
    (row.validation_status === "pending"
      ? "Abrir perfil e validar"
      : "Definir próxima ação"),
  nextActionAt: row.next_action_at ?? undefined,
  priority: row.priority ?? (row.priority_marked ? "Alta" : "Normal"),
  scheduleDay: "Hoje",
  dueTime: "A definir",
  siteStatus: row.site_status === "Tem site" ? "Tem site" : row.site_status === "Sem site" ? "Sem site" : "Não verificado",
  instagramUrl: row.profile_url,
  whatsappUrl:
    row.whatsapp_url ??
    (row.whatsapp_number ? `https://wa.me/${row.whatsapp_number}` : undefined),
  whatsappNumber:
    row.whatsapp_number ??
    row.whatsapp_url?.match(/(?:wa\.me\/|phone=)(\d{8,15})/i)?.[1] ??
    undefined,
  offer: row.offer_suggestion?.toLowerCase().includes("domínio") ? "Com domínio" : "Sem domínio",
  amount: row.offer_suggestion?.toLowerCase().includes("domínio") ? 250 : 200,
  paymentStatus: "Não aprovado",
  activities: [{ id: index + 1, kind: "validation", title: "Importado do Excel", detail: row.professional_evidence ?? "Aguardando validação manual do perfil.", time: "Importado agora", author: "Sistema" }],
  preview: {
    status: row.preview_url
      ? row.stage === "Aprovação"
        ? "approved"
        : "ready"
      : "none",
    version: row.preview_version ?? undefined,
    fileName: row.preview_file_name ?? undefined,
    publicUrl: row.preview_url ?? undefined,
    requiresLogin: Boolean(row.preview_requires_login),
    siteUrl: row.preview_site_url ?? undefined,
    sourcePath: row.preview_source_path ?? undefined,
    slug: row.preview_slug ?? undefined,
    publicSlug: row.handle.replace(/^@/, ""),
    checklist: {
      index: Boolean(row.preview_url),
      relativePaths: Boolean(row.preview_url),
      protectedAccess: Boolean(row.preview_url),
    },
  },
});

const toDbPatch = (lead: Lead) => ({
  priority_marked: lead.priority === "Urgente" || lead.priority === "Alta",
  priority: lead.priority,
  stage: lead.stage,
  owner: lead.owner,
  site_status: lead.siteStatus,
  validation_status: lead.validationStatus,
  is_validated: lead.validationStatus === "valid",
  validated_at: lead.validatedAt ?? null,
  discard_reason: lead.discardReason ?? null,
  next_action: lead.nextAction,
  next_action_at: lead.nextActionAt ?? null,
  preview_url: lead.preview.publicUrl ?? null,
  preview_requires_login: lead.preview.requiresLogin ?? false,
  preview_file_name: lead.preview.fileName ?? null,
  preview_version: lead.preview.version ?? null,
  preview_slug: lead.preview.slug ?? null,
  preview_site_url: lead.preview.siteUrl ?? null,
  preview_source_path: lead.preview.sourcePath ?? null,
  prospecting_done: lead.initialMessageSent,
  has_whatsapp: Boolean(lead.whatsappUrl),
  whatsapp_url: lead.whatsappUrl ?? null,
  updated_at: new Date().toISOString(),
});

const MESSAGE_TEMPLATES_STORAGE_KEY = "oblix-message-templates-v2";

const loadMessageTemplates = () => {
  try {
    const saved = window.localStorage.getItem(MESSAGE_TEMPLATES_STORAGE_KEY);
    if (!saved) return initialTemplates;
    const parsed = JSON.parse(saved) as MessageTemplate[];
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : initialTemplates;
  } catch {
    return initialTemplates;
  }
};

export default function App() {
  const devPreview =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).has("preview");
  const [leads, setLeads] = useState<Lead[]>(() => initialLeads);
  const [authReady, setAuthReady] = useState(!supabaseConfigured);
  const [session, setSession] = useState<Awaited<ReturnType<NonNullable<typeof supabase>["auth"]["getSession"]>>["data"]["session"]>(null);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [backendLoading, setBackendLoading] = useState(Boolean(supabaseConfigured));
  const [templates, setTemplates] = useState<MessageTemplate[]>(
    loadMessageTemplates,
  );
  const [restoredWorkspace] = useState(loadCrmWorkspace);
  const [activeNav, setActiveNav] = useState<NavKey>(
    () => restoredWorkspace.activeNav ?? "dashboard",
  );
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(
    () => restoredWorkspace.selectedLeadId ?? null,
  );
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingUndo, setPendingUndo] = useState<UndoDeleteState | null>(null);
  const [undoCountdown, setUndoCountdown] = useState(0);
  const [publishingPreviewForId, setPublishingPreviewForId] = useState<number | null>(null);
  const [deletingLeadId, setDeletingLeadId] = useState<number | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = window.localStorage.getItem("oblix-theme");
    return saved === "light" ? "light" : "dark";
  });
  const toastTimeoutRef = useRef<number | null>(null);
  const undoTimeoutRef = useRef<number | null>(null);
  const undoCountdownRef = useRef<number | null>(null);
  const pendingUndoRef = useRef<UndoDeleteState | null>(null);
  const previewRequiresLoginColumnSupported = useRef<boolean | null>(null);
  const prospectingDoneColumnSupported = useRef<boolean | null>(null);
  const leadsRef = useRef(leads);
  const sessionUserId = session?.user.id ?? null;

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setAuthReady(true);
      if (!data.session) setBackendLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setAuthReady(true);
      if (!next) setBackendLoading(false);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !session) return;
    let active = true;
    setBackendLoading(true);
    const leadsRequest = supabase
      .from("leads")
      .select("*, lead_batches(id, name, week_start, status)")
      .order("priority_marked", { ascending: false })
      .order("created_at", { ascending: true });
    const profileRequest = supabase
      .from("profiles")
      .select("display_name, role")
      .eq("user_id", session.user.id)
      .maybeSingle();

    void Promise.all([leadsRequest, profileRequest]).then(
      ([{ data, error }, { data: profileData }]) => {
        if (!active) return;
        if (!error && data) {
          const mapped = data.map((row, index) =>
            mapDbLead(row as DbLead, index),
          );
          setLeads(mapped);
          if (
            !restoredWorkspace.activeNav &&
            mapped.some((lead) => lead.validationStatus === "pending")
          ) {
            setActiveNav("validation");
          }
        }
        setCurrentProfile((profileData as UserProfile | null) ?? null);
        setBackendLoading(false);
        if (error) showToast(`Não foi possível carregar os leads: ${error.message}`);
      },
    );
    return () => {
      active = false;
    };
  }, [restoredWorkspace.activeNav, sessionUserId]);

  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === selectedLeadId) ?? null,
    [leads, selectedLeadId],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("oblix-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(
      MESSAGE_TEMPLATES_STORAGE_KEY,
      JSON.stringify(templates),
    );
  }, [templates]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        CRM_WORKSPACE_STORAGE_KEY,
        JSON.stringify({ activeNav, selectedLeadId }),
      );
    } catch {
      // If storage is unavailable, the CRM continues normally without restoring context.
    }
  }, [activeNav, selectedLeadId]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [activeNav, selectedLeadId]);

  useEffect(
    () => () => {
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
      if (undoTimeoutRef.current !== null) {
        window.clearTimeout(undoTimeoutRef.current);
      }
      if (undoCountdownRef.current !== null) {
        window.clearInterval(undoCountdownRef.current);
      }
      pendingUndoRef.current = null;
    },
    [],
  );

  const showToast = (message: string, durationMs = 3200) => {
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToast(message);
    toastTimeoutRef.current = window.setTimeout(() => setToast(null), durationMs);
  };

  const clearUndoCountdown = () => {
    if (undoTimeoutRef.current !== null) {
      window.clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    if (undoCountdownRef.current !== null) {
      window.clearInterval(undoCountdownRef.current);
      undoCountdownRef.current = null;
    }
  };

  const insertLeadAtIndex = (current: Lead[], lead: Lead, index: number) => {
    const next = [...current];
    const safeIndex = Math.max(0, Math.min(index, next.length));
    next.splice(safeIndex, 0, lead);
    return next;
  };

  const finalizeLeadDeletion = async (pending: UndoDeleteState) => {
    const { lead, index } = pending;
    try {
      if (supabase && session && lead.remoteId) {
        const { error } = await supabase
          .from("leads")
          .delete()
          .eq("id", lead.remoteId);
        if (error) {
          throw new Error(error.message);
        }
      }

      await removeStorageArtifacts(lead);
      showToast(`${lead.handle} removido permanentemente.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "NÃ£o foi possÃ­vel remover no momento.";
      setLeads((current) => insertLeadAtIndex(current, lead, index));
      showToast(`NÃ£o foi possÃ­vel remover ${lead.handle}: ${message}`);
    } finally {
      if (deletingLeadId === lead.id) setDeletingLeadId(null);
      if (pendingUndoRef.current?.lead.id === lead.id) {
        pendingUndoRef.current = null;
        setPendingUndo(null);
        setUndoCountdown(0);
      }
    }
  };

  const undoLeadDeletion = () => {
    const pending = pendingUndoRef.current;
    if (!pending) return;

    clearUndoCountdown();
    setPendingUndo(null);
    setUndoCountdown(0);
    pendingUndoRef.current = null;
    setDeletingLeadId((current) => (current === pending.lead.id ? null : current));
    setLeads((current) => insertLeadAtIndex(current, pending.lead, pending.index));
    showToast(`${pending.lead.handle} restaurado.`);
  };

  const resolvePreviewFolderFromUrl = (siteUrl?: string | null) => {
    if (!siteUrl) return null;
    try {
      const parsed = new URL(siteUrl);
      const marker = "/preview-content/";
      const markerIndex = parsed.pathname.indexOf(marker);
      if (markerIndex < 0) return null;

      const pathTail = parsed.pathname
        .slice(markerIndex + marker.length)
        .split("/")
        .filter(Boolean);
      const [token, slug, version] = pathTail;
      if (!token || !slug || !version) return null;
      return `${token}/${slug}/${version}`;
    } catch {
      return null;
    }
  };

  const collectStoragePaths = async (
    bucket: string,
    prefix: string,
  ): Promise<string[]> => {
    if (!supabase) return [];
    const bucketApi = supabase.storage.from(bucket);
    const collected: string[] = [];

    const gather = async (folder: string) => {
      const { data, error } = await bucketApi.list(folder, {
        limit: 1000,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) {
        throw error;
      }
      for (const item of data) {
        const path = folder ? `${folder}/${item.name}` : item.name;
        if (item.metadata) {
          collected.push(path);
        } else {
          await gather(path);
        }
      }
    };

    await gather(prefix);
    return collected;
  };

  const removeStorageArtifacts = async (lead: Lead) => {
    if (!supabase) return;
    const removalTasks: Promise<void>[] = [];
    const errors: string[] = [];

    if (lead.preview.sourcePath) {
      const sourcePath = lead.preview.sourcePath;
      removalTasks.push(
        (async () => {
          const { error } = await supabase.storage
            .from("preview-zips")
            .remove([sourcePath]);
          if (error) throw error;
        })(),
      );
    }

    const siteFolder = resolvePreviewFolderFromUrl(lead.preview.siteUrl);
    if (siteFolder) {
      removalTasks.push(
        (async () => {
          const files = await collectStoragePaths("preview-sites", siteFolder);
          if (files.length === 0) return;
          const { error } = await supabase.storage
            .from("preview-sites")
            .remove(files);
          if (error) throw error;
        })(),
      );
    }

    const results = await Promise.allSettled(removalTasks);
    results.forEach((result) => {
      if (result.status === "rejected") {
        errors.push(
          result.reason instanceof Error
            ? result.reason.message
            : "Falha ao remover arquivos do preview.",
        );
      }
    });
    if (errors.length > 0) {
      console.warn(`Falha na limpeza do lead ${lead.handle}:`, errors);
    }
  };

  const signOut = async () => {
    if (!supabase || signingOut) return;
    setSigningOut(true);
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      setSigningOut(false);
      showToast(`Não foi possível sair: ${error.message}`);
      return;
    }
    window.sessionStorage.removeItem(CRM_WORKSPACE_STORAGE_KEY);
    window.sessionStorage.removeItem("oblix-crm-validation-workspace-v2");
    window.sessionStorage.removeItem("oblix-crm-prospecting-workspace-v1");
    setCurrentProfile(null);
    setSelectedLeadId(null);
    setModal(null);
    setSession(null);
    setBackendLoading(false);
    setSigningOut(false);
  };

  const isColumnMissingError = (message: string, column: string) => {
    const normalized = message.toLowerCase();
    return (
      normalized.includes(column) &&
      /(does not exist|coluna|doesn't exist|não existe|não foi encontrada|not found|not exist|undefined column)/i.test(
        message,
      )
    );
  };

  const setInitialMessageSent = (leadId: number, initialMessageSent: boolean) => {
    updateLead(leadId, (lead) => ({
      ...lead,
      initialMessageSent,
    }));
    showToast(
      initialMessageSent
        ? "Mensagem inicial marcada como enviada."
        : "Lead marcado como ainda não contatado.",
    );
  };

  const updateWhatsAppNumber = (
    leadId: number,
    whatsappNumber: string | null,
  ) => {
    updateLead(leadId, (lead) => ({
      ...lead,
      whatsappNumber: whatsappNumber ?? undefined,
      whatsappUrl: whatsappNumber
        ? `https://wa.me/${whatsappNumber}`
        : undefined,
    }));
    showToast(
      whatsappNumber
        ? "WhatsApp salvo no lead."
        : "WhatsApp removido do lead.",
    );
  };

  const saveLeadPatch = async (lead: Lead) => {
    if (!supabase || !session || !lead.remoteId) return;

    const patch = toDbPatch(lead);
    let currentPatch: Record<string, unknown> = patch;

    while (true) {
      const { error } = await supabase
        .from("leads")
        .update(currentPatch)
        .eq("id", lead.remoteId);

      if (!error) {
        previewRequiresLoginColumnSupported.current =
          previewRequiresLoginColumnSupported.current === false
            ? false
            : true;
        prospectingDoneColumnSupported.current =
          prospectingDoneColumnSupported.current === false ? false : true;
        return;
      }

      const message = error.message ?? "";
      let didRemoveColumn = false;
      const fallbackPatch: Record<string, unknown> = { ...currentPatch };

      if (
        previewRequiresLoginColumnSupported.current !== false &&
        isColumnMissingError(message, "preview_requires_login")
      ) {
        delete fallbackPatch.preview_requires_login;
        previewRequiresLoginColumnSupported.current = false;
        didRemoveColumn = true;
      }

      if (
        prospectingDoneColumnSupported.current !== false &&
        isColumnMissingError(message, "prospecting_done")
      ) {
        delete fallbackPatch.prospecting_done;
        prospectingDoneColumnSupported.current = false;
        didRemoveColumn = true;
      }

      if (!didRemoveColumn) {
        showToast(`Não foi possível salvar: ${message}`);
        return;
      }

      currentPatch = fallbackPatch;
    }
  };

  const updateLead = (leadId: number, updater: (lead: Lead) => Lead) => {
    const current = leadsRef.current;
    const existing = current.find((lead) => lead.id === leadId);
    if (!existing) return;

    const changed = updater(existing);
    const next = current.map((lead) => (lead.id === leadId ? changed : lead));
    leadsRef.current = next;
    setLeads(next);
    void saveLeadPatch(changed);
  };

  const deleteLead = async (leadId: number) => {
    const targetLead = leads.find((lead) => lead.id === leadId);
    if (!targetLead) return;

    const confirmRemoval = window.confirm(
      `Remover permanentemente ${targetLead.handle}?`,
    );
    if (!confirmRemoval) return;
    const confirmFinal = window.confirm(
      "Essa exclusao tem 10 segundos para desfazer.",
    );
    if (!confirmFinal) return;
    if (pendingUndoRef.current) {
      showToast("Termine a exclusao anterior (desfazer ou aguardar) antes de excluir outro.");
      return;
    }

    setDeletingLeadId(leadId);

    const pending: UndoDeleteState = {
      lead: targetLead,
      index: leads.findIndex((lead) => lead.id === leadId),
    };

    setLeads((current) => current.filter((lead) => lead.id !== leadId));
    if (selectedLeadId === leadId) {
      setSelectedLeadId(null);
      setActiveNav("leads");
    }

    pendingUndoRef.current = pending;
    setPendingUndo(pending);
    setUndoCountdown(Math.ceil(UNDO_DELETE_TIMEOUT_MS / 1000));
    clearUndoCountdown();

    const startedAt = Date.now();
    undoCountdownRef.current = window.setInterval(() => {
      const remainingMs = Math.max(
        0,
        UNDO_DELETE_TIMEOUT_MS - (Date.now() - startedAt),
      );
      const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
      setUndoCountdown(remainingSeconds);

      if (remainingMs <= 0) {
        clearUndoCountdown();
      }
    }, 1000);

    undoTimeoutRef.current = window.setTimeout(() => {
      const currentPending = pendingUndoRef.current;
      if (!currentPending || currentPending.lead.id !== leadId) {
        return;
      }

      pendingUndoRef.current = null;
      setPendingUndo(null);
      setUndoCountdown(0);
      clearUndoCountdown();
      void finalizeLeadDeletion(currentPending);
    }, UNDO_DELETE_TIMEOUT_MS);

    showToast(`${targetLead.handle} removido temporariamente.`, UNDO_DELETE_TIMEOUT_MS + 400);
  };
  const addActivity = (
    lead: Lead,
    activity: Omit<Activity, "id" | "time">,
  ): Lead => ({
    ...lead,
    activities: [
      ...lead.activities,
      {
        ...activity,
        id: Date.now(),
        time: `Hoje, ${nowLabel()}`,
      },
    ],
  });

  const selectLead = (leadId: number) => {
    setSelectedLeadId(leadId);
    setActiveNav("leads");
  };

  const navigate = (key: NavKey) => {
    setActiveNav(key);
    setSelectedLeadId(null);
  };

  const changeStage = (stage: Stage) => {
    if (!selectedLead) return;
    updateLead(selectedLead.id, (lead) =>
      addActivity(
        { ...lead, stage },
        {
          kind: "note",
          title: `Etapa alterada para ${stage}`,
          detail: "O lead avançou no fluxo de prospecção.",
          author: "Você",
        },
      ),
    );
    showToast(`Etapa atualizada para ${stage}.`);
  };

  const changePriority = (leadId: number, priority: Priority) => {
    updateLead(leadId, (lead) => ({ ...lead, priority }));
    showToast(`Prioridade alterada para ${priority}.`);
  };

  const changeOwner = (leadId: number, owner: Owner) => {
    updateLead(leadId, (lead) => {
      if (lead.owner === owner) return lead;
      return addActivity(
        { ...lead, owner },
        {
          kind: "note",
          title: `Responsável alterado para ${ownerLabels[owner]}`,
          detail: "Responsável da prospecção atualizado.",
          author: "Você",
        },
      );
    });
    showToast(`Responsável atualizado para ${ownerLabels[owner]}.`);
  };

  const validateLead = (
    leadId: number,
    settings: {
      priority: Priority;
      owner: Owner;
      nextAction: string;
      day: WeekDay;
      time: string;
    },
  ) => {
    updateLead(leadId, (lead) =>
      addActivity(
        {
          ...lead,
          validationStatus: "valid",
          validatedAt: new Date().toISOString(),
          discardReason: undefined,
          stage: "Contatar",
          priority: settings.priority,
          owner: settings.owner,
          nextAction: settings.nextAction,
          nextActionAt: scheduleToIso(settings.day, settings.time),
          scheduleDay: settings.day,
          dueTime: settings.time,
          overdue: false,
        },
        {
          kind: "validation",
          title: "Lead aprovado para prospecção",
          detail: `${settings.priority} · ${settings.nextAction} · ${settings.day}, ${settings.time}.`,
          author: "Você",
        },
      ),
    );
    showToast("Lead validado e enviado para a fila de prospecção.");
  };

  const validateBatch = (
    batchName: string,
    settings: BatchValidationSettings,
  ) => {
    const targets = leads.filter(
      (lead) =>
        lead.batchName === batchName && lead.validationStatus === "pending",
    );
    if (targets.length === 0) {
      showToast("Este lote não possui leads pendentes.");
      return;
    }

    const validatedAt = new Date().toISOString();
    setLeads((current) =>
      current.map((lead) => {
        if (
          lead.batchName !== batchName ||
          lead.validationStatus !== "pending"
        ) {
          return lead;
        }
        return addActivity(
          {
            ...lead,
            validationStatus: "valid",
            validatedAt,
            discardReason: undefined,
            archived: false,
            stage: "Contatar",
            priority: "Normal",
            owner: settings.owner,
            nextAction: "Enviar mensagem inicial",
            nextActionAt: undefined,
            scheduleDay: "Hoje",
            dueTime: "A definir",
            overdue: false,
          },
          {
            kind: "validation",
            title: "Lead aprovado junto com o lote",
            detail:
              "Prioridade Normal (sem qualificação individual) · Enviar mensagem inicial.",
            author: "Você",
          },
        );
      }),
    );

    const remoteIds = targets.flatMap((lead) =>
      lead.remoteId ? [lead.remoteId] : [],
    );
    if (supabase && session && remoteIds.length > 0) {
      void supabase
        .from("leads")
        .update({
          validation_status: "valid",
          is_validated: true,
          validated_at: validatedAt,
          validated_by: session.user.id,
          discard_reason: null,
          stage: "Contatar",
          priority: "Normal",
          priority_marked: false,
          owner: settings.owner,
          next_action: "Enviar mensagem inicial",
          next_action_at: null,
          updated_at: validatedAt,
        })
        .eq("validation_status", "pending")
        .in("id", remoteIds)
        .then(({ error }) => {
          if (error) {
            showToast(
              `Os leads foram atualizados na tela, mas não foi possível salvar: ${error.message}`,
            );
          }
        });
    }

    showToast(
      `${targets.length} leads aprovados com prioridade normal e enviados para Leads.`,
    );
  };

  const discardLead = (leadId: number, reason: string) => {
    updateLead(leadId, (lead) =>
      addActivity(
        {
          ...lead,
          validationStatus: "discarded",
          validatedAt: new Date().toISOString(),
          discardReason: reason,
          archived: true,
          nextAction: "Nenhuma ação necessária",
        },
        {
          kind: "validation",
          title: "Lead descartado na validação",
          detail: reason,
          author: "Você",
        },
      ),
    );
    showToast("Lead descartado e removido da fila operacional.");
  };

  const createManualLead = async (lead: Lead) => {
    const alreadyExists = leads.some(
      (currentLead) => currentLead.handle.toLowerCase() === lead.handle.toLowerCase(),
    );
    if (alreadyExists) {
      showToast("Este perfil j\u00e1 existe no CRM.");
      return;
    }

    if (!supabase || !session) {
      setLeads((current) => [lead, ...current]);
      setModal(null);
      showToast(`${lead.handle} adicionado à validação manual.`);
      return;
    }

    const manualPayload = {
      handle: lead.handle,
      full_name: lead.fullName ?? null,
      profile_url: lead.instagramUrl,
      segment: lead.category,
      owner: lead.owner,
      priority: lead.priority,
      priority_marked:
        lead.priority === "Urgente" || lead.priority === "Alta",
      stage: "Validar",
      validation_status: "pending",
      is_validated: false,
      site_status: "Não verificado",
      prospecting_done: false,
      has_instagram: true,
      has_whatsapp: Boolean(lead.whatsappUrl),
      whatsapp_url: lead.whatsappUrl ?? null,
      source_name: "Cadastro manual",
      source_type: "manual",
      next_action: "Abrir perfil e validar",
    };
    let insertPayload: Record<string, unknown> = manualPayload;
    let { data, error } = await supabase
      .from("leads")
      .insert(insertPayload)
      .select("*, lead_batches(id, name, week_start, status)")
      .single();
    if (
      error &&
      isColumnMissingError(error.message ?? "", "prospecting_done") &&
      prospectingDoneColumnSupported.current !== false
    ) {
      const fallbackPayload = { ...insertPayload };
      delete fallbackPayload.prospecting_done;
      prospectingDoneColumnSupported.current = false;
      const fallbackResponse = await supabase
        .from("leads")
        .insert(fallbackPayload)
        .select("*, lead_batches(id, name, week_start, status)")
        .single();
      data = fallbackResponse.data;
      error = fallbackResponse.error;
    }

    if (error || !data) {
      showToast(
        error?.code === "23505"
          ? "Este perfil já existe no CRM."
          : `Não foi possível adicionar: ${error?.message ?? "erro desconhecido"}`,
      );
      return;
    }

    setLeads((current) => [mapDbLead(data as DbLead, current.length), ...current]);
    setModal(null);
    setActiveNav("validation");
    showToast(`${lead.handle} adicionado à validação manual.`);
  };

  const importBatch = async (batchName: string, file: File) => {
    let parsed: ImportedLead[];
    try {
      parsed = await parseLeadFile(file);
    } catch {
      showToast("Não foi possível ler a planilha. Confira a primeira aba.");
      return;
    }

    const existingHandles = new Set(
      leads.map((lead) => lead.handle.toLowerCase()),
    );
    let fresh = parsed.filter(
      (lead) => !existingHandles.has(lead.handle.toLowerCase()),
    );
    if (fresh.length === 0) {
      showToast(
        parsed.length
          ? "Todos os perfis da planilha já existem no CRM."
          : "Nenhum perfil do Instagram foi encontrado na planilha.",
      );
      return;
    }

    if (!supabase || !session) {
      const imported = fresh.map<Lead>((row, index) => ({
        id: Date.now() + index,
        fullName: row.fullName,
        handle: row.handle,
        initialMessageSent: false,
        category: row.segment ?? "A classificar",
        validationStatus: "pending",
        batchName,
        sourceType: "instagram",
        owner: "Você",
        stage: "Validar",
        nextAction: "Abrir perfil e validar",
        priority: row.priority,
        scheduleDay: "Hoje",
        dueTime: "A definir",
        siteStatus: "Não verificado",
        instagramUrl: row.profileUrl,
        offer: "Sem domínio",
        amount: 200,
        paymentStatus: "Não aprovado",
        activities: [
          {
            id: Date.now() + index,
            kind: "validation",
            title: `Importado no ${batchName}`,
            detail: `Origem: ${file.name}`,
            time: `Hoje, ${nowLabel()}`,
            author: "Sistema",
          },
        ],
        preview: {
          status: "none",
          requiresLogin: false,
          publicSlug: row.handle.replace(/^@/, ""),
          checklist: {
            index: false,
            relativePaths: false,
            protectedAccess: false,
          },
        },
      }));
      setLeads((current) => [...imported, ...current]);
      setModal(null);
      setActiveNav("validation");
      showToast(`${imported.length} leads adicionados ao ${batchName}.`);
      return;
    }

    const { data: remoteLeads, error: remoteLeadsError } = await supabase
      .from("leads")
      .select("handle")
      .in(
        "handle",
        parsed.map((lead) => lead.handle),
      );
    if (remoteLeadsError) {
      showToast(`N\u00e3o foi poss\u00edvel verificar perfis existentes: ${remoteLeadsError.message}`);
      return;
    }

    const remoteHandles = new Set(
      (remoteLeads ?? []).map((lead) => lead.handle.toLowerCase()),
    );
    fresh = fresh.filter((lead) => !remoteHandles.has(lead.handle.toLowerCase()));
    if (fresh.length === 0) {
      showToast("Todos os perfis da planilha j\u00e1 existem no CRM.");
      return;
    }

    const monday = new Date();
    const deltaToMonday = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - deltaToMonday);
    const weekStart = monday.toISOString().slice(0, 10);
    const { data: existingBatch, error: existingBatchError } = await supabase
      .from("lead_batches")
      .select("id, name")
      .eq("name", batchName)
      .maybeSingle();
    if (existingBatchError) {
      showToast(`N\u00e3o foi poss\u00edvel localizar o lote: ${existingBatchError.message}`);
      return;
    }

    const { data: createdBatch, error: batchError } = existingBatch
      ? { data: existingBatch, error: null }
      : await supabase
      .from("lead_batches")
      .insert({
        name: batchName,
        week_start: weekStart,
        source_file: file.name,
        status: "active",
        created_by: session.user.id,
      })
      .select("id, name")
      .single();

    const batch = createdBatch;

    if (batchError || !batch) {
      showToast(
        batchError?.code === "23505"
          ? "Já existe um lote com esse nome."
          : `Não foi possível criar o lote: ${batchError?.message ?? "erro desconhecido"}`,
      );
      return;
    }

    let rows = fresh.map((lead) => ({
      handle: lead.handle,
      full_name: lead.fullName ?? null,
      profile_url: lead.profileUrl,
      priority_marked:
        lead.priority === "Urgente" || lead.priority === "Alta",
      priority: lead.priority,
      segment: lead.segment ?? null,
      stage: "Validar",
      site_status: "Não verificado",
      owner: "Você",
      is_validated: false,
      prospecting_done: false,
      has_instagram: true,
      has_whatsapp: Boolean(lead.whatsappUrl),
      whatsapp_url: lead.whatsappUrl ?? null,
      source_name: file.name,
      source_type: "instagram",
      validation_status: "pending",
      next_action: "Abrir perfil e validar",
      batch_id: batch.id,
    }));

    let { data, error } = await supabase
      .from("leads")
      .insert(rows)
      .select("*, lead_batches(id, name, week_start, status)");

    if (
      error &&
      isColumnMissingError(error.message ?? "", "prospecting_done") &&
      prospectingDoneColumnSupported.current !== false
    ) {
      prospectingDoneColumnSupported.current = false;
      rows = rows.map((row) => {
        const normalizedRow = { ...row };
        delete (normalizedRow as { prospecting_done?: boolean }).prospecting_done;
        return normalizedRow;
      });
      const retryResponse = await supabase
        .from("leads")
        .insert(rows)
        .select("*, lead_batches(id, name, week_start, status)");
      data = retryResponse.data;
      error = retryResponse.error;
    }

    if (error || !data) {
      showToast(
        error?.code === "23505"
          ? "Um destes perfis j\u00e1 foi inclu\u00eddo por outra pessoa. Atualize a tela e importe apenas os restantes."
          : `O lote foi criado, mas os leads falharam: ${error?.message}`,
      );
      return;
    }

    setLeads((current) => [
      ...data.map((row, index) => mapDbLead(row as DbLead, index)),
      ...current,
    ]);
    setModal(null);
    setActiveNav("validation");
    showToast(
      `${data.length} leads adicionados ao ${batchName}. ${parsed.length - fresh.length} duplicados ignorados.`,
    );
  };

  const updateMany = (ids: number[], patch: Partial<Lead>) => {
    ids.forEach((leadId) =>
      updateLead(leadId, (lead) => ({ ...lead, ...patch })),
    );
    showToast(`${ids.length} leads atualizados.`);
  };

  const addNote = (note: string) => {
    if (!selectedLead) return;
    updateLead(selectedLead.id, (lead) =>
      addActivity(lead, {
        kind: "note",
        title: "Observação adicionada",
        detail: note,
        author: "Você",
      }),
    );
    showToast("Observação adicionada ao histórico.");
  };

  const saveProspectingOutcome = (
    leadId: number,
    outcome: ProspectingOutcome,
    nextAction: string,
    scheduleDay: WeekDay,
    dueTime: string,
    note: string,
    initialMessageSent: boolean,
  ) => {
    const stageByOutcome: Partial<Record<ProspectingOutcome, Stage>> = {
      "Mensagem enviada": "Contatar",
      "Sem resposta": "Contatar",
      Interessado: "Interessado",
      "Não interessado": "Contatar",
      "Retornar depois": "Contatar",
      "Já possui site": "Contatar",
    };
    const alreadyHasSite = outcome === "Já possui site";
    const markedInitialMessageSent = Boolean(
      initialMessageSent || outcome === "Mensagem enviada",
    );
    updateLead(leadId, (lead) =>
      addActivity(
        {
          ...lead,
          initialMessageSent: markedInitialMessageSent,
          stage: stageByOutcome[outcome] ?? lead.stage,
          nextAction: alreadyHasSite
            ? "Nenhuma ação necessária"
            : nextAction,
          scheduleDay: alreadyHasSite ? lead.scheduleDay : scheduleDay,
          dueTime: alreadyHasSite ? lead.dueTime : dueTime,
          overdue: false,
          archived: outcome === "Não interessado" || alreadyHasSite,
          siteStatus: alreadyHasSite ? "Tem site" : lead.siteStatus,
        },
        {
          kind:
            outcome === "Interessado"
              ? "interest"
              : alreadyHasSite
                ? "note"
                : "message",
          title: outcome,
          detail:
            note.trim() ||
            (alreadyHasSite
              ? "Possui site ativo. Lead retirado da fila de prospecção."
              : `Resultado registrado. Próximo passo: ${nextAction}.`),
          author: "Você",
        },
      ),
    );
    showToast(
      alreadyHasSite
        ? "Lead marcado como já possui site e retirado da fila."
        : `${outcome} registrado. Próximo lead aberto.`,
    );
  };

  const uploadPreview = async (file: File) => {
    if (!selectedLead || !supabase || !session || !selectedLead.remoteId) {
      showToast("Entre no CRM conectado ao Supabase para publicar o preview.");
      return;
    }
    if (!/\.zip$/i.test(file.name) || file.size === 0) {
      showToast("Selecione um arquivo ZIP válido.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      showToast("O ZIP pode ter no máximo 20 MB.");
      return;
    }

    const leadId = selectedLead.id;
    const remoteId = selectedLead.remoteId;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
    const sourcePath = `${remoteId}/source/${Date.now()}-${safeName}`;
    setPublishingPreviewForId(leadId);
    try {
      const { error: uploadError } = await supabase.storage
        .from("preview-zips")
        .upload(sourcePath, file, {
          contentType: "application/zip",
          upsert: false,
        });
      if (uploadError) throw uploadError;

      if (!supabaseUrl || !supabasePublishableKey) {
        throw new Error("A conexão com o Supabase não está configurada.");
      }

      const publishResponse = await fetch(
        `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/publish-preview`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: supabasePublishableKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ leadId: remoteId, sourcePath }),
        },
      );
      const data = (await publishResponse.json().catch(() => null)) as {
        success?: boolean;
        previewUrl?: string;
        previewSlug?: string;
        siteUrl?: string;
        version?: number;
        hasIndex?: boolean;
        relativePaths?: boolean;
        error?: string;
      } | null;
      if (
        !publishResponse.ok ||
        !data?.success ||
        !data.previewUrl ||
        !data.siteUrl
      ) {
        throw new Error(
          data?.error ??
            "Não foi possível publicar o preview. Verifique o conteúdo do ZIP.",
        );
      }
      const previewUrl = data.previewUrl;
      const siteUrl = data.siteUrl;

      updateLead(leadId, (lead) =>
        addActivity(
          {
            ...lead,
            stage: "Preview",
            nextAction: "Enviar acesso ao cliente",
            preview: {
              ...lead.preview,
              status: "ready",
              requiresLogin: lead.preview.requiresLogin,
              version: data.version ?? (lead.preview.version ?? 0) + 1,
              fileName: file.name,
              publicUrl: previewUrl,
              siteUrl,
              sourcePath,
              slug: data.previewSlug ?? previewUrl.split("/").pop(),
              checklist: {
                index: Boolean(data.hasIndex),
                relativePaths: Boolean(data.relativePaths),
                protectedAccess: true,
              },
            },
          },
          {
            kind: "preview",
            title: "Preview publicado automaticamente",
            detail: `${file.name} foi validado e a versão ${data.version ?? 1} está pronta para o cliente.`,
            author: "Você",
          },
        ),
      );
      showToast("Preview publicado. O link do cliente está pronto para enviar.");
    } catch (uploadError) {
      await supabase.storage
        .from("preview-zips")
        .remove([sourcePath])
        .catch(() => undefined);
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : "Não foi possível publicar este ZIP.";
      showToast(message);
    } finally {
      setPublishingPreviewForId(null);
    }
  };
  const approvePreview = (leadId: number) => {
    updateLead(leadId, (lead) =>
      addActivity(
        {
          ...lead,
          stage: "Aprovação",
          paymentStatus: "Aguardando PIX",
          nextAction: "Enviar chave PIX",
          preview: { ...lead.preview, status: "approved" },
        },
        {
          kind: "approval",
          title: "Preview aprovado",
          detail: `Cliente aprovou a versão ${lead.preview.version ?? 1}.`,
          author: "Cliente",
        },
      ),
    );
    setModal(null);
    showToast("Preview aprovado. O pagamento continua pendente.");
  };

  const requestChanges = (leadId: number) => {
    updateLead(leadId, (lead) =>
      addActivity(
        {
          ...lead,
          stage: "Preview",
          nextAction: "Revisar ajustes solicitados",
        },
        {
          kind: "note",
          title: "Cliente solicitou ajustes",
          detail: "Solicitação registrada para revisão da versão atual.",
          author: "Cliente",
        },
      ),
    );
    setModal(null);
    showToast("Solicitação de ajustes registrada.");
  };

  const markPaid = () => {
    if (!selectedLead) return;
    updateLead(selectedLead.id, (lead) =>
      addActivity(
        {
          ...lead,
          stage: "Pagamento",
          paymentStatus: "Pago",
          nextAction: "Preparar entrega",
        },
        {
          kind: "note",
          title: "Pagamento confirmado",
          detail: `Pagamento de R$ ${lead.amount} confirmado manualmente.`,
          author: "Você",
        },
      ),
    );
    showToast("Pagamento confirmado. Próxima etapa: entrega.");
  };

  const openClientPreview = (leadId?: number) => {
    const id = leadId ?? selectedLead?.id;
    const lead = leads.find((item) => item.id === id);
    if (!lead) return;

    const previewSource = resolveLeadPreviewSource(lead.preview);
    if (!previewSource.url) {
      showToast(
        previewSource.message ??
          "Republique o lead para gerar a URL de preview protegida.",
      );
      return;
    }

    window.open(previewSource.url, "_blank", "noopener,noreferrer");
    if (id) {
      setModal({ type: "client-preview", leadId: id });
    }
  };

  const openClientSharePreview = (leadId?: number) => {
    const id = leadId ?? selectedLead?.id;
    const lead = leads.find((item) => item.id === id);
    if (!lead) return;

    const previewSource = resolveLeadPreviewSource(lead.preview, { forClient: true });
    if (!previewSource.url) {
      showToast(
        previewSource.message ??
          "Republique o lead para gerar a URL de preview protegida.",
      );
      return;
    }

    window.open(previewSource.url, "_blank", "noopener,noreferrer");
  };

  const updatePreviewAccessMode = (
    leadId: number,
    requiresLogin: boolean,
  ) => {
    updateLead(leadId, (lead) => ({
      ...lead,
      preview: {
        ...lead.preview,
        requiresLogin,
      },
    }));
  };

  const copyPreviewLink = () => {
    if (!selectedLead) return;
    const previewSource = resolveLeadPreviewSource(selectedLead.preview, {
      forClient: true,
    });
    if (!previewSource.url) {
      showToast(
        previewSource.message ??
          "Republique o lead para gerar a URL de preview protegida.",
      );
      return;
    }
    void navigator.clipboard
      .writeText(previewSource.url)
      .then(() => showToast("Link do cliente copiado."))
      .catch(() => showToast("Não foi possível copiar automaticamente. Abra o link para copiar."));
  };

  const openMessages = (leadId?: number) => {
    const id = leadId ?? selectedLead?.id;
    if (id) setModal({ type: "scripts", leadId: id });
  };

  const createTemplate = () => {
    const id = Date.now();
    setTemplates((current) => [
      {
        id,
        title: "Nova mensagem",
        category: current[0]?.category ?? "Prospecção",
        message: "Olá, [nome]! ",
        favorite: false,
        shared: true,
        updatedLabel: "Criado agora",
      },
      ...current,
    ]);
    showToast("Nova mensagem criada. Edite e salve quando terminar.");
    return id;
  };

  const duplicateTemplate = (id: number) => {
    const nextId = Date.now();
    setTemplates((current) => {
      const source = current.find((template) => template.id === id);
      if (!source) return current;
      return [
        {
          ...source,
          id: nextId,
          title: `${source.title} — cópia`,
          favorite: false,
          updatedLabel: "Duplicado agora",
        },
        ...current,
      ];
    });
    showToast("Mensagem duplicada.");
    return nextId;
  };

  const deleteTemplate = (id: number) => {
    if (templates.length <= 1) {
      showToast("Mantenha pelo menos uma mensagem cadastrada.");
      return;
    }
    setTemplates((current) =>
      current.filter((template) => template.id !== id),
    );
    showToast("Mensagem excluída.");
  };

  const updateTemplate = (
    id: number,
    patch: Partial<MessageTemplate>,
  ) => {
    setTemplates((current) =>
      current.map((template) =>
        template.id === id ? { ...template, ...patch } : template,
      ),
    );
  };

  if (supabaseConfigured && !authReady && !devPreview) {
    return <div className="auth-screen"><div className="auth-card"><strong>OBLIX CRM</strong><p>Verificando sua sessão segura…</p></div></div>;
  }
  if (supabaseConfigured && !session && !devPreview) {
    return <LoginScreen />;
  }
  if (backendLoading) {
    return <div className="auth-screen"><div className="auth-card"><strong>OBLIX CRM</strong><p>Carregando sua fila de leads…</p></div></div>;
  }

  let content;
  if (selectedLead) {
    content = (
      <LeadDetail
        lead={selectedLead}
        onBack={() => setSelectedLeadId(null)}
        onDeleteLead={deleteLead}
        deletingLead={deletingLeadId === selectedLead.id}
        onStageChange={changeStage}
        onOwnerChange={(owner) => changeOwner(selectedLead.id, owner)}
        onAddNote={addNote}
        onUpload={uploadPreview}
        previewPublishing={publishingPreviewForId === selectedLead.id}
        onOpenClientPreview={() => openClientSharePreview(selectedLead.id)}
        onOpenTeamPreview={() => openClientPreview(selectedLead.id)}
        onTogglePreviewMode={(requiresLogin) =>
          updatePreviewAccessMode(selectedLead.id, requiresLogin)
        }
        onCopyPreviewLink={copyPreviewLink}
        onMarkPaid={markPaid}
        onOpenMessages={() => openMessages()}
        onWhatsAppChange={(number) =>
          updateWhatsAppNumber(selectedLead.id, number)
        }
      />
    );
  } else if (activeNav === "dashboard") {
    content = (
      <Dashboard
        leads={leads.filter(
          (lead) => lead.validationStatus === "valid" && !lead.archived,
        )}
        onSelectLead={selectLead}
        onNewLead={() => setModal({ type: "new-lead" })}
        onImport={() => setModal({ type: "import" })}
        onOpenMessages={openMessages}
        onPriorityChange={changePriority}
        onDelete={deleteLead}
        deletingLeadId={deletingLeadId}
        onBulkOwner={(ids, owner) => updateMany(ids, { owner })}
        onBulkStage={(ids, stage) => updateMany(ids, { stage })}
        onBulkSchedule={(ids, scheduleDay) =>
          updateMany(ids, { scheduleDay, overdue: false })
        }
      />
    );
  } else if (activeNav === "validation") {
    content = (
      <ValidationQueue
        leads={leads}
        onValidate={validateLead}
        onValidateBatch={validateBatch}
        onDiscard={discardLead}
        onNewLead={() => setModal({ type: "new-lead" })}
        onImport={() => setModal({ type: "import" })}
      />
    );
  } else if (activeNav === "prospecting") {
    content = (
      <ProspectingBoard
        leads={leads.filter(
          (lead) => lead.validationStatus === "valid" && !lead.archived,
        )}
        onSelectLead={selectLead}
        onOpenMessages={openMessages}
        onPriorityChange={changePriority}
        onOwnerChange={changeOwner}
        onInitialMessageSent={setInitialMessageSent}
        onWhatsAppChange={updateWhatsAppNumber}
        onSaveOutcome={saveProspectingOutcome}
      />
    );
  } else if (activeNav === "leads") {
    content = (
      <LeadDirectory
        leads={leads.filter((lead) => lead.validationStatus === "valid")}
        onSelectLead={selectLead}
        onOpenMessages={openMessages}
        onPriorityChange={changePriority}
        onDelete={deleteLead}
        deletingLeadId={deletingLeadId}
      />
    );
  } else if (activeNav === "previews") {
    content = (
      <PreviewHub
        leads={leads.filter((lead) => lead.validationStatus === "valid")}
        onSelectLead={selectLead}
        onOpenClientPreview={openClientPreview}
      />
    );
  } else if (activeNav === "messages") {
    content = (
      <MessageManager
        templates={templates}
        onCreate={createTemplate}
        onDuplicate={duplicateTemplate}
        onDelete={deleteTemplate}
        onUpdate={updateTemplate}
        onSaved={(title) => showToast(`${title}: alterações salvas.`)}
        onCopied={(title) => showToast(`${title}: mensagem copiada.`)}
      />
    );
  } else {
    content = (
      <FinanceView
        leads={leads.filter((lead) => lead.validationStatus === "valid")}
      />
    );
  }

  const modalLead =
    modal?.type === "client-preview" || modal?.type === "scripts"
      ? leads.find((lead) => lead.id === modal.leadId)
      : undefined;

  return (
    <>
      <AppShell
        active={activeNav}
        theme={theme}
        profileName={
          currentProfile?.display_name ??
          session?.user.email?.split("@")[0] ??
          "Você"
        }
        profileEmail={session?.user.email ?? ""}
        profileRole={currentProfile?.role === "seller" ? "Vendedor" : "Sócio / dono"}
        signingOut={signingOut}
        onNavigate={navigate}
        onToggleTheme={() =>
          setTheme((current) => (current === "light" ? "dark" : "light"))
        }
        onSignOut={() => void signOut()}
      >
        {content}
      </AppShell>

      {modal?.type === "new-lead" && (
        <Modal title="Novo lead" onClose={() => setModal(null)}>
          <NewLeadForm
            onCancel={() => setModal(null)}
            onSubmit={(lead) => void createManualLead(lead)}
          />
        </Modal>
      )}

      {modal?.type === "import" && (
        <Modal title="Importar planilha" onClose={() => setModal(null)}>
          <ImportFlow
            onClose={() => setModal(null)}
            existingBatches={[...new Set(leads.map((lead) => lead.batchName))]}
            onComplete={importBatch}
          />
        </Modal>
      )}

      {modal?.type === "client-preview" && modalLead && (
        <Modal
          title={`Visão do cliente · ${modalLead.handle}`}
          onClose={() => setModal(null)}
          wide
        >
          <ClientPreview
            lead={modalLead}
            onApprove={() => approvePreview(modalLead.id)}
            onRequestChanges={() => requestChanges(modalLead.id)}
          />
        </Modal>
      )}

      {modal?.type === "scripts" && modalLead && (
        <Modal
          title={`Mensagens prontas · ${modalLead.handle}`}
          onClose={() => setModal(null)}
          wide
        >
          <MessageLibrary
            lead={modalLead}
            templates={templates}
            onCopied={(title) => showToast(`${title}: mensagem copiada.`)}
            onManage={() => {
              setModal(null);
              navigate("messages");
            }}
          />
        </Modal>
      )}

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <div className="toast-content">
            <span>{toast}</span>
            {pendingUndo && (
              <button
                type="button"
                className="button toast-action-button"
                onClick={() => void undoLeadDeletion()}
              >
                Desfazer {undoCountdown > 0 ? `(${undoCountdown}s)` : ""}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function NewLeadForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (lead: Lead) => void;
}) {
  const [handle, setHandle] = useState("");
  const [fullName, setFullName] = useState("");
  const [category, setCategory] = useState("");
  const [owner, setOwner] = useState<Owner>("Você");
  const [priority, setPriority] = useState<Priority>("Normal");
  const [whatsapp, setWhatsapp] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = handle.trim().replace(/^@?/, "@").toLowerCase();
    const slug = normalized
      .replace(/^@/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    onSubmit({
      id: Date.now(),
      handle: normalized,
      fullName: fullName.trim() || undefined,
      category: category.trim() || "A classificar",
      validationStatus: "pending",
      initialMessageSent: false,
      batchName: "Cadastro manual",
      sourceType: "manual",
      owner,
      stage: "Validar",
      nextAction: "Verificar site e perfil",
      priority,
      scheduleDay: "Hoje",
      dueTime: "A definir",
      siteStatus: "Não verificado",
      instagramUrl: `https://www.instagram.com/${normalized.replace("@", "")}/`,
      whatsappUrl: whatsapp.trim()
        ? `https://wa.me/${whatsapp.replace(/\D/g, "")}`
        : undefined,
      offer: "Sem domínio",
      amount: 200,
      paymentStatus: "Não aprovado",
      activities: [
        {
          id: Date.now(),
          kind: "validation",
          title: "Lead adicionado",
          detail: "Perfil incluído manualmente na fila de validação.",
          time: `Hoje, ${nowLabel()}`,
          author: "Você",
        },
      ],
      preview: {
        status: "none",
        requiresLogin: false,
        publicSlug: slug,
        checklist: {
          index: false,
          relativePaths: false,
          protectedAccess: false,
        },
      },
    });
  };

  return (
    <form className="form-stack" onSubmit={submit}>
      <label className="field">
        <span>Usuário do Instagram</span>
        <input
          value={handle}
          onChange={(event) => setHandle(event.target.value)}
          placeholder="@nomedoperfil"
          required
        />
      </label>
      <label className="field">
        <span>Segmento</span>
        <input
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="Ex.: Estética"
        />
      </label>
      <label className="field">
        <span>Nome do negócio ou profissional</span>
        <input
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Ex.: Clínica Aurora"
        />
      </label>
      <label className="field">
        <span>WhatsApp (opcional)</span>
        <input
          value={whatsapp}
          onChange={(event) => setWhatsapp(event.target.value)}
          placeholder="Ex.: 5511999999999"
          inputMode="tel"
        />
      </label>
      <div className="form-grid-two">
        <label className="field">
          <span>Responsável</span>
          <select
            value={owner}
            onChange={(event) => setOwner(event.target.value as Owner)}
          >
            {owners.map((teamOwner) => (
              <option key={teamOwner} value={teamOwner}>
                {ownerLabels[teamOwner]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Prioridade</span>
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as Priority)}
          >
            <option>Urgente</option>
            <option>Alta</option>
            <option>Normal</option>
            <option>Baixa</option>
          </select>
        </label>
      </div>
      <div className="form-actions">
        <button type="button" className="button button--quiet" onClick={onCancel}>
          Cancelar
        </button>
        <button className="button button--primary">
          <Plus size={18} />
          Adicionar lead
        </button>
      </div>
    </form>
  );
}

function ImportFlow({
  onClose,
  onComplete,
  existingBatches,
}: {
  onClose: () => void;
  onComplete: (batchName: string, file: File) => Promise<void>;
  existingBatches: string[];
}) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const nextBatchNumber =
    Math.max(
      0,
      ...existingBatches.map((batch) => {
        const match = batch.match(/lote\s+(\d+)/i);
        return match ? Number(match[1]) : 0;
      }),
    ) + 1;
  const [batchName, setBatchName] = useState(`Lote ${nextBatchNumber}`);

  const submitImport = async () => {
    if (!file || !batchName.trim()) return;
    setImporting(true);
    await onComplete(batchName.trim(), file);
    setImporting(false);
  };

  return (
    <div className="form-stack">
      <label className="field">
        <span>Nome do lote</span>
        <input
          value={batchName}
          onChange={(event) => setBatchName(event.target.value)}
          placeholder="Ex.: Lote 2"
        />
      </label>
      <label className="upload-zone upload-zone--modal">
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        {file ? <FileSpreadsheet size={31} /> : <UploadCloud size={31} />}
        <strong>{file ? file.name : "Selecione sua planilha"}</strong>
        <span>XLSX, XLS ou CSV</span>
      </label>
      <p className="form-hint">
        A primeira aba será importada. Perfis que já existem no CRM serão
        ignorados automaticamente.
      </p>
      <div className="form-actions">
        <button className="button button--quiet" onClick={onClose}>
          Cancelar
        </button>
        <button
          className="button button--primary"
          disabled={!file || !batchName.trim() || importing}
          onClick={() => void submitImport()}
        >
          {importing ? "Importando..." : "Criar lote e importar"}
        </button>
      </div>
    </div>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState(() => window.localStorage.getItem("oblix-login-email") ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberAccess, setRememberAccess] = useState(() => window.localStorage.getItem("oblix-remember-access") === "true");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    if (rememberAccess) {
      window.localStorage.setItem("oblix-login-email", email.trim());
      window.localStorage.setItem("oblix-remember-access", "true");
    } else {
      window.localStorage.removeItem("oblix-login-email");
      window.localStorage.removeItem("oblix-remember-access");
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) setError("E-mail ou senha inválidos. Confirme o usuário criado no Supabase.");
    setLoading(false);
  };

  return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand">
          <Brand />
        </div>
        <h1>Entrar no CRM</h1>
        <p>Acompanhe a fila de validação e a prospecção da dupla.</p>
        <label className="field"><span>E-mail</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@oblix.com" required /></label>
        <label className="field"><span>Senha</span><div className="password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /><button type="button" className="password-toggle" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
        <label className="remember-access"><input type="checkbox" checked={rememberAccess} onChange={(event) => setRememberAccess(event.target.checked)} /><span>Manter acesso neste dispositivo</span></label>
        {error && <div className="auth-error">{error}</div>}
        <button className="button button--primary" disabled={loading}>{loading ? "Entrando…" : "Entrar"}</button>
        <small>O acesso fica salvo pelo Supabase com segurança. A senha nunca é gravada pelo CRM.</small>
      </form>
    </main>
  );
}

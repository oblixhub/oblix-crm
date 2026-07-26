import { Eye, EyeOff, FileSpreadsheet, Plus, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AppShell } from "./components/AppShell";
import { Brand } from "./components/Brand";
import { ClientPreview } from "./components/ClientPreview";
import { Dashboard } from "./components/Dashboard";
import { FinanceView } from "./components/FinanceView";
import { LeadDetail } from "./components/LeadDetail";
import { LeadDirectory } from "./components/LeadDirectory";
import { MessageLibrary } from "./components/MessageLibrary";
import { MessageManager } from "./components/MessageManager";
import { Modal } from "./components/Modal";
import { PreviewHub } from "./components/PreviewHub";
import { ProspectingBoard } from "./components/ProspectingBoard";
import { ValidationQueue } from "./components/ValidationQueue";
import { initialLeads, initialTemplates } from "./data";
import { supabase, supabaseConfigured } from "./lib/supabase";
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

type ModalState =
  | { type: "new-lead" }
  | { type: "import" }
  | { type: "client-preview"; leadId: number }
  | { type: "scripts"; leadId: number }
  | null;

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
  lead_batches?: {
    id: string;
    name: string;
    week_start: string | null;
    status: "active" | "completed" | "archived";
  } | null;
};

const mapDbLead = (row: DbLead, index: number): Lead => ({
  id: index + 1,
  remoteId: row.id,
  fullName: row.full_name ?? undefined,
  handle: row.handle,
  category: row.segment ?? "A classificar",
  validationStatus: row.validation_status ?? "pending",
  validatedAt: row.validated_at ?? undefined,
  discardReason: row.discard_reason ?? undefined,
  batchId: row.batch_id ?? undefined,
  batchName:
    row.lead_batches?.name ??
    (row.source_type === "manual" ? "Cadastro manual" : "Lote 1"),
  sourceType: row.source_type ?? "excel",
  owner: row.owner === "Sócia" ? "Sócia" : "Você",
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
  whatsappUrl: row.has_whatsapp ? undefined : undefined,
  offer: row.offer_suggestion?.toLowerCase().includes("domínio") ? "Com domínio" : "Sem domínio",
  amount: row.offer_suggestion?.toLowerCase().includes("domínio") ? 250 : 200,
  paymentStatus: "Não aprovado",
  activities: [{ id: index + 1, kind: "validation", title: "Importado do Excel", detail: row.professional_evidence ?? "Aguardando validação manual do perfil.", time: "Importado agora", author: "Sistema" }],
  preview: { status: "none", publicSlug: row.handle.replace(/^@/, ""), checklist: { index: false, relativePaths: false, protectedAccess: false } },
});

const toDbPatch = (lead: Lead) => ({
  priority_marked: lead.priority === "Urgente" || lead.priority === "Alta",
  priority: lead.priority,
  stage: lead.stage,
  owner: lead.owner,
  validation_status: lead.validationStatus,
  is_validated: lead.validationStatus === "valid",
  validated_at: lead.validatedAt ?? null,
  discard_reason: lead.discardReason ?? null,
  next_action: lead.nextAction,
  next_action_at: lead.nextActionAt ?? null,
  updated_at: new Date().toISOString(),
});

export default function App() {
  const devPreview =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).has("preview");
  const [leads, setLeads] = useState<Lead[]>(() => initialLeads);
  const [authReady, setAuthReady] = useState(!supabaseConfigured);
  const [session, setSession] = useState<Awaited<ReturnType<NonNullable<typeof supabase>["auth"]["getSession"]>>["data"]["session"]>(null);
  const [backendLoading, setBackendLoading] = useState(Boolean(supabaseConfigured));
  const [templates, setTemplates] = useState<MessageTemplate[]>(
    () => initialTemplates,
  );
  const [activeNav, setActiveNav] = useState<NavKey>("dashboard");
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = window.localStorage.getItem("oblix-theme");
    return saved === "light" ? "light" : "dark";
  });
  const toastTimeoutRef = useRef<number | null>(null);

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
    void supabase
      .from("leads")
      .select("*, lead_batches(id, name, week_start, status)")
      .order("priority_marked", { ascending: false })
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (!error && data) {
          const mapped = data.map((row, index) =>
            mapDbLead(row as DbLead, index),
          );
          setLeads(mapped);
          if (
            mapped.some((lead) => lead.validationStatus === "pending") &&
            !mapped.some((lead) => lead.validationStatus === "valid")
          ) {
            setActiveNav("validation");
          }
        }
        setBackendLoading(false);
        if (error) showToast(`Não foi possível carregar os leads: ${error.message}`);
      });
    return () => {
      active = false;
    };
  }, [session]);

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === selectedLeadId) ?? null,
    [leads, selectedLeadId],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("oblix-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [activeNav, selectedLeadId]);

  useEffect(
    () => () => {
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    },
    [],
  );

  const showToast = (message: string) => {
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToast(message);
    toastTimeoutRef.current = window.setTimeout(() => setToast(null), 3200);
  };

  const updateLead = (leadId: number, updater: (lead: Lead) => Lead) => {
    setLeads((current) => {
      const next = current.map((lead) => (lead.id === leadId ? updater(lead) : lead));
      const changed = next.find((lead) => lead.id === leadId);
      if (supabase && session && changed?.remoteId) {
        void supabase
          .from("leads")
          .update(toDbPatch(changed))
          .eq("id", changed.remoteId)
          .then(({ error }) => {
            if (error) showToast(`Não foi possível salvar: ${error.message}`);
          });
      }
      return next;
    });
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
    if (!supabase || !session) {
      setLeads((current) => [lead, ...current]);
      setModal(null);
      showToast(`${lead.handle} adicionado à validação manual.`);
      return;
    }

    const { data, error } = await supabase
      .from("leads")
      .insert({
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
        has_instagram: true,
        has_whatsapp: Boolean(lead.whatsappUrl),
        source_name: "Cadastro manual",
        source_type: "manual",
        next_action: "Abrir perfil e validar",
      })
      .select("*, lead_batches(id, name, week_start, status)")
      .single();

    if (error || !data) {
      showToast(
        error?.code === "23505"
          ? "Este perfil já existe no CRM."
          : `Não foi possível adicionar: ${error?.message ?? "erro desconhecido"}`,
      );
      return;
    }

    setLeads((current) => [
      { ...mapDbLead(data as DbLead, current.length), id: Date.now() },
      ...current,
    ]);
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
    const fresh = parsed.filter(
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
        category: row.segment ?? "A classificar",
        validationStatus: "pending",
        batchName,
        sourceType: "excel",
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

    const monday = new Date();
    const deltaToMonday = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - deltaToMonday);
    const weekStart = monday.toISOString().slice(0, 10);
    const { data: batch, error: batchError } = await supabase
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

    if (batchError || !batch) {
      showToast(
        batchError?.code === "23505"
          ? "Já existe um lote com esse nome."
          : `Não foi possível criar o lote: ${batchError?.message ?? "erro desconhecido"}`,
      );
      return;
    }

    const rows = fresh.map((lead) => ({
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
      source_name: file.name,
      source_type: "excel",
      validation_status: "pending",
      next_action: "Abrir perfil e validar",
      batch_id: batch.id,
    }));

    const { data, error } = await supabase
      .from("leads")
      .insert(rows)
      .select("*, lead_batches(id, name, week_start, status)");

    if (error || !data) {
      showToast(`O lote foi criado, mas os leads falharam: ${error?.message}`);
      return;
    }

    setLeads((current) => [
      ...data.map((row, index) => ({
        ...mapDbLead(row as DbLead, index),
        id: Date.now() + index,
      })),
      ...current,
    ]);
    setModal(null);
    setActiveNav("validation");
    showToast(
      `${data.length} leads adicionados ao ${batchName}. ${parsed.length - fresh.length} duplicados ignorados.`,
    );
  };

  const updateMany = (ids: number[], patch: Partial<Lead>) => {
    const selected = new Set(ids);
    setLeads((current) =>
      current.map((lead) =>
        selected.has(lead.id) ? { ...lead, ...patch } : lead,
      ),
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
  ) => {
    const stageByOutcome: Partial<Record<ProspectingOutcome, Stage>> = {
      "Mensagem enviada": "Contatar",
      "Sem resposta": "Contatar",
      Interessado: "Interessado",
      "Não interessado": "Contatar",
      "Retornar depois": "Contatar",
    };
    updateLead(leadId, (lead) =>
      addActivity(
        {
          ...lead,
          stage: stageByOutcome[outcome] ?? lead.stage,
          nextAction,
          scheduleDay,
          dueTime,
          overdue: false,
          archived: outcome === "Não interessado",
        },
        {
          kind: outcome === "Interessado" ? "interest" : "message",
          title: outcome,
          detail:
            note.trim() ||
            `Resultado registrado. Próximo passo: ${nextAction}.`,
          author: "Você",
        },
      ),
    );
    showToast(`${outcome} registrado. Próximo lead aberto.`);
  };

  const uploadPreview = (file: File) => {
    if (!selectedLead) return;
    updateLead(selectedLead.id, (lead) =>
      addActivity(
        {
          ...lead,
          stage: "Preview",
          nextAction: "Enviar acesso ao cliente",
          preview: {
            ...lead.preview,
            status: "ready",
            version: (lead.preview.version ?? 0) + 1,
            fileName: file.name,
            checklist: {
              index: true,
              relativePaths: true,
              protectedAccess: true,
            },
          },
        },
        {
          kind: "preview",
          title: "Nova versão do preview preparada",
          detail: `${file.name} foi adicionado à demonstração local.`,
          author: "Você",
        },
      ),
    );
    showToast("ZIP adicionado e checklist concluído na demonstração.");
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
    if (id) setModal({ type: "client-preview", leadId: id });
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
        onStageChange={changeStage}
        onAddNote={addNote}
        onUpload={uploadPreview}
        onOpenClientPreview={() => openClientPreview()}
        onMarkPaid={markPaid}
        onOpenMessages={() => openMessages()}
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
        onNavigate={navigate}
        onToggleTheme={() =>
          setTheme((current) => (current === "light" ? "dark" : "light"))
        }
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

      {toast && <div className="toast">{toast}</div>}
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
            <option>Você</option>
            <option>Sócia</option>
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

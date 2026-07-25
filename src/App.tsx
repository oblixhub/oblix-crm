import { FileSpreadsheet, Plus, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AppShell } from "./components/AppShell";
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
};

const mapDbLead = (row: DbLead, index: number): Lead => ({
  id: index + 1,
  remoteId: row.id,
  handle: row.handle,
  category: row.segment ?? "A classificar",
  owner: row.owner === "Sócia" ? "Sócia" : "Você",
  stage: (row.validation_status === "pending" ? "Validar" : row.stage) as Stage,
  nextAction: row.validation_status === "pending" ? "Abrir perfil e validar" : "Definir próxima ação",
  priority: row.priority_marked ? "Alta" : "Normal",
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
  stage: lead.stage,
  owner: lead.owner,
  updated_at: new Date().toISOString(),
});

export default function App() {
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
    return saved === "dark" ? "dark" : "light";
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
      .select("*")
      .order("priority_marked", { ascending: false })
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (!error && data) {
          setLeads(data.map((row, index) => mapDbLead(row as DbLead, index)));
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
        void supabase.from("leads").update(toDbPatch(changed)).eq("id", changed.remoteId);
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

  if (supabaseConfigured && !authReady) {
    return <div className="auth-screen"><div className="auth-card"><strong>OBLIX CRM</strong><p>Verificando sua sessão segura…</p></div></div>;
  }
  if (supabaseConfigured && !session) {
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
        leads={leads.filter((lead) => !lead.archived)}
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
  } else if (activeNav === "prospecting") {
    content = (
      <ProspectingBoard
        leads={leads.filter((lead) => !lead.archived)}
        onSelectLead={selectLead}
        onOpenMessages={openMessages}
        onPriorityChange={changePriority}
        onSaveOutcome={saveProspectingOutcome}
      />
    );
  } else if (activeNav === "leads") {
    content = (
      <LeadDirectory
        leads={leads}
        onSelectLead={selectLead}
        onOpenMessages={openMessages}
        onPriorityChange={changePriority}
      />
    );
  } else if (activeNav === "previews") {
    content = (
      <PreviewHub
        leads={leads}
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
    content = <FinanceView leads={leads} />;
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
            onSubmit={(lead) => {
              setLeads((current) => [lead, ...current]);
              setModal(null);
              showToast(`${lead.handle} adicionado à fila de hoje.`);
            }}
          />
        </Modal>
      )}

      {modal?.type === "import" && (
        <Modal title="Importar planilha" onClose={() => setModal(null)}>
          <ImportFlow
            onClose={() => setModal(null)}
            onComplete={(fileName) => {
              setModal(null);
              showToast(`${fileName} selecionado para a futura importação.`);
            }}
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
      category: category.trim() || "A classificar",
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
}: {
  onClose: () => void;
  onComplete: (fileName: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <div className="form-stack">
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
        A importação real e a deduplicação serão conectadas ao banco na próxima
        etapa. Esta versão já demonstra a seleção do arquivo.
      </p>
      <div className="form-actions">
        <button className="button button--quiet" onClick={onClose}>
          Cancelar
        </button>
        <button
          className="button button--primary"
          disabled={!file}
          onClick={() => file && onComplete(file.name)}
        >
          Importar arquivo
        </button>
      </div>
    </div>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) setError("E-mail ou senha inválidos. Confirme o usuário criado no Supabase.");
    setLoading(false);
  };

  return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-mark">O</div>
        <span className="eyebrow">STUDIO OBLIX</span>
        <h1>Entrar no CRM</h1>
        <p>Acompanhe a fila de validação e a prospecção da dupla.</p>
        <label className="field"><span>E-mail</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@oblix.com" required /></label>
        <label className="field"><span>Senha</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {error && <div className="auth-error">{error}</div>}
        <button className="button button--primary" disabled={loading}>{loading ? "Entrando…" : "Entrar"}</button>
        <small>Usuários e senhas são criados em Authentication → Users no Supabase.</small>
      </form>
    </main>
  );
}

import {
  ArrowRight,
  BadgeCheck,
  Ban,
  CheckCheck,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  Flag,
  Inbox,
  Instagram,
  ListChecks,
  Plus,
  Search,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ownerLabels, owners } from "../types";
import type {
  Lead,
  Owner,
  Priority,
  ValidationStatus,
  WeekDay,
} from "../types";

export interface ValidationSettings {
  priority: Priority;
  owner: Owner;
  nextAction: string;
  day: WeekDay;
  time: string;
}

export interface BatchValidationSettings {
  owner: Owner;
}

interface ValidationQueueProps {
  leads: Lead[];
  onValidate: (leadId: number, settings: ValidationSettings) => void;
  onValidateBatch: (
    batchName: string,
    settings: BatchValidationSettings,
  ) => void;
  onDiscard: (leadId: number, reason: string) => void;
  onNewLead: () => void;
  onImport: () => void;
}

const statusLabels: Record<ValidationStatus, string> = {
  pending: "Pendentes",
  valid: "Aprovados",
  discarded: "Descartados",
};

const VALIDATION_WORKSPACE_STORAGE_KEY = "oblix-crm-validation-workspace-v2";

type ValidationWorkspace = {
  activeBatch?: string;
  status?: ValidationStatus;
  selectedHandle?: string | null;
  validationMode?: "individual" | "batch";
  query?: string;
};

const loadValidationWorkspace = (): ValidationWorkspace => {
  try {
    const saved = window.sessionStorage.getItem(VALIDATION_WORKSPACE_STORAGE_KEY);
    if (!saved) return {};
    const parsed = JSON.parse(saved) as Record<string, unknown>;
    return {
      activeBatch:
        typeof parsed.activeBatch === "string" ? parsed.activeBatch : undefined,
      status:
        parsed.status === "pending" ||
        parsed.status === "valid" ||
        parsed.status === "discarded"
          ? parsed.status
          : undefined,
      selectedHandle:
        typeof parsed.selectedHandle === "string" ? parsed.selectedHandle : null,
      validationMode:
        parsed.validationMode === "batch" || parsed.validationMode === "individual"
          ? parsed.validationMode
          : undefined,
      query: typeof parsed.query === "string" ? parsed.query : "",
    };
  } catch {
    return {};
  }
};

export function ValidationQueue({
  leads,
  onValidate,
  onValidateBatch,
  onDiscard,
  onNewLead,
  onImport,
}: ValidationQueueProps) {
  const batches = useMemo(() => {
    const pendingByBatch = new Map<string, number>();
    leads.forEach((lead) => {
      const pending = pendingByBatch.get(lead.batchName) ?? 0;
      pendingByBatch.set(
        lead.batchName,
        pending + Number(lead.validationStatus === "pending"),
      );
    });

    return [...pendingByBatch.keys()].sort((a, b) => {
      const pendingDifference =
        (pendingByBatch.get(b) ?? 0) - (pendingByBatch.get(a) ?? 0);
      return pendingDifference || a.localeCompare(b, "pt-BR", { numeric: true });
    });
  }, [leads]);
  const [restoredWorkspace] = useState(loadValidationWorkspace);
  const [activeBatch, setActiveBatch] = useState(
    () => restoredWorkspace.activeBatch ?? "",
  );
  const [status, setStatus] = useState<ValidationStatus>(
    () => restoredWorkspace.status ?? "pending",
  );
  const [query, setQuery] = useState(() => restoredWorkspace.query ?? "");
  const deferredQuery = useDeferredValue(query);
  const [selectedHandle, setSelectedHandle] = useState<string | null>(
    () => restoredWorkspace.selectedHandle ?? null,
  );
  const [priority, setPriority] = useState<Priority>("Normal");
  const [owner, setOwner] = useState<Owner>("Você");
  const [nextAction, setNextAction] = useState("Enviar mensagem inicial");
  const [day, setDay] = useState<WeekDay>("Hoje");
  const [time, setTime] = useState("10:00");
  const [discardReason, setDiscardReason] = useState("");
  const [validationMode, setValidationMode] = useState<
    "individual" | "batch"
  >(() => restoredWorkspace.validationMode ?? "individual");
  const [batchOwner, setBatchOwner] = useState<Owner>("Você");
  const [confirmBatch, setConfirmBatch] = useState(false);

  const persistWorkspace = (patch: Partial<ValidationWorkspace> = {}) => {
    try {
      window.sessionStorage.setItem(
        VALIDATION_WORKSPACE_STORAGE_KEY,
        JSON.stringify({
          activeBatch,
          status,
          selectedHandle,
          validationMode,
          query,
          ...patch,
        }),
      );
    } catch {
      // The queue remains usable if browser storage is unavailable.
    }
  };

  useEffect(() => {
    if (!batches.length) return;
    setActiveBatch((current) =>
      current && batches.includes(current) ? current : batches[0],
    );
  }, [batches]);

  useEffect(() => {
    persistWorkspace();
  }, [activeBatch, query, selectedHandle, status, validationMode]);

  const batchLeads = leads.filter((lead) => lead.batchName === activeBatch);
  const counts = {
    pending: batchLeads.filter((lead) => lead.validationStatus === "pending")
      .length,
    valid: batchLeads.filter((lead) => lead.validationStatus === "valid").length,
    discarded: batchLeads.filter(
      (lead) => lead.validationStatus === "discarded",
    ).length,
  };

  const queue = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    return leads
      .filter(
        (lead) =>
          lead.batchName === activeBatch &&
          lead.validationStatus === status &&
          (!normalized ||
            lead.handle.toLowerCase().includes(normalized) ||
            lead.fullName?.toLowerCase().includes(normalized) ||
            lead.category.toLowerCase().includes(normalized)),
      )
      .sort((a, b) => a.handle.localeCompare(b.handle));
  }, [activeBatch, deferredQuery, leads, status]);

  const selectedLead =
    queue.find((lead) => lead.handle === selectedHandle) ?? queue[0] ?? null;
  const completed = counts.valid + counts.discarded;
  const progress = batchLeads.length
    ? Math.round((completed / batchLeads.length) * 100)
    : 0;

  const approve = () => {
    if (!selectedLead) return;
    const selectedIndex = queue.findIndex(
      (lead) => lead.handle === selectedLead.handle,
    );
    const nextLead = queue[selectedIndex + 1] ?? queue[selectedIndex - 1] ?? null;
    setSelectedHandle(nextLead?.handle ?? null);
    onValidate(selectedLead.id, {
      priority,
      owner,
      nextAction,
      day,
      time,
    });
    setDiscardReason("");
  };

  const discard = () => {
    if (!selectedLead) return;
    const selectedIndex = queue.findIndex(
      (lead) => lead.handle === selectedLead.handle,
    );
    const nextLead = queue[selectedIndex + 1] ?? queue[selectedIndex - 1] ?? null;
    setSelectedHandle(nextLead?.handle ?? null);
    onDiscard(
      selectedLead.id,
      discardReason.trim() || "Perfil fora do critério de prospecção.",
    );
    setDiscardReason("");
  };

  const approveBatch = () => {
    if (counts.pending === 0) return;
    onValidateBatch(activeBatch, { owner: batchOwner });
    setConfirmBatch(false);
  };

  return (
    <div className="validation-page">
      <header className="validation-heading">
        <div>
          <span className="page-eyebrow">Entrada de leads</span>
          <h1>Validação por lote</h1>
          <p>
            Primeiro confirme se o perfil serve. Só depois ele entra na fila de
            prospecção.
          </p>
        </div>
        <div className="validation-heading-actions">
          <button className="button button--secondary" onClick={onNewLead}>
            <Plus size={18} />
            Adicionar manual
          </button>
          <button className="button button--primary" onClick={onImport}>
            <FileSpreadsheet size={18} />
            Importar novo lote
          </button>
        </div>
      </header>

      <section className="validation-flow-guide" aria-label="Fluxo de validação">
        <span className="active">
          <i>1</i>
          <strong>Selecionar lote</strong>
          <small>Escolha a lista da semana</small>
        </span>
        <ArrowRight size={18} />
        <span>
          <i>2</i>
          <strong>Escolher validação</strong>
          <small>Em massa ou perfil por perfil</small>
        </span>
        <ArrowRight size={18} />
        <span>
          <i>3</i>
          <strong>Enviar para Leads</strong>
          <small>Fila pronta para contato</small>
        </span>
      </section>

      <section className="batch-control">
        <label>
          <span>Lote selecionado</span>
          <select
            value={activeBatch}
            onChange={(event) => {
              setActiveBatch(event.target.value);
              setSelectedHandle(null);
              setValidationMode("individual");
              setConfirmBatch(false);
            }}
          >
            {batches.map((batch) => (
              <option key={batch}>{batch}</option>
            ))}
          </select>
        </label>
        <div className="batch-progress">
          <span>
            <strong>{activeBatch}</strong>
            <small>
              {completed} de {batchLeads.length} analisados
            </small>
          </span>
          <i>
            <span style={{ width: `${progress}%` }} />
          </i>
          <strong>{progress}%</strong>
        </div>
        <div className="batch-stats">
          <span>
            <Inbox size={17} />
            <strong>{counts.pending}</strong>
            pendentes
          </span>
          <span>
            <CheckCircle2 size={17} />
            <strong>{counts.valid}</strong>
            aprovados
          </span>
          <span>
            <Ban size={17} />
            <strong>{counts.discarded}</strong>
            descartados
          </span>
        </div>
      </section>

      {status === "pending" && (
        <section className="validation-mode-panel">
          <header>
            <div>
              <span className="page-eyebrow">Tipo de entrada</span>
              <h2>Como este lote deve ser validado?</h2>
              <p>
                O tipo de validação vale somente para o lote selecionado.
              </p>
            </div>
            <span className="validation-mode-count">
              <strong>{counts.pending}</strong>
              perfis pendentes
            </span>
          </header>

          <div className="validation-mode-options">
            <button
              className={validationMode === "individual" ? "active" : ""}
              onClick={() => {
                setValidationMode("individual");
                setConfirmBatch(false);
              }}
            >
              <span>
                <ListChecks size={21} />
              </span>
              <i>
                <strong>Revisar 1 por 1</strong>
                <small>
                  Para listas antigas: abra cada Instagram, descarte ou defina
                  a prioridade.
                </small>
              </i>
              <em>Mais controle</em>
            </button>

            <button
              className={validationMode === "batch" ? "active" : ""}
              disabled={counts.pending === 0}
              onClick={() => {
                setValidationMode("batch");
                setSelectedHandle(null);
              }}
            >
              <span>
                <UsersRound size={21} />
              </span>
              <i>
                <strong>Aprovar lote inteiro</strong>
                <small>
                  Para perfis já conferidos no Instagram: envie todos os
                  pendentes para Leads.
                </small>
              </i>
              <em>Mais rápido</em>
            </button>
          </div>
        </section>
      )}

      <div className="validation-status-tabs" role="tablist">
        {(["pending", "valid", "discarded"] as const).map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={status === item}
            className={status === item ? "active" : ""}
            onClick={() => {
              setStatus(item);
              setSelectedHandle(null);
              setConfirmBatch(false);
            }}
          >
            {statusLabels[item]}
            <span>{counts[item]}</span>
          </button>
        ))}
      </div>

      {status === "pending" && validationMode === "batch" ? (
        <section className="batch-validation-workspace">
          <div className="batch-validation-hero">
            <span>
              <CheckCheck size={29} />
            </span>
            <div>
              <span className="page-eyebrow">Aprovação em massa</span>
              <h2>
                {counts.pending > 0
                  ? `Enviar ${counts.pending} perfis para Leads`
                  : "Todos os perfis deste lote já foram processados"}
              </h2>
              <p>
                Use este caminho quando os perfis já foram conferidos antes de
                chegar ao CRM.
              </p>
            </div>
          </div>

          <div className="batch-validation-summary">
            <span>
              <small>Destino</small>
              <strong>Leads · Contatar</strong>
            </span>
            <span>
              <small>Prioridade</small>
              <strong>Normal · não qualificada</strong>
            </span>
            <span>
              <small>Próxima ação</small>
              <strong>Enviar mensagem inicial</strong>
            </span>
          </div>

          {counts.pending > 0 ? (
            <div className="batch-validation-setup">
              <label>
                <span>
                  <UserRoundCheck size={16} />
                  Responsável inicial
                </span>
                <select
                  value={batchOwner}
                  onChange={(event) =>
                    setBatchOwner(event.target.value as Owner)
                  }
                >
                  {owners.map((teamOwner) => (
                    <option key={teamOwner} value={teamOwner}>
                      {ownerLabels[teamOwner]}
                    </option>
                  ))}
                </select>
                <small>
                  Prazos e prioridades individuais podem ser ajustados depois
                  na tela Leads.
                </small>
              </label>

              <div className="batch-validation-note">
                <ShieldCheck size={20} />
                <p>
                  <strong>Nenhum perfil será marcado como urgente.</strong>
                  Todos entram com prioridade normal, sem qualificação
                  individual.
                </p>
              </div>

              {confirmBatch ? (
                <div className="batch-validation-confirm" role="alert">
                  <div>
                    <strong>Confirmar {counts.pending} perfis?</strong>
                    <p>
                      O lote será enviado para a fila de contato de {batchOwner}.
                    </p>
                  </div>
                  <button
                    className="button button--secondary"
                    onClick={() => setConfirmBatch(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    className="button button--primary"
                    onClick={approveBatch}
                  >
                    <CheckCheck size={18} />
                    Confirmar e enviar
                  </button>
                </div>
              ) : (
                <button
                  className="button button--primary batch-validation-submit"
                  onClick={() => setConfirmBatch(true)}
                >
                  <CheckCheck size={19} />
                  Aprovar os {counts.pending} pendentes
                </button>
              )}
            </div>
          ) : (
            <div className="batch-validation-complete">
              <BadgeCheck size={25} />
              <div>
                <strong>Lote sem pendências</strong>
                <p>Os perfis aprovados já estão disponíveis na tela Leads.</p>
              </div>
            </div>
          )}
        </section>
      ) : (
      <div className="validation-workspace">
        <aside className="validation-list">
          <label className="search-field">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar perfil ou nome"
            />
          </label>
          <div>
            {queue.map((lead) => (
              <button
                key={lead.id}
                className={selectedLead?.id === lead.id ? "active" : ""}
                onClick={() => {
                  setSelectedHandle(lead.handle);
                  persistWorkspace({ selectedHandle: lead.handle });
                }}
              >
                <span>{lead.handle.replace("@", "").slice(0, 2).toUpperCase()}</span>
                <i>
                  <strong>{lead.handle}</strong>
                  <small>{lead.fullName || lead.category}</small>
                </i>
                <ArrowRight size={17} />
              </button>
            ))}
            {queue.length === 0 && (
              <div className="validation-empty">
                <BadgeCheck size={24} />
                <strong>Nenhum lead aqui</strong>
                <small>Escolha outro estado ou lote.</small>
              </div>
            )}
          </div>
        </aside>

        {selectedLead ? (
          <main className="validation-review">
            <header>
              <span className="validation-instagram-mark">
                <Instagram size={25} />
              </span>
              <div>
                <span>Validando agora</span>
                <h2>{selectedLead.handle}</h2>
                <p>{selectedLead.fullName || selectedLead.category}</p>
              </div>
              <a
                className="button button--secondary"
                href={selectedLead.instagramUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() =>
                  persistWorkspace({ selectedHandle: selectedLead.handle })
                }
              >
                Abrir Instagram
                <ExternalLink size={16} />
              </a>
            </header>

            <section className="validation-checklist">
              <h3>Confira antes de decidir</h3>
              <div>
                <span>
                  <CheckCircle2 size={18} />
                  Perfil ativo e profissional
                </span>
                <span>
                  <CheckCircle2 size={18} />
                  Negócio adequado para um site
                </span>
                <span>
                  <CheckCircle2 size={18} />
                  Não está duplicado no CRM
                </span>
              </div>
            </section>

            {status === "pending" ? (
              <>
                <section className="validation-settings">
                  <div>
                    <h3>Se for aprovado</h3>
                    <p>Defina como este lead entrará na fila.</p>
                  </div>
                  <label>
                    <span>
                      <Flag size={15} />
                      Prioridade
                    </span>
                    <select
                      value={priority}
                      onChange={(event) =>
                        setPriority(event.target.value as Priority)
                      }
                    >
                      <option>Urgente</option>
                      <option>Alta</option>
                      <option>Normal</option>
                      <option>Baixa</option>
                    </select>
                  </label>
                  <label>
                    <span>
                      <UserRoundCheck size={15} />
                      Responsável
                    </span>
                    <select
                      value={owner}
                      onChange={(event) =>
                        setOwner(event.target.value as Owner)
                      }
                    >
                      {owners.map((teamOwner) => (
                        <option key={teamOwner} value={teamOwner}>
                          {ownerLabels[teamOwner]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="validation-next-action">
                    <span>Primeira ação</span>
                    <select
                      value={nextAction}
                      onChange={(event) => setNextAction(event.target.value)}
                    >
                      <option>Enviar mensagem inicial</option>
                      <option>Pesquisar mais informações</option>
                      <option>Solicitar contato pelo WhatsApp</option>
                    </select>
                  </label>
                  <label>
                    <span>Dia</span>
                    <select
                      value={day}
                      onChange={(event) =>
                        setDay(event.target.value as WeekDay)
                      }
                    >
                      <option>Hoje</option>
                      <option>Seg</option>
                      <option>Ter</option>
                      <option>Qua</option>
                      <option>Qui</option>
                      <option>Sex</option>
                    </select>
                  </label>
                  <label>
                    <span>Horário</span>
                    <input
                      type="time"
                      value={time}
                      onChange={(event) => setTime(event.target.value)}
                    />
                  </label>
                </section>

                <label className="discard-reason">
                  <span>Motivo do descarte, se necessário</span>
                  <input
                    value={discardReason}
                    onChange={(event) => setDiscardReason(event.target.value)}
                    placeholder="Ex.: perfil inativo ou já possui um bom site"
                  />
                </label>

                <footer className="validation-actions">
                  <button className="button validation-discard" onClick={discard}>
                    <Ban size={18} />
                    Descartar
                  </button>
                  <button className="button button--primary" onClick={approve}>
                    <BadgeCheck size={19} />
                    Validar e enviar para Leads
                  </button>
                </footer>
              </>
            ) : (
              <section className={`validation-result validation-result--${status}`}>
                {status === "valid" ? (
                  <BadgeCheck size={24} />
                ) : (
                  <Ban size={24} />
                )}
                <div>
                  <strong>
                    {status === "valid"
                      ? "Lead aprovado para prospecção"
                      : "Lead descartado"}
                  </strong>
                  <p>
                    {status === "valid"
                      ? `${selectedLead.priority} · ${selectedLead.owner} · ${selectedLead.nextAction}`
                      : "Este contato não aparece na fila operacional."}
                  </p>
                </div>
              </section>
            )}
          </main>
        ) : (
          <main className="validation-review validation-review--empty">
            <Inbox size={30} />
            <h2>Lote concluído</h2>
            <p>Não há leads pendentes nesta visualização.</p>
          </main>
        )}
      </div>
      )}
    </div>
  );
}

import {
  ArrowRight,
  BadgeCheck,
  Ban,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  Flag,
  Inbox,
  Instagram,
  Plus,
  Search,
  UserRoundCheck,
} from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import type {
  Lead,
  Owner,
  Priority,
  ValidationStatus,
  WeekDay,
} from "../types";

interface ValidationSettings {
  priority: Priority;
  owner: Owner;
  nextAction: string;
  day: WeekDay;
  time: string;
}

interface ValidationQueueProps {
  leads: Lead[];
  onValidate: (leadId: number, settings: ValidationSettings) => void;
  onDiscard: (leadId: number, reason: string) => void;
  onNewLead: () => void;
  onImport: () => void;
}

const statusLabels: Record<ValidationStatus, string> = {
  pending: "Pendentes",
  valid: "Aprovados",
  discarded: "Descartados",
};

export function ValidationQueue({
  leads,
  onValidate,
  onDiscard,
  onNewLead,
  onImport,
}: ValidationQueueProps) {
  const batches = useMemo(
    () =>
      [...new Set(leads.map((lead) => lead.batchName))].sort((a, b) =>
        b.localeCompare(a, "pt-BR", { numeric: true }),
      ),
    [leads],
  );
  const [activeBatch, setActiveBatch] = useState(() => batches[0] ?? "Lote 1");
  const [status, setStatus] = useState<ValidationStatus>("pending");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [priority, setPriority] = useState<Priority>("Normal");
  const [owner, setOwner] = useState<Owner>("Você");
  const [nextAction, setNextAction] = useState("Enviar mensagem inicial");
  const [day, setDay] = useState<WeekDay>("Hoje");
  const [time, setTime] = useState("10:00");
  const [discardReason, setDiscardReason] = useState("");

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
    queue.find((lead) => lead.id === selectedId) ?? queue[0] ?? null;
  const completed = counts.valid + counts.discarded;
  const progress = batchLeads.length
    ? Math.round((completed / batchLeads.length) * 100)
    : 0;

  const approve = () => {
    if (!selectedLead) return;
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
    onDiscard(
      selectedLead.id,
      discardReason.trim() || "Perfil fora do critério de prospecção.",
    );
    setDiscardReason("");
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
          <strong>Validar perfil</strong>
          <small>Serve para prospecção?</small>
        </span>
        <ArrowRight size={18} />
        <span>
          <i>2</i>
          <strong>Configurar</strong>
          <small>Prioridade e responsável</small>
        </span>
        <ArrowRight size={18} />
        <span>
          <i>3</i>
          <strong>Enviar para Leads</strong>
          <small>Pronto para contato</small>
        </span>
      </section>

      <section className="batch-control">
        <label>
          <span>Lote selecionado</span>
          <select
            value={activeBatch}
            onChange={(event) => {
              setActiveBatch(event.target.value);
              setSelectedId(null);
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

      <div className="validation-status-tabs" role="tablist">
        {(["pending", "valid", "discarded"] as const).map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={status === item}
            className={status === item ? "active" : ""}
            onClick={() => {
              setStatus(item);
              setSelectedId(null);
            }}
          >
            {statusLabels[item]}
            <span>{counts[item]}</span>
          </button>
        ))}
      </div>

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
                onClick={() => setSelectedId(lead.id)}
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
                      <option>Você</option>
                      <option>Sócia</option>
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
    </div>
  );
}

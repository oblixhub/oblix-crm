import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronDown,
  CircleX,
  Clock3,
  ExternalLink,
  Flag,
  Instagram,
  MessageCircleMore,
  Play,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Lead,
  Owner,
  Priority,
  ProspectingOutcome,
  WeekDay,
} from "../types";
import { ContactActions } from "./ContactActions";

const outcomes: Array<{
  value: ProspectingOutcome;
  label: string;
  description: string;
  icon: typeof Send;
  tone: string;
}> = [
  {
    value: "Mensagem enviada",
    label: "Mensagem enviada",
    description: "Contato realizado",
    icon: Send,
    tone: "green",
  },
  {
    value: "Sem resposta",
    label: "Sem resposta",
    description: "Ainda não respondeu",
    icon: Clock3,
    tone: "gray",
  },
  {
    value: "Interessado",
    label: "Interessado",
    description: "Demonstrou interesse",
    icon: Sparkles,
    tone: "blue",
  },
  {
    value: "Não interessado",
    label: "Não interessado",
    description: "Não tem interesse",
    icon: CircleX,
    tone: "red",
  },
  {
    value: "Retornar depois",
    label: "Retornar depois",
    description: "Agendar follow-up",
    icon: CalendarClock,
    tone: "amber",
  },
];

const nextActions = [
  "Enviar mensagem inicial",
  "Enviar mensagem de follow-up",
  "Responder dúvidas",
  "Solicitar materiais",
  "Retomar contato",
  "Encerrar lead",
];

const priorityWeight: Record<Priority, number> = {
  Urgente: 0,
  Alta: 1,
  Normal: 2,
  Baixa: 3,
};

interface ProspectingBoardProps {
  leads: Lead[];
  onSelectLead: (id: number) => void;
  onOpenMessages: (id: number) => void;
  onPriorityChange: (id: number, priority: Priority) => void;
  onSaveOutcome: (
    id: number,
    outcome: ProspectingOutcome,
    nextAction: string,
    day: WeekDay,
    time: string,
    note: string,
  ) => void;
}

export function ProspectingBoard({
  leads,
  onSelectLead,
  onOpenMessages,
  onPriorityChange,
  onSaveOutcome,
}: ProspectingBoardProps) {
  const [ownerView, setOwnerView] = useState<Owner | "Equipe">("Você");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<Priority | "Todas">("Todas");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedOutcome, setSelectedOutcome] =
    useState<ProspectingOutcome>("Mensagem enviada");
  const [nextAction, setNextAction] = useState("Enviar mensagem de follow-up");
  const [scheduleDay, setScheduleDay] = useState<WeekDay>("Ter");
  const [time, setTime] = useState("10:00");
  const [note, setNote] = useState("");

  const queue = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return leads
      .filter(
        (lead) =>
          ["Contatar", "Interessado", "Materiais"].includes(
            lead.stage,
          ) &&
          (ownerView === "Equipe" || lead.owner === ownerView) &&
          (priority === "Todas" || lead.priority === priority) &&
          (!normalized ||
            lead.handle.toLowerCase().includes(normalized) ||
            lead.category.toLowerCase().includes(normalized)),
      )
      .sort(
        (a, b) =>
          Number(Boolean(b.overdue)) - Number(Boolean(a.overdue)) ||
          priorityWeight[a.priority] - priorityWeight[b.priority] ||
          a.dueTime.localeCompare(b.dueTime),
      );
  }, [leads, ownerView, priority, query]);

  const activeId =
    selectedId && queue.some((lead) => lead.id === selectedId)
      ? selectedId
      : queue[0]?.id;
  const selectedLead = queue.find((lead) => lead.id === activeId);
  const selectedIndex = queue.findIndex((lead) => lead.id === activeId);

  const moveSelection = useCallback(
    (direction: -1 | 1) => {
      if (queue.length === 0) return;
      const nextIndex =
        selectedIndex < 0
          ? 0
          : Math.min(
              queue.length - 1,
              Math.max(0, selectedIndex + direction),
            );
      setSelectedId(queue[nextIndex].id);
    },
    [queue, selectedIndex],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName)) return;
      if (event.key.toLowerCase() === "j") moveSelection(1);
      if (event.key.toLowerCase() === "k") moveSelection(-1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moveSelection]);

  const saveAndNext = () => {
    if (!selectedLead) return;
    onSaveOutcome(
      selectedLead.id,
      selectedOutcome,
      nextAction,
      scheduleDay,
      time,
      note,
    );
    const nextLead = queue[selectedIndex + 1] ?? queue[0];
    setSelectedId(nextLead?.id ?? null);
    setNote("");
  };

  return (
    <div className="prospecting-workspace">
      <header className="prospecting-heading">
        <div>
          <h1>Modo prospecção</h1>
          <p>Trabalhe sua fila sem perder o contexto.</p>
        </div>
        <div className="daily-progress">
          <span>
            <strong>14</strong> de 20 contatos hoje
          </span>
          <i>
            <span />
          </i>
          <small>70%</small>
        </div>
        <div className="owner-switch" aria-label="Visualização da fila">
          {(["Você", "Sócia", "Equipe"] as const).map((item) => (
            <button
              key={item}
              className={ownerView === item ? "active" : ""}
              onClick={() => setOwnerView(item)}
            >
              {item === "Você" ? "Minha fila" : item}
            </button>
          ))}
        </div>
        <button
          className="button button--primary start-next"
          onClick={() => setSelectedId(queue[0]?.id ?? null)}
        >
          <Play size={17} fill="currentColor" />
          Iniciar próximo lead
        </button>
      </header>

      <div className="prospecting-filters">
        <label>
          <CalendarClock size={17} />
          <select aria-label="Semana">
            <option>20–24 jul</option>
          </select>
          <ChevronDown size={15} />
        </label>
        <label>
          <Flag size={17} />
          <select
            aria-label="Filtrar prioridade"
            value={priority}
            onChange={(event) =>
              setPriority(event.target.value as Priority | "Todas")
            }
          >
            <option>Todas</option>
            <option>Urgente</option>
            <option>Alta</option>
            <option>Normal</option>
            <option>Baixa</option>
          </select>
          <ChevronDown size={15} />
        </label>
        <label className="prospecting-search">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por @handle ou segmento"
          />
        </label>
      </div>

      <div className="prospecting-grid">
        <aside className="prospecting-queue">
          <header>
            <strong>Fila</strong>
            <span>{queue.length} leads</span>
          </header>
          <div className="prospecting-queue-list">
            {queue.slice(0, 24).map((lead) => (
              <button
                key={lead.id}
                className={`${lead.id === activeId ? "active" : ""} ${
                  lead.overdue ? "overdue" : ""
                }`}
                onClick={() => setSelectedId(lead.id)}
              >
                <Flag
                  className={`queue-priority priority-${lead.priority.toLowerCase()}`}
                  size={14}
                  fill="currentColor"
                />
                <time>{lead.dueTime}</time>
                <span>
                  <strong>{lead.handle}</strong>
                  <small>{lead.stage}</small>
                </span>
                {lead.overdue ? (
                  <em>Atrasado</em>
                ) : (
                  <i aria-label="Pendente" />
                )}
              </button>
            ))}
          </div>
          <footer>
            <span>
              <Flag size={12} fill="currentColor" /> Urgente
            </span>
            <span>J/K para navegar</span>
          </footer>
        </aside>

        {selectedLead ? (
          <section className="prospecting-context">
            <header className="context-lead-header">
              <span className="context-instagram">
                <Instagram size={22} />
              </span>
              <div>
                <h2>{selectedLead.handle}</h2>
                <p>
                  {selectedLead.category} · {selectedLead.siteStatus}
                </p>
              </div>
              <button
                className="button button--secondary"
                onClick={() => onSelectLead(selectedLead.id)}
              >
                Abrir ficha completa
                <ExternalLink size={15} />
              </button>
            </header>

            <div className="context-meta">
              <label>
                <span>Responsável</span>
                <strong>{selectedLead.owner}</strong>
              </label>
              <label>
                <span>Prioridade</span>
                <select
                  value={selectedLead.priority}
                  onChange={(event) =>
                    onPriorityChange(
                      selectedLead.id,
                      event.target.value as Priority,
                    )
                  }
                >
                  <option>Urgente</option>
                  <option>Alta</option>
                  <option>Normal</option>
                  <option>Baixa</option>
                </select>
              </label>
              <label>
                <span>Etapa</span>
                <strong>{selectedLead.stage}</strong>
              </label>
            </div>

            <div className="context-next-action">
              <i>
                <ArrowRight size={25} />
              </i>
              <span>
                <small>Próxima ação</small>
                <strong>{selectedLead.nextAction}</strong>
                <p>Execute a ação e registre o resultado ao lado.</p>
              </span>
            </div>

            <div className="context-contact">
              <span>Canais de contato</span>
              <ContactActions
                lead={selectedLead}
                onOpenMessages={() => onOpenMessages(selectedLead.id)}
              />
            </div>

            <div className="context-activity">
              <header>
                <strong>Atividade recente</strong>
                <button onClick={() => onSelectLead(selectedLead.id)}>
                  Ver todas
                </button>
              </header>
              {selectedLead.activities
                .slice(-3)
                .reverse()
                .map((activity, index) => (
                  <article key={`${activity.id}-${index}`}>
                    <i>
                      {index === 0 ? (
                        <Check size={14} />
                      ) : (
                        <MessageCircleMore size={14} />
                      )}
                    </i>
                    <span>
                      <strong>{activity.title}</strong>
                      <small>{activity.time}</small>
                    </span>
                  </article>
                ))}
            </div>

            <label className="context-note">
              <span>Notas internas</span>
              <textarea
                value={note}
                maxLength={500}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Adicione uma observação sobre este lead..."
              />
              <small>{note.length}/500</small>
            </label>
          </section>
        ) : (
          <section className="prospecting-context empty">
            <Search size={28} />
            <h2>Nenhum lead nesta fila</h2>
            <p>Altere os filtros para continuar a prospecção.</p>
          </section>
        )}

        <aside className="outcome-panel">
          <header>
            <h2>Registrar resultado</h2>
            <p>Isso atualiza a etapa e agenda o próximo passo.</p>
          </header>
          <div className="outcome-options">
            {outcomes.map((outcome) => {
              const Icon = outcome.icon;
              return (
                <button
                  key={outcome.value}
                  className={`${selectedOutcome === outcome.value ? "active" : ""} tone-${outcome.tone}`}
                  onClick={() => {
                    setSelectedOutcome(outcome.value);
                    if (outcome.value === "Interessado")
                      setNextAction("Solicitar materiais");
                    if (outcome.value === "Sem resposta")
                      setNextAction("Enviar mensagem de follow-up");
                    if (outcome.value === "Retornar depois")
                      setNextAction("Retomar contato");
                    if (outcome.value === "Não interessado")
                      setNextAction("Encerrar lead");
                  }}
                >
                  <i>
                    <Icon size={19} />
                  </i>
                  <span>
                    <strong>{outcome.label}</strong>
                    <small>{outcome.description}</small>
                  </span>
                </button>
              );
            })}
          </div>

          <label className="outcome-field">
            <span>Próxima ação</span>
            <select
              value={nextAction}
              onChange={(event) => setNextAction(event.target.value)}
            >
              {nextActions.map((action) => (
                <option key={action}>{action}</option>
              ))}
            </select>
          </label>

          <div className="outcome-schedule">
            <label className="outcome-field">
              <span>Dia</span>
              <select
                value={scheduleDay}
                onChange={(event) =>
                  setScheduleDay(event.target.value as WeekDay)
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
            <label className="outcome-field">
              <span>Horário</span>
              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </label>
          </div>

          <button
            className="button button--primary outcome-save"
            disabled={!selectedLead}
            onClick={saveAndNext}
          >
            Salvar e abrir próximo
            <ArrowRight size={18} />
          </button>
        </aside>
      </div>
    </div>
  );
}

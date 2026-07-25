import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CalendarRange,
  CheckSquare2,
  ChevronDown,
  Clock3,
  Flag,
  Import,
  ListFilter,
  Plus,
  Search,
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Lead, Owner, Priority, Stage, WeekDay } from "../types";
import { ContactActions } from "./ContactActions";
import { StageBadge } from "./StageBadge";

type DayFilter = WeekDay | "Atrasados" | "Todos";

const dayOrder: DayFilter[] = [
  "Hoje",
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Atrasados",
  "Todos",
];

const priorityWeight: Record<Priority, number> = {
  Urgente: 0,
  Alta: 1,
  Normal: 2,
  Baixa: 3,
};

interface DashboardProps {
  leads: Lead[];
  onSelectLead: (leadId: number) => void;
  onNewLead: () => void;
  onImport: () => void;
  onOpenMessages: (leadId: number) => void;
  onPriorityChange: (leadId: number, priority: Priority) => void;
  onBulkOwner: (leadIds: number[], owner: Owner) => void;
  onBulkStage: (leadIds: number[], stage: Stage) => void;
  onBulkSchedule: (leadIds: number[], day: WeekDay) => void;
}

export function Dashboard({
  leads,
  onSelectLead,
  onNewLead,
  onImport,
  onOpenMessages,
  onPriorityChange,
  onBulkOwner,
  onBulkStage,
  onBulkSchedule,
}: DashboardProps) {
  const [activeDay, setActiveDay] = useState<DayFilter>("Hoje");
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState<Owner | "Todos">("Todos");
  const [stage, setStage] = useState<Stage | "Todos">("Todos");
  const [priority, setPriority] = useState<Priority | "Todas">("Todas");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [page, setPage] = useState(1);

  const counts = useMemo(() => {
    const result: Record<DayFilter, number> = {
      Hoje: 0,
      Seg: 0,
      Ter: 0,
      Qua: 0,
      Qui: 0,
      Sex: 0,
      Atrasados: 0,
      Todos: leads.length,
    };
    leads.forEach((lead) => {
      result[lead.scheduleDay] += 1;
      if (lead.overdue) result.Atrasados += 1;
    });
    return result;
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return leads
      .filter((lead) => {
        const dayMatches =
          activeDay === "Todos" ||
          (activeDay === "Atrasados"
            ? lead.overdue
            : lead.scheduleDay === activeDay);
        const queryMatches =
          !normalized ||
          lead.handle.toLowerCase().includes(normalized) ||
          lead.category.toLowerCase().includes(normalized) ||
          lead.nextAction.toLowerCase().includes(normalized);
        return (
          dayMatches &&
          queryMatches &&
          (owner === "Todos" || lead.owner === owner) &&
          (stage === "Todos" || lead.stage === stage) &&
          (priority === "Todas" || lead.priority === priority)
        );
      })
      .sort(
        (a, b) =>
          Number(Boolean(b.overdue)) - Number(Boolean(a.overdue)) ||
          priorityWeight[a.priority] - priorityWeight[b.priority] ||
          a.dueTime.localeCompare(b.dueTime),
      );
  }, [activeDay, leads, owner, priority, query, stage]);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleLeads = filteredLeads.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  const selectAllVisible = (checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      visibleLeads.forEach((lead) =>
        checked ? next.add(lead.id) : next.delete(lead.id),
      );
      return next;
    });
  };

  const selected = [...selectedIds];
  const allVisibleSelected =
    visibleLeads.length > 0 &&
    visibleLeads.every((lead) => selectedIds.has(lead.id));

  const clearFilters = () => {
    setQuery("");
    setOwner("Todos");
    setStage("Todos");
    setPriority("Todas");
    setPage(1);
  };

  return (
    <div className="operations-page">
      <header className="operations-header">
        <div>
          <h1>Operação da semana</h1>
        </div>
        <div className="week-switcher" aria-label="Semana atual">
          <button aria-label="Semana anterior">
            <ArrowLeft size={17} />
          </button>
          <span>
            <CalendarRange size={17} />
            20–24 jul
          </span>
          <button aria-label="Próxima semana">
            <ArrowRight size={17} />
          </button>
        </div>
        <div className="operations-heading-actions">
          <button className="button button--primary" onClick={onNewLead}>
            <Plus size={18} />
            Novo lead
          </button>
          <button className="button button--secondary" onClick={onImport}>
            <Import size={18} />
            Importar
          </button>
        </div>
      </header>

      <section className="operations-summary" aria-label="Resumo operacional">
        <SummaryItem
          icon={UsersRound}
          value="400"
          label="ativos no mês"
          tone="green"
        />
        <SummaryItem
          icon={Clock3}
          value={String(leads.length)}
          label="na fila da semana"
          tone="blue"
        />
        <SummaryItem
          icon={AlertCircle}
          value={String(counts.Atrasados)}
          label="atrasados"
          tone="amber"
        />
        <SummaryItem
          icon={CalendarDays}
          value={String(
            leads.filter((lead) => lead.nextAction === "Definir próxima ação")
              .length,
          )}
          label="sem próxima ação"
          tone="purple"
        />
      </section>

      <section className="weekly-queue">
        <div className="week-tabs" role="tablist" aria-label="Dias da semana">
          {dayOrder.map((day) => (
            <button
              key={day}
              role="tab"
              aria-selected={activeDay === day}
              className={`${activeDay === day ? "active" : ""} ${
                day === "Atrasados" ? "danger" : ""
              }`}
              onClick={() => {
                setActiveDay(day);
                setPage(1);
              }}
            >
              {day}
              <span>{counts[day]}</span>
            </button>
          ))}
        </div>

        <div className="queue-filterbar">
          <label className="search-field weekly-search">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar lead, segmento ou ação..."
            />
          </label>
          <FilterSelect
            label="Responsável"
            value={owner}
            onChange={(value) => setOwner(value as Owner | "Todos")}
            options={["Todos", "Você", "Sócia"]}
          />
          <FilterSelect
            label="Etapa"
            value={stage}
            onChange={(value) => setStage(value as Stage | "Todos")}
            options={[
              "Todos",
              "Validar",
              "Contatar",
              "Interessado",
              "Materiais",
              "Preview",
              "Aprovação",
              "Pagamento",
            ]}
          />
          <FilterSelect
            label="Prioridade"
            value={priority}
            onChange={(value) => setPriority(value as Priority | "Todas")}
            options={["Todas", "Urgente", "Alta", "Normal", "Baixa"]}
          />
          <button className="button button--quiet clear-filter" onClick={clearFilters}>
            <ListFilter size={17} />
            Limpar
          </button>
        </div>

        {selectedIds.size > 0 && (
          <div className="bulk-toolbar">
            <span>
              <CheckSquare2 size={18} />
              <strong>{selectedIds.size}</strong> selecionados
            </span>
            <i />
            <button onClick={() => onBulkOwner(selected, "Sócia")}>
              <UserRoundCog size={17} />
              Passar para sócia
            </button>
            <button onClick={() => onBulkStage(selected, "Contatar")}>
              <ArrowRight size={17} />
              Mover para Contatar
            </button>
            <button onClick={() => onBulkSchedule(selected, "Ter")}>
              <CalendarDays size={17} />
              Reagendar para terça
            </button>
            <button
              className="bulk-clear"
              onClick={() => setSelectedIds(new Set())}
            >
              Limpar seleção
            </button>
          </div>
        )}

        <div className="weekly-table-scroll">
          <table className="weekly-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Selecionar leads visíveis"
                    checked={allVisibleSelected}
                    onChange={(event) => selectAllVisible(event.target.checked)}
                  />
                </th>
                <th>Prioridade</th>
                <th>Lead</th>
                <th>Responsável</th>
                <th>Etapa</th>
                <th>Próxima ação</th>
                <th>Agendado</th>
                <th>Contato</th>
              </tr>
            </thead>
            <tbody>
              {visibleLeads.map((lead) => (
                <tr
                  key={lead.id}
                  className={`${selectedIds.has(lead.id) ? "selected" : ""} ${
                    lead.overdue ? "overdue" : ""
                  }`}
                  onClick={() => onSelectLead(lead.id)}
                >
                  <td onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${lead.handle}`}
                      checked={selectedIds.has(lead.id)}
                      onChange={(event) =>
                        setSelectedIds((current) => {
                          const next = new Set(current);
                          event.target.checked
                            ? next.add(lead.id)
                            : next.delete(lead.id);
                          return next;
                        })
                      }
                    />
                  </td>
                  <td>
                    <PriorityControl
                      priority={lead.priority}
                      onChange={(next) => onPriorityChange(lead.id, next)}
                    />
                  </td>
                  <td>
                    <span className="weekly-lead">
                      <i>{lead.handle.slice(1, 3).toUpperCase()}</i>
                      <span>
                        <strong>{lead.handle}</strong>
                        <small>{lead.category}</small>
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className="weekly-owner">
                      <i className={lead.owner === "Você" ? "primary" : ""}>
                        {lead.owner === "Você" ? "V" : "S"}
                      </i>
                      {lead.owner}
                    </span>
                  </td>
                  <td>
                    <StageBadge stage={lead.stage} />
                  </td>
                  <td>
                    <span
                      className={`weekly-next-action ${
                        lead.nextAction === "Definir próxima ação"
                          ? "missing"
                          : ""
                      }`}
                    >
                      <ArrowRight size={16} />
                      <strong>{lead.nextAction}</strong>
                    </span>
                  </td>
                  <td>
                    <span
                      className={`weekly-schedule ${
                        lead.overdue ? "danger" : ""
                      }`}
                    >
                      {lead.overdue ? "Atrasado" : lead.scheduleDay},{" "}
                      {lead.dueTime}
                    </span>
                  </td>
                  <td>
                    <ContactActions
                      lead={lead}
                      compact
                      onOpenMessages={() => onOpenMessages(lead.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleLeads.length === 0 && (
            <div className="weekly-empty">
              <Search size={23} />
              <strong>Nenhum lead nesta visualização</strong>
              <p>Ajuste os filtros ou escolha outro dia da semana.</p>
              <button className="button button--secondary" onClick={clearFilters}>
                Limpar filtros
              </button>
            </div>
          )}
        </div>

        <footer className="weekly-footer">
          <span>
            Mostrando{" "}
            {filteredLeads.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–
            {Math.min(safePage * pageSize, filteredLeads.length)} de{" "}
            {filteredLeads.length}
          </span>
          <div>
            <button
              disabled={safePage === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Anterior
            </button>
            <span>
              Página {safePage} de {totalPages}
            </span>
            <button
              disabled={safePage === totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
            >
              Próxima
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function SummaryItem({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof UsersRound;
  value: string;
  label: string;
  tone: string;
}) {
  return (
    <div className="summary-item">
      <i className={`summary-icon tone-${tone}`}>
        <Icon size={21} />
      </i>
      <span>
        <strong>{value}</strong>
        <small>{label}</small>
      </span>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="queue-select">
      <small>{label}</small>
      <span>
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
        <ChevronDown size={15} />
      </span>
    </label>
  );
}

function PriorityControl({
  priority,
  onChange,
}: {
  priority: Priority;
  onChange: (priority: Priority) => void;
}) {
  const priorities: Priority[] = ["Urgente", "Alta", "Normal", "Baixa"];
  return (
    <label
      className={`priority-control priority-${priority.toLowerCase()}`}
      onClick={(event) => event.stopPropagation()}
    >
      <Flag size={14} fill="currentColor" />
      <select
        aria-label={`Prioridade ${priority}`}
        value={priority}
        onChange={(event) => onChange(event.target.value as Priority)}
      >
        {priorities.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
    </label>
  );
}

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CalendarRange,
  CheckSquare2,
  ChevronDown,
  Clock3,
  Import,
  ListFilter,
  Plus,
  Search,
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import type { Lead, Owner, Priority, Stage, WeekDay } from "../types";
import { LeadCard, ownerName } from "./LeadCard";

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
  const deferredQuery = useDeferredValue(query);
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
    const normalized = deferredQuery.trim().toLowerCase();
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
  }, [activeDay, deferredQuery, leads, owner, priority, stage]);

  const pageSize = 24;
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleLeads = filteredLeads.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const nextLead = filteredLeads[0];
  const selected = [...selectedIds];
  const selectedVisibleCount = visibleLeads.filter((lead) =>
    selectedIds.has(lead.id),
  ).length;
  const activeFilterCount =
    Number(Boolean(query.trim())) +
    Number(owner !== "Todos") +
    Number(stage !== "Todos") +
    Number(priority !== "Todas");

  const team = [
    {
      name: "Hugo",
      total: leads.filter((lead) => lead.owner === "Você").length,
      today: leads.filter(
        (lead) => lead.owner === "Você" && lead.scheduleDay === "Hoje",
      ).length,
    },
    {
      name: "Raiza",
      total: leads.filter((lead) => lead.owner === "Sócia").length,
      today: leads.filter(
        (lead) => lead.owner === "Sócia" && lead.scheduleDay === "Hoje",
      ).length,
    },
  ];

  const clearFilters = () => {
    setQuery("");
    setOwner("Todos");
    setStage("Todos");
    setPriority("Todas");
    setPage(1);
  };

  const toggleVisible = () => {
    const shouldSelect = selectedVisibleCount !== visibleLeads.length;
    setSelectedIds((current) => {
      const next = new Set(current);
      visibleLeads.forEach((lead) =>
        shouldSelect ? next.add(lead.id) : next.delete(lead.id),
      );
      return next;
    });
  };

  return (
    <div className="operations-page">
      <header className="operations-header">
        <div className="operations-title">
          <h1>Fila de hoje</h1>
          <p>Veja o que precisa de atenção e avance um contato por vez.</p>
        </div>
        <div className="week-switcher" aria-label="Semana atual">
          <button aria-label="Semana anterior">
            <ArrowLeft size={18} />
          </button>
          <span>
            <CalendarRange size={18} />
            Semana atual
          </span>
          <button aria-label="Próxima semana">
            <ArrowRight size={18} />
          </button>
        </div>
        <div className="operations-heading-actions">
          <button className="button button--primary" onClick={onNewLead}>
            <Plus size={19} />
            Novo lead
          </button>
          <button className="button button--secondary" onClick={onImport}>
            <Import size={19} />
            <span>Importar</span>
          </button>
        </div>
      </header>

      {nextLead ? (
        <section className="next-action-section" aria-labelledby="next-action-title">
          <h2 id="next-action-title">Fazer agora</h2>
          <div className="next-action-focus">
          <div className="next-action-icon">
            <ArrowRight size={25} />
          </div>
          <div className="next-action-copy">
            <span>Próxima ação recomendada</span>
            <strong>{nextLead.nextAction}</strong>
            <small>
              {nextLead.handle} · {ownerName(nextLead.owner)}
              {nextLead.overdue ? " · Está atrasado" : ` · ${nextLead.dueTime}`}
            </small>
          </div>
          <button
            className="button button--primary"
            onClick={() => onSelectLead(nextLead.id)}
          >
            Abrir lead
            <ArrowRight size={18} />
          </button>
          </div>
        </section>
      ) : (
        <section className="next-action-section" aria-labelledby="next-action-title">
          <h2 id="next-action-title">Fazer agora</h2>
          <div className="next-action-focus is-empty">
            <CheckSquare2 size={24} />
            <div>
              <strong>Fila concluída</strong>
              <small>Não há ações pendentes neste filtro.</small>
            </div>
          </div>
        </section>
      )}

      <section className="team-workload" aria-label="Carga da equipe">
        <div className="team-workload-title">
          <UsersRound size={20} />
          <span>
            <strong>Equipe</strong>
            <small>Distribuição visível evita sobrecarga.</small>
          </span>
        </div>
        {team.map((member) => (
          <div className="team-member-load" key={member.name}>
            <i>{member.name.slice(0, 1)}</i>
            <span>
              <strong>{member.name}</strong>
              <small>
                {member.today} hoje · {member.total} ativos
              </small>
            </span>
          </div>
        ))}
        <div className="team-member-load is-future">
          <Plus size={18} />
          <span>
            <strong>Próximo vendedor</strong>
            <small>Capacidade pronta para crescer</small>
          </span>
        </div>
      </section>

      <section className="operations-summary" aria-label="Resumo operacional">
        <SummaryItem
          icon={Clock3}
          value={String(counts.Hoje)}
          label="ações para hoje"
          tone="blue"
        />
        <SummaryItem
          icon={AlertCircle}
          value={String(counts.Atrasados)}
          label="atrasadas"
          tone="amber"
        />
        <SummaryItem
          icon={CalendarDays}
          value={String(leads.length)}
          label="leads ativos"
          tone="purple"
        />
      </section>

      <section className="weekly-queue">
        <div className="queue-section-heading">
          <div>
            <h2>
              <span className="desktop-label">Fila completa</span>
              <span className="mobile-label">Próximos</span>
            </h2>
            <p>{filteredLeads.length} contatos nesta visualização</p>
          </div>
          <button className="button button--quiet select-visible" onClick={toggleVisible}>
            <CheckSquare2 size={18} />
            {selectedVisibleCount === visibleLeads.length && visibleLeads.length
              ? "Desmarcar página"
              : "Selecionar página"}
          </button>
        </div>

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

        <details className="queue-filters">
          <summary>
            <ListFilter size={18} />
            Filtrar fila
            {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
            <ChevronDown size={17} />
          </summary>
          <div className="queue-filterbar">
            <label className="search-field weekly-search">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Buscar perfil, segmento ou ação..."
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
              Limpar filtros
            </button>
          </div>
        </details>

        {selectedIds.size > 0 && (
          <div className="bulk-toolbar">
            <span>
              <CheckSquare2 size={19} />
              <strong>{selectedIds.size}</strong> selecionados
            </span>
            <i />
            <button onClick={() => onBulkOwner(selected, "Sócia")}>
              <UserRoundCog size={18} />
              Passar para Raiza
            </button>
            <button onClick={() => onBulkStage(selected, "Contatar")}>
              <ArrowRight size={18} />
              Mover para Contatar
            </button>
            <button onClick={() => onBulkSchedule(selected, "Ter")}>
              <CalendarDays size={18} />
              Reagendar
            </button>
            <button
              className="bulk-clear"
              onClick={() => setSelectedIds(new Set())}
            >
              Limpar seleção
            </button>
          </div>
        )}

        <div className="lead-card-list">
          {visibleLeads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              selected={selectedIds.has(lead.id)}
              onSelect={() => onSelectLead(lead.id)}
              onOpenMessages={() => onOpenMessages(lead.id)}
              onPriorityChange={(next) => onPriorityChange(lead.id, next)}
              onSelectionChange={(checked) =>
                setSelectedIds((current) => {
                  const next = new Set(current);
                  checked ? next.add(lead.id) : next.delete(lead.id);
                  return next;
                })
              }
            />
          ))}
          {visibleLeads.length === 0 && (
            <div className="weekly-empty">
              <Search size={25} />
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
              {safePage} de {totalPages}
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
        <Icon size={22} />
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
        <ChevronDown size={16} />
      </span>
    </label>
  );
}

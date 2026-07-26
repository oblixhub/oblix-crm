import { Search, SlidersHorizontal } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import type { Lead, Priority, Stage } from "../types";
import { LeadCard } from "./LeadCard";

interface LeadDirectoryProps {
  leads: Lead[];
  onSelectLead: (id: number) => void;
  onOpenMessages: (id: number) => void;
  onPriorityChange: (id: number, priority: Priority) => void;
}

export function LeadDirectory({
  leads,
  onSelectLead,
  onOpenMessages,
  onPriorityChange,
}: LeadDirectoryProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [stage, setStage] = useState<Stage | "Todas">("Todas");
  const [priority, setPriority] = useState<Priority | "Todas">("Todas");
  const [visibleCount, setVisibleCount] = useState(48);

  const results = useMemo(() => {
    const normalized = deferredQuery.toLowerCase().trim();
    return leads
      .filter(
        (lead) =>
          (!normalized ||
            lead.handle.toLowerCase().includes(normalized) ||
            lead.category.toLowerCase().includes(normalized) ||
            lead.nextAction.toLowerCase().includes(normalized)) &&
          (stage === "Todas" || lead.stage === stage) &&
          (priority === "Todas" || lead.priority === priority),
      )
      .sort(
        (a, b) =>
          Number(Boolean(b.overdue)) - Number(Boolean(a.overdue)) ||
          a.handle.localeCompare(b.handle),
      );
  }, [deferredQuery, leads, priority, stage]);

  return (
    <div className="standard-page refined-standard-page">
      <div className="page-heading directory-heading">
        <div>
          <span className="page-eyebrow">Base de contatos</span>
          <h1>Todos os leads</h1>
          <p>
            {results.length} resultados · cards compactos para localizar e agir
            rápido.
          </p>
        </div>
      </div>

      <section className="directory-filter-card">
        <label className="search-field search-field--large">
          <Search size={19} />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setVisibleCount(48);
            }}
            placeholder="Buscar perfil, segmento ou próxima ação"
          />
        </label>
        <div className="directory-filter-label">
          <SlidersHorizontal size={18} />
          Filtros
        </div>
        <select
          aria-label="Filtrar por etapa"
          value={stage}
          onChange={(event) => {
            setStage(event.target.value as Stage | "Todas");
            setVisibleCount(48);
          }}
        >
          <option>Todas</option>
          <option>Contatar</option>
          <option>Interessado</option>
          <option>Materiais</option>
          <option>Preview</option>
          <option>Aprovação</option>
          <option>Pagamento</option>
        </select>
        <select
          aria-label="Filtrar por prioridade"
          value={priority}
          onChange={(event) => {
            setPriority(event.target.value as Priority | "Todas");
            setVisibleCount(48);
          }}
        >
          <option>Todas</option>
          <option>Urgente</option>
          <option>Alta</option>
          <option>Normal</option>
          <option>Baixa</option>
        </select>
      </section>

      <section className="lead-card-list directory-card-list">
        {results.slice(0, visibleCount).map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onSelect={() => onSelectLead(lead.id)}
            onOpenMessages={() => onOpenMessages(lead.id)}
            onPriorityChange={(next) => onPriorityChange(lead.id, next)}
          />
        ))}
        {results.length === 0 && (
          <div className="weekly-empty">
            <Search size={25} />
            <strong>Nenhum lead encontrado</strong>
            <p>Tente outro perfil ou ajuste os filtros.</p>
          </div>
        )}
      </section>

      {visibleCount < results.length && (
        <button
          className="button button--secondary directory-load-more"
          onClick={() => setVisibleCount((current) => current + 48)}
        >
          Mostrar mais 48 leads
        </button>
      )}
    </div>
  );
}

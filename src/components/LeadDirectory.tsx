import { Flag, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Lead, Priority, Stage } from "../types";
import { ContactActions } from "./ContactActions";
import { StageBadge } from "./StageBadge";

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
  const [stage, setStage] = useState<Stage | "Todas">("Todas");
  const [priority, setPriority] = useState<Priority | "Todas">("Todas");

  const results = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    return leads.filter(
      (lead) =>
        (!normalized ||
          lead.handle.toLowerCase().includes(normalized) ||
          lead.category.toLowerCase().includes(normalized)) &&
        (stage === "Todas" || lead.stage === stage) &&
        (priority === "Todas" || lead.priority === priority),
    );
  }, [leads, priority, query, stage]);

  return (
    <div className="standard-page refined-standard-page">
      <div className="page-heading page-heading--actions">
        <div>
          <h1>Leads</h1>
          <p>Base completa com prioridade, etapa e próximo compromisso.</p>
        </div>
        <div className="directory-tools">
          <label className="search-field search-field--large">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por perfil ou segmento"
            />
          </label>
          <select
            value={stage}
            onChange={(event) =>
              setStage(event.target.value as Stage | "Todas")
            }
          >
            <option>Todas</option>
            <option>Validar</option>
            <option>Contatar</option>
            <option>Interessado</option>
            <option>Materiais</option>
            <option>Preview</option>
            <option>Aprovação</option>
            <option>Pagamento</option>
          </select>
          <select
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
        </div>
      </div>
      <section className="panel directory-panel refined-directory">
        <div className="table-scroll">
          <table className="lead-table directory-table">
            <thead>
              <tr>
                <th>Perfil</th>
                <th>Prioridade</th>
                <th>Responsável</th>
                <th>Etapa</th>
                <th>Próxima ação</th>
                <th>Agenda</th>
                <th>Contato</th>
              </tr>
            </thead>
            <tbody>
              {results.slice(0, 50).map((lead) => (
                <tr key={lead.id} onClick={() => onSelectLead(lead.id)}>
                  <td>
                    <span className="directory-lead">
                      <strong>{lead.handle}</strong>
                      <small>{lead.category}</small>
                    </span>
                  </td>
                  <td onClick={(event) => event.stopPropagation()}>
                    <label
                      className={`priority-control priority-${lead.priority.toLowerCase()}`}
                    >
                      <Flag size={14} fill="currentColor" />
                      <select
                        value={lead.priority}
                        onChange={(event) =>
                          onPriorityChange(
                            lead.id,
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
                  </td>
                  <td>{lead.owner}</td>
                  <td>
                    <StageBadge stage={lead.stage} />
                  </td>
                  <td>
                    <strong className="directory-action">
                      {lead.nextAction}
                    </strong>
                  </td>
                  <td>
                    {lead.overdue ? "Atrasado" : lead.scheduleDay},{" "}
                    {lead.dueTime}
                  </td>
                  <td>
                    <ContactActions
                      compact
                      lead={lead}
                      onOpenMessages={() => onOpenMessages(lead.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="directory-footer">
          Mostrando {Math.min(50, results.length)} de {results.length} leads
        </footer>
      </section>
    </div>
  );
}

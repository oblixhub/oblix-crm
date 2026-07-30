import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  LockKeyhole,
  Search,
} from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import type {
  CommercialRecord,
  Lead,
  LeadProject,
  PaymentInstallment,
} from "../types";

interface FinanceViewProps {
  leads: Lead[];
  commercial: Record<string, CommercialRecord>;
  installments: PaymentInstallment[];
  projects: Record<string, LeadProject>;
  onSelectLead: (leadId: number) => void;
}

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function FinanceView({
  leads,
  commercial,
  installments,
  projects,
  onSelectLead,
}: FinanceViewProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const records = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    return leads
      .flatMap((lead) => {
        if (!lead.remoteId) return [];
        const deal = commercial[lead.remoteId];
        if (!deal) return [];
        const leadInstallments = installments.filter(
          (item) => item.leadId === lead.remoteId,
        );
        return [
          {
            lead,
            deal,
            project: projects[lead.remoteId],
            installments: leadInstallments,
          },
        ];
      })
      .filter(
        ({ lead, deal }) =>
          !normalized ||
          lead.handle.toLowerCase().includes(normalized) ||
          deal.status.toLowerCase().includes(normalized) ||
          deal.paymentMethod.toLowerCase().includes(normalized),
      )
      .sort((a, b) => {
        const aDue =
          a.installments.find((item) => item.status !== "Pago")?.dueDate ??
          "9999-12-31";
        const bDue =
          b.installments.find((item) => item.status !== "Pago")?.dueDate ??
          "9999-12-31";
        return aDue.localeCompare(bDue);
      });
  }, [commercial, deferredQuery, installments, leads, projects]);

  const received = installments
    .filter((item) => item.status === "Pago")
    .reduce((total, item) => total + item.amount, 0);
  const pending = installments
    .filter((item) => item.status === "Pendente" || item.status === "Atrasado")
    .reduce((total, item) => total + item.amount, 0);
  const overdue = installments.filter(
    (item) =>
      item.status === "Atrasado" ||
      (item.status === "Pendente" &&
        item.dueDate &&
        new Date(`${item.dueDate}T23:59:59`).getTime() < Date.now()),
  ).length;

  return (
    <div className="standard-page finance-private-page">
      <header className="page-heading private-finance-heading">
        <div>
          <span>
            <LockKeyhole size={17} />
            Visível somente para Hugo e Raiza
          </span>
          <h1>Financeiro e entrega</h1>
          <p>Cobranças, parcelas, prazos e andamento dos projetos.</p>
        </div>
      </header>

      <section className="finance-summary private-finance-summary">
        <div>
          <CircleDollarSign size={20} />
          <span>A receber</span>
          <strong>{currency.format(pending)}</strong>
        </div>
        <div>
          <CheckCircle2 size={20} />
          <span>Recebido</span>
          <strong>{currency.format(received)}</strong>
        </div>
        <div className={overdue > 0 ? "is-danger" : ""}>
          <AlertCircle size={20} />
          <span>Cobranças atrasadas</span>
          <strong>{overdue}</strong>
        </div>
      </section>

      <label className="search-field finance-search">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar cliente, pagamento ou status..."
        />
      </label>

      <section className="finance-card-list">
        {records.map(({ lead, deal, project, installments: leadPayments }) => {
          const nextPayment = leadPayments.find(
            (item) => item.status !== "Pago" && item.status !== "Cancelado",
          );
          return (
            <button
              type="button"
              className="finance-client-card"
              key={lead.id}
              onClick={() => onSelectLead(lead.id)}
            >
              <div className="finance-client-main">
                <span>
                  <strong>{lead.handle}</strong>
                  <small>
                    {deal.paymentMethod} · {deal.installmentsCount} parcela
                    {deal.installmentsCount > 1 ? "s" : ""}
                  </small>
                </span>
                <strong>{currency.format(deal.amount)}</strong>
              </div>
              <div className="finance-client-status">
                <span className={`finance-status status-${deal.status.toLowerCase().replaceAll(" ", "-")}`}>
                  {deal.status}
                </span>
                <span>
                  <CalendarClock size={15} />
                  {nextPayment?.dueDate
                    ? `Cobrar em ${new Date(`${nextPayment.dueDate}T12:00:00`).toLocaleDateString("pt-BR")}`
                    : "Sem cobrança agendada"}
                </span>
                <span>{project?.status ?? "Projeto não iniciado"}</span>
              </div>
            </button>
          );
        })}
        {records.length === 0 && (
          <div className="finance-empty">
            <CircleDollarSign size={28} />
            <strong>Nenhuma negociação registrada</strong>
            <p>Abra um lead e preencha o bloco Comercial privado.</p>
          </div>
        )}
      </section>
    </div>
  );
}

import { CheckCircle2, Clock3, Layers3 } from "lucide-react";
import { useMemo, useState } from "react";
import { ALL_BATCHES, getBatchNames, matchesBatch } from "../lib/leads";
import type { Lead } from "../types";

export function FinanceView({ leads }: { leads: Lead[] }) {
  const [batch, setBatch] = useState<string>(ALL_BATCHES);
  const batches = useMemo(() => getBatchNames(leads), [leads]);
  const commercialLeads = leads.filter(
    (lead) =>
      (lead.paymentStatus === "Aguardando PIX" ||
        lead.paymentStatus === "Pago") &&
      matchesBatch(lead, batch),
  );
  const paid = commercialLeads
    .filter((lead) => lead.paymentStatus === "Pago")
    .reduce((sum, lead) => sum + lead.amount, 0);

  return (
    <div className="standard-page">
      <div className="page-heading">
        <h1>Financeiro</h1>
        <p>Controle manual de ofertas, PIX e pagamentos confirmados.</p>
      </div>
      <div className="finance-summary">
        <div>
          <span>Aguardando PIX</span>
          <strong>
            {
              commercialLeads.filter(
                (lead) => lead.paymentStatus === "Aguardando PIX",
              ).length
            }
          </strong>
        </div>
        <div>
          <span>Recebido</span>
          <strong>R$ {paid}</strong>
        </div>
      </div>
      <div className="list-filterbar">
        <Layers3 size={18} />
        <label>
          <span>Filtrar por lote</span>
          <select value={batch} onChange={(event) => setBatch(event.target.value)}>
            <option>{ALL_BATCHES}</option>
            {batches.map((batchName) => (
              <option key={batchName}>{batchName}</option>
            ))}
          </select>
        </label>
      </div>
      <section className="panel directory-panel">
        <div className="table-scroll">
          <table className="lead-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Lote</th>
                <th>Oferta</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Próxima ação</th>
              </tr>
            </thead>
            <tbody>
              {commercialLeads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <strong>{lead.handle}</strong>
                  </td>
                  <td>
                    <span className="batch-chip">
                      <Layers3 size={12} />
                      {lead.batchName}
                    </span>
                  </td>
                  <td>{lead.offer}</td>
                  <td>R$ {lead.amount}</td>
                  <td>
                    <span
                      className={`finance-status ${
                        lead.paymentStatus === "Pago" ? "paid" : ""
                      }`}
                    >
                      {lead.paymentStatus === "Pago" ? (
                        <CheckCircle2 size={15} />
                      ) : (
                        <Clock3 size={15} />
                      )}
                      {lead.paymentStatus}
                    </span>
                  </td>
                  <td>
                    {lead.paymentStatus === "Pago"
                      ? "Preparar entrega"
                      : "Confirmar recebimento"}
                  </td>
                </tr>
              ))}
              {commercialLeads.length === 0 && (
                <tr>
                  <td className="table-empty" colSpan={6}>
                    Nenhum pagamento encontrado neste lote.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

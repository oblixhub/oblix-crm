import { CheckCircle2, Clock3 } from "lucide-react";
import type { Lead } from "../types";

export function FinanceView({ leads }: { leads: Lead[] }) {
  const commercialLeads = leads.filter(
    (lead) =>
      lead.paymentStatus === "Aguardando PIX" ||
      lead.paymentStatus === "Pago",
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
      <section className="panel directory-panel">
        <div className="table-scroll">
          <table className="lead-table">
            <thead>
              <tr>
                <th>Cliente</th>
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
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

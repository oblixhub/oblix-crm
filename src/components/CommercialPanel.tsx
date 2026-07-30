import {
  CalendarClock,
  CircleDollarSign,
  Globe2,
  LockKeyhole,
  Save,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  CommercialRecord,
  Lead,
  LeadProject,
  PaymentInstallment,
} from "../types";

const commercialStatuses: CommercialRecord["status"][] = [
  "Não negociado",
  "Negociação",
  "Aguardando pagamento",
  "Parcial",
  "Pago",
  "Atrasado",
  "Cancelado",
];

const projectStatuses: LeadProject["status"][] = [
  "Aguardando materiais",
  "Materiais recebidos",
  "Em produção",
  "Revisão interna",
  "Preview enviado",
  "Ajustes solicitados",
  "Aprovado",
  "Pagamento pendente",
  "Pago",
  "Entregue",
];

const dateInputValue = (value?: string) => value?.slice(0, 10) ?? "";

interface CommercialPanelProps {
  lead: Lead;
  commercial?: CommercialRecord;
  project?: LeadProject;
  installments: PaymentInstallment[];
  onSave: (
    commercial: CommercialRecord,
    project: LeadProject,
    installments: PaymentInstallment[],
  ) => Promise<void>;
}

export function CommercialPanel({
  lead,
  commercial,
  project,
  installments,
  onSave,
}: CommercialPanelProps) {
  const leadId = lead.remoteId ?? String(lead.id);
  const initialCommercial = useMemo<CommercialRecord>(
    () =>
      commercial ?? {
        leadId,
        offerType: lead.offer,
        amount: lead.amount,
        paymentMethod: "Não definido",
        installmentsCount: 1,
        status: "Não negociado",
        domainIncluded: lead.offer === "Com domínio",
        deliveryStatus: "Não iniciado",
        privateNotes: "",
      },
    [commercial, lead.amount, lead.offer, leadId],
  );
  const initialProject = useMemo<LeadProject>(
    () =>
      project ?? {
        leadId,
        status: "Aguardando materiais",
        materialsNotes: "",
        revisionNotes: "",
        deliveryNotes: "",
      },
    [leadId, project],
  );
  const [deal, setDeal] = useState(initialCommercial);
  const [siteProject, setSiteProject] = useState(initialProject);
  const [payments, setPayments] = useState<PaymentInstallment[]>(installments);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDeal(initialCommercial), [initialCommercial]);
  useEffect(() => setSiteProject(initialProject), [initialProject]);
  useEffect(() => setPayments(installments), [installments]);

  useEffect(() => {
    const count = Math.max(1, deal.installmentsCount);
    setPayments((current) =>
      Array.from({ length: count }, (_, index) => {
        const existing = current.find(
          (item) => item.installmentNumber === index + 1,
        );
        return (
          existing ?? {
            leadId,
            installmentNumber: index + 1,
            amount: Number((deal.amount / count).toFixed(2)),
            dueDate: "",
            status: "Pendente",
          }
        );
      }),
    );
  }, [deal.amount, deal.installmentsCount, leadId]);

  const save = async () => {
    setSaving(true);
    await onSave(deal, siteProject, payments);
    setSaving(false);
  };

  return (
    <section className="panel commercial-private-panel">
      <header className="panel-header private-panel-heading">
        <div>
          <span>
            <LockKeyhole size={17} />
            Privado para Hugo e Raiza
          </span>
          <h2>Comercial e entrega</h2>
          <p>Valores, cobrança, domínio e entrega não aparecem para vendedores ou clientes.</p>
        </div>
        <button
          className="button button--primary"
          type="button"
          onClick={() => void save()}
          disabled={saving}
        >
          <Save size={17} />
          {saving ? "Salvando…" : "Salvar privado"}
        </button>
      </header>

      <div className="commercial-form-grid">
        <label>
          <span>Oferta</span>
          <select
            value={deal.offerType}
            onChange={(event) =>
              setDeal((current) => ({
                ...current,
                offerType: event.target.value,
              }))
            }
          >
            <option>Sem domínio</option>
            <option>Com domínio</option>
            <option>Personalizada</option>
          </select>
        </label>
        <label>
          <span>Valor negociado</span>
          <div className="money-input">
            <CircleDollarSign size={17} />
            <input
              type="number"
              min="0"
              step="0.01"
              value={deal.amount}
              onChange={(event) =>
                setDeal((current) => ({
                  ...current,
                  amount: Number(event.target.value),
                }))
              }
            />
          </div>
        </label>
        <label>
          <span>Forma de pagamento</span>
          <select
            value={deal.paymentMethod}
            onChange={(event) =>
              setDeal((current) => ({
                ...current,
                paymentMethod: event.target.value,
              }))
            }
          >
            <option>Não definido</option>
            <option>PIX à vista</option>
            <option>PIX em 2 vezes</option>
            <option>PIX parcelado</option>
            <option>Outro</option>
          </select>
        </label>
        <label>
          <span>Parcelas</span>
          <input
            type="number"
            min="1"
            max="24"
            value={deal.installmentsCount}
            onChange={(event) =>
              setDeal((current) => ({
                ...current,
                installmentsCount: Math.max(1, Number(event.target.value)),
              }))
            }
          />
        </label>
        <label>
          <span>Status comercial</span>
          <select
            value={deal.status}
            onChange={(event) =>
              setDeal((current) => ({
                ...current,
                status: event.target.value as CommercialRecord["status"],
              }))
            }
          >
            {commercialStatuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Data para cobrar</span>
          <input
            type="date"
            value={dateInputValue(deal.nextChargeAt)}
            onChange={(event) =>
              setDeal((current) => ({
                ...current,
                nextChargeAt: event.target.value || undefined,
              }))
            }
          />
        </label>
      </div>

      <div className="private-checkbox-row">
        <label>
          <input
            type="checkbox"
            checked={deal.domainIncluded}
            onChange={(event) =>
              setDeal((current) => ({
                ...current,
                domainIncluded: event.target.checked,
              }))
            }
          />
          <Globe2 size={17} />
          Domínio incluído
        </label>
      </div>

      <div className="installment-editor">
        <header>
          <CalendarClock size={18} />
          <strong>Cobranças</strong>
        </header>
        {payments.map((payment, index) => (
          <div className="installment-row" key={payment.installmentNumber}>
            <strong>{payment.installmentNumber}ª</strong>
            <label>
              <span>Valor</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={payment.amount}
                onChange={(event) =>
                  setPayments((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, amount: Number(event.target.value) }
                        : item,
                    ),
                  )
                }
              />
            </label>
            <label>
              <span>Vencimento</span>
              <input
                type="date"
                value={payment.dueDate}
                onChange={(event) =>
                  setPayments((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, dueDate: event.target.value }
                        : item,
                    ),
                  )
                }
              />
            </label>
            <label>
              <span>Status</span>
              <select
                value={payment.status}
                onChange={(event) =>
                  setPayments((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            status: event.target
                              .value as PaymentInstallment["status"],
                          }
                        : item,
                    ),
                  )
                }
              >
                <option>Pendente</option>
                <option>Pago</option>
                <option>Atrasado</option>
                <option>Cancelado</option>
              </select>
            </label>
          </div>
        ))}
      </div>

      <div className="commercial-form-grid project-fields">
        <label>
          <span>Produção do site</span>
          <select
            value={siteProject.status}
            onChange={(event) =>
              setSiteProject((current) => ({
                ...current,
                status: event.target.value as LeadProject["status"],
              }))
            }
          >
            {projectStatuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Prazo de entrega</span>
          <input
            type="date"
            value={dateInputValue(siteProject.deliveryDueAt)}
            onChange={(event) =>
              setSiteProject((current) => ({
                ...current,
                deliveryDueAt: event.target.value || undefined,
              }))
            }
          />
        </label>
        <label>
          <span>Domínio</span>
          <input
            value={siteProject.domainName ?? ""}
            onChange={(event) =>
              setSiteProject((current) => ({
                ...current,
                domainName: event.target.value,
              }))
            }
            placeholder="dominiodocliente.com.br"
          />
        </label>
      </div>

      <div className="commercial-notes-grid">
        <label>
          <span>Observações comerciais</span>
          <textarea
            value={deal.privateNotes}
            onChange={(event) =>
              setDeal((current) => ({
                ...current,
                privateNotes: event.target.value,
              }))
            }
            placeholder="Condição negociada, data combinada e contexto da cobrança."
          />
        </label>
        <label>
          <span>Materiais e revisão</span>
          <textarea
            value={siteProject.materialsNotes}
            onChange={(event) =>
              setSiteProject((current) => ({
                ...current,
                materialsNotes: event.target.value,
              }))
            }
            placeholder="O que foi recebido e o que ainda está faltando."
          />
        </label>
        <label>
          <span>Entrega privada</span>
          <textarea
            value={siteProject.deliveryNotes}
            onChange={(event) =>
              setSiteProject((current) => ({
                ...current,
                deliveryNotes: event.target.value,
              }))
            }
            placeholder="Transferência, domínio e instruções finais."
          />
        </label>
      </div>
    </section>
  );
}

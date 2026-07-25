import {
  BadgeCheck,
  CircleDollarSign,
  ClipboardList,
  Eye,
  Send,
  Star,
  UserRoundCheck,
} from "lucide-react";
import { stages, type Stage } from "../types";

const descriptions: Record<Stage, string> = {
  Validar: "Verifique o perfil e o site.",
  Contatar: "Envie a mensagem inicial.",
  Interessado: "Cliente demonstrou interesse.",
  Materiais: "Solicite os materiais essenciais.",
  Preview: "Apresente o preview do site.",
  Aprovação: "Registre a decisão do cliente.",
  Pagamento: "Confirme o pagamento manualmente.",
};

const icons = [
  UserRoundCheck,
  Send,
  Star,
  ClipboardList,
  Eye,
  BadgeCheck,
  CircleDollarSign,
];

export function ProcessRail({ currentStage }: { currentStage: Stage }) {
  const currentIndex = stages.indexOf(currentStage);

  return (
    <aside className="process-rail" aria-label="Fluxo da prospecção">
      <h2>Fluxo da prospecção</h2>
      <ol>
        {stages.map((stage, index) => {
          const Icon = icons[index];
          const state =
            index < currentIndex
              ? "complete"
              : index === currentIndex
                ? "current"
                : "future";
          return (
            <li key={stage} className={state}>
              <span className="process-icon">
                <Icon size={19} strokeWidth={1.8} />
              </span>
              <div>
                <strong>
                  {index + 1}. {stage}
                </strong>
                <p>{descriptions[stage]}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="process-note">
        <strong>Fluxo simples, sem atalhos</strong>
        <p>A aprovação sempre acontece antes do pagamento.</p>
      </div>
    </aside>
  );
}

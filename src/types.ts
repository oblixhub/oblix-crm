export type NavKey =
  | "dashboard"
  | "prospecting"
  | "leads"
  | "previews"
  | "finance"
  | "messages";

export type Owner = "Você" | "Sócia";
export type Priority = "Urgente" | "Alta" | "Normal" | "Baixa";
export type WeekDay = "Hoje" | "Seg" | "Ter" | "Qua" | "Qui" | "Sex";
export type SiteStatus = "Sem site" | "Tem site" | "Não verificado";
export type ProspectingOutcome =
  | "Mensagem enviada"
  | "Sem resposta"
  | "Interessado"
  | "Não interessado"
  | "Retornar depois";

export const stages = [
  "Validar",
  "Contatar",
  "Interessado",
  "Materiais",
  "Preview",
  "Aprovação",
  "Pagamento",
] as const;

export type Stage = (typeof stages)[number];

export type ActivityKind =
  | "validation"
  | "message"
  | "interest"
  | "materials"
  | "preview"
  | "approval"
  | "note";

export interface Activity {
  id: number;
  kind: ActivityKind;
  title: string;
  detail: string;
  time: string;
  author: string;
}

export interface PreviewState {
  status: "none" | "processing" | "ready" | "viewed" | "approved";
  version?: number;
  fileName?: string;
  publicSlug: string;
  checklist: {
    index: boolean;
    relativePaths: boolean;
    protectedAccess: boolean;
  };
}

export interface Lead {
  id: number;
  handle: string;
  category: string;
  owner: Owner;
  stage: Stage;
  nextAction: string;
  priority: Priority;
  scheduleDay: WeekDay;
  dueTime: string;
  overdue?: boolean;
  archived?: boolean;
  siteStatus: SiteStatus;
  instagramUrl: string;
  whatsappUrl?: string;
  offer: "Com domínio" | "Sem domínio";
  amount: number;
  paymentStatus: "Não aprovado" | "Aguardando PIX" | "Pago";
  activities: Activity[];
  preview: PreviewState;
}

export interface MessageTemplate {
  id: number;
  title: string;
  category: string;
  message: string;
  favorite: boolean;
  shared: boolean;
  updatedLabel: string;
}

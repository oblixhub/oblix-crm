export type NavKey =
  | "dashboard"
  | "validation"
  | "prospecting"
  | "leads"
  | "previews"
  | "finance"
  | "messages";

export type Owner = "Você" | "Sócia";
export const owners: readonly Owner[] = ["Você", "Sócia"];
export const ownerLabels: Record<Owner, string> = {
  "Você": "Hugo",
  "Sócia": "Raiza",
};
export type Priority = "Urgente" | "Alta" | "Normal" | "Baixa";
export type ValidationStatus = "pending" | "valid" | "discarded";
export type LeadSource = "excel" | "manual" | "instagram";
export type WeekDay = "Hoje" | "Seg" | "Ter" | "Qua" | "Qui" | "Sex";
export type SiteStatus = "Sem site" | "Tem site" | "Não verificado";
export type ProspectingOutcome =
  | "Mensagem enviada"
  | "Sem resposta"
  | "Interessado"
  | "Não interessado"
  | "Retornar depois"
  | "Já possui site";

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
  remoteId?: string;
  fullName?: string;
  handle: string;
  category: string;
  validationStatus: ValidationStatus;
  validatedAt?: string;
  discardReason?: string;
  batchId?: string;
  batchName: string;
  sourceType: LeadSource;
  owner: Owner;
  stage: Stage;
  nextAction: string;
  nextActionAt?: string;
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

export type NavKey =
  | "dashboard"
  | "validation"
  | "prospecting"
  | "leads"
  | "previews"
  | "portfolio"
  | "finance"
  | "messages";

export type Owner = string;
export const owners: readonly Owner[] = ["Você", "Sócia", "Equipe"];
export const ownerLabels: Record<string, string> = {
  "Você": "Hugo",
  "Sócia": "Raiza",
  "Equipe": "Equipe",
  Hugo: "Hugo",
  Raiza: "Raiza",
};
export const ownerLabel = (owner: Owner) => ownerLabels[owner] ?? owner;

export interface TeamProfile {
  userId: string;
  displayName: string;
  role: "owner" | "seller";
}

export interface LeadTag {
  id: string;
  name: string;
  color: string;
  category: string;
  isSystem?: boolean;
}
export type Priority = "Urgente" | "Alta" | "Normal" | "Baixa";
export type ValidationStatus = "pending" | "valid" | "discarded";
export type LeadSource =
  | "excel"
  | "manual"
  | "instagram"
  | "chrome_extension";
export const leadSourceLabels: Record<LeadSource, string> = {
  excel: "Excel",
  manual: "Manual",
  instagram: "Instagram",
  chrome_extension: "Extensão",
};
export type WeekDay = "Hoje" | "Seg" | "Ter" | "Qua" | "Qui" | "Sex";
export type SiteStatus = "Sem site" | "Tem site" | "Não verificado";
export type ProspectingOutcome =
  | "Mensagem enviada"
  | "Sem resposta"
  | "Interessado"
  | "Não interessado"
  | "Retornar depois"
  | "Já possui site"
  | "Não contatar";

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
  id: number | string;
  kind: ActivityKind;
  title: string;
  detail: string;
  time: string;
  author: string;
  occurredAt?: string;
}

export interface PreviewState {
  status: "none" | "processing" | "ready" | "viewed" | "approved";
  version?: number;
  fileName?: string;
  requiresLogin: boolean;
  publicUrl?: string;
  siteUrl?: string;
  sourcePath?: string;
  slug?: string;
  publicSlug?: string;
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
  assignedTo?: string;
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
  whatsappNumber?: string;
  capturedAt?: string;
  capturedBy?: string;
  notes?: string;
  tags: LeadTag[];
  contactPermission: "public_contact" | "opted_in" | "opted_out";
  doNotContact: boolean;
  lastContactedAt?: string;
  lastResponseAt?: string;
  closedAt?: string;
  closedReason?: string;
  offer: "Com domínio" | "Sem domínio";
  amount: number;
  paymentStatus: "Não aprovado" | "Aguardando PIX" | "Pago";
  initialMessageSent: boolean;
  activities: Activity[];
  preview: PreviewState;
}

export interface MessageTemplate {
  id: number | string;
  title: string;
  category: string;
  message: string;
  favorite: boolean;
  shared: boolean;
  updatedLabel: string;
}

export interface LeadTask {
  id: string;
  leadId: string;
  assignedTo?: string;
  taskType: string;
  title: string;
  dueAt?: string;
  status: "pending" | "completed" | "cancelled";
  priority: Priority;
}

export interface CommercialRecord {
  leadId: string;
  offerType: string;
  amount: number;
  paymentMethod: string;
  installmentsCount: number;
  status:
    | "Não negociado"
    | "Negociação"
    | "Aguardando pagamento"
    | "Parcial"
    | "Pago"
    | "Atrasado"
    | "Cancelado";
  nextChargeAt?: string;
  domainIncluded: boolean;
  deliveryStatus: string;
  privateNotes: string;
}

export interface PaymentInstallment {
  id?: string;
  leadId: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  status: "Pendente" | "Pago" | "Atrasado" | "Cancelado";
  paidAt?: string;
}

export interface LeadProject {
  leadId: string;
  status:
    | "Aguardando materiais"
    | "Materiais recebidos"
    | "Em produção"
    | "Revisão interna"
    | "Preview enviado"
    | "Ajustes solicitados"
    | "Aprovado"
    | "Pagamento pendente"
    | "Pago"
    | "Entregue";
  materialsNotes: string;
  revisionNotes: string;
  deliveryNotes: string;
  domainName?: string;
  deliveryDueAt?: string;
  deliveredAt?: string;
}

export interface CrmSettings {
  dailyContactGoal: number;
  firstFollowUpDays: number;
  secondFollowUpDays: number;
}

export type PortfolioSourceType = "lead_preview" | "standalone_zip";
export type PortfolioStatus = "draft" | "published" | "archived";

export interface PortfolioProject {
  id: string;
  leadId?: string;
  title: string;
  slug: string;
  category: string;
  shortDescription: string;
  description: string;
  services: string[];
  sourceType: PortfolioSourceType;
  sourcePath?: string;
  publicKey?: string;
  currentVersion: number;
  contentUrl?: string;
  coverDesktopPath?: string;
  coverMobilePath?: string;
  coverDesktopUrl?: string;
  coverMobileUrl?: string;
  liveUrl?: string;
  showLiveLink: boolean;
  featured: boolean;
  sortOrder: number;
  status: PortfolioStatus;
  publicationAuthorized: boolean;
  authorizationNote: string;
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PublicPortfolioProject {
  id: string;
  title: string;
  slug: string;
  category: string;
  shortDescription: string;
  description: string;
  services: string[];
  coverDesktopUrl?: string;
  coverMobileUrl?: string;
  contentUrl: string;
  liveUrl?: string;
  showLiveLink: boolean;
  featured: boolean;
  sortOrder: number;
  publishedAt?: string;
}

import {
  stages,
  type Activity,
  type Lead,
  type MessageTemplate,
  type Priority,
  type SiteStatus,
  type Stage,
  type WeekDay,
} from "./types";

const baseActivities: Activity[] = [
  {
    id: 1,
    kind: "validation",
    title: "Perfil validado",
    detail: "Lead validado e adicionado ao funil.",
    time: "Hoje, 09:12",
    author: "Você",
  },
  {
    id: 2,
    kind: "message",
    title: "Mensagem inicial enviada",
    detail: "Mensagem de apresentação enviada no Instagram.",
    time: "Hoje, 09:35",
    author: "Você",
  },
  {
    id: 3,
    kind: "interest",
    title: "Cliente demonstrou interesse",
    detail: "Cliente respondeu demonstrando interesse na solução.",
    time: "Hoje, 10:08",
    author: "Você",
  },
  {
    id: 4,
    kind: "materials",
    title: "Materiais solicitados",
    detail: "Solicitados materiais para criação do preview.",
    time: "Hoje, 10:45",
    author: "Você",
  },
  {
    id: 5,
    kind: "preview",
    title: "Preview enviado",
    detail: "Acesso reservado enviado para avaliação.",
    time: "Ontem, 17:20",
    author: "Sócia",
  },
];

const profiles = [
  ["@cafeteria.do.bairro", "Cafeteria"],
  ["@studiofisiopilates", "Pilates"],
  ["@burgueria.artesanal", "Hamburgueria"],
  ["@loja.usebasic", "Moda feminina"],
  ["@barbearia.classic", "Barbearia"],
  ["@petshop.amigao", "Pet shop"],
  ["@viverbem.nutri", "Nutrição"],
  ["@decorar.interiores", "Decoração"],
  ["@cleanhouse.sp", "Limpeza"],
  ["@acai.da.vila", "Açaiteria"],
  ["@clinica.essenza", "Estética"],
  ["@floricultura.bela", "Floricultura"],
  ["@doceria.mel", "Confeitaria"],
  ["@personal.leo", "Personal trainer"],
  ["@greenhouse.plantas", "Paisagismo"],
  ["@oficina.do.carro", "Oficina"],
  ["@imobiliaria.nova", "Imobiliária"],
  ["@salao.bellavita", "Salão de beleza"],
  ["@odonto.sorriso", "Odontologia"],
  ["@studio.arquitetura", "Arquitetura"],
  ["@boutique.aurora", "Moda"],
  ["@crossfit.forte", "Crossfit"],
  ["@emporio.natural", "Produtos naturais"],
  ["@contabilidade.clara", "Contabilidade"],
  ["@psico.renata", "Psicologia"],
  ["@advocacia.alves", "Advocacia"],
  ["@mecanica.prime", "Mecânica"],
  ["@fotografia.luz", "Fotografia"],
  ["@escola.futuro", "Educação"],
  ["@restaurante.sabor", "Restaurante"],
] as const;

const stagePattern: Stage[] = [
  "Contatar",
  "Validar",
  "Contatar",
  "Interessado",
  "Contatar",
  "Materiais",
  "Validar",
  "Preview",
  "Interessado",
  "Aprovação",
  "Contatar",
  "Validar",
];

const priorityPattern: Priority[] = [
  "Urgente",
  "Alta",
  "Normal",
  "Alta",
  "Normal",
  "Urgente",
  "Baixa",
  "Alta",
];

const dayPattern: WeekDay[] = [
  "Hoje",
  "Hoje",
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Hoje",
];

const sitePattern: SiteStatus[] = [
  "Não verificado",
  "Sem site",
  "Tem site",
  "Sem site",
];

const nextActionByStage: Record<Stage, string> = {
  Validar: "Verificar site e perfil",
  Contatar: "Enviar mensagem inicial",
  Interessado: "Responder dúvidas",
  Materiais: "Cobrar fotos e logotipo",
  Preview: "Aguardar feedback do preview",
  Aprovação: "Enviar chave PIX",
  Pagamento: "Preparar entrega",
};

const makePreview = (
  slug: string,
  status: Lead["preview"]["status"] = "none",
): Lead["preview"] => ({
  status,
  version: status === "none" ? undefined : 1,
  fileName: status === "none" ? undefined : `${slug}.zip`,
  publicSlug: slug,
  checklist: {
    index: status !== "none",
    relativePaths: status !== "none",
    protectedAccess: status !== "none",
  },
});

const timeForIndex = (index: number) => {
  const totalMinutes = 8 * 60 + 30 + (index % 20) * 25;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

export const initialLeads: Lead[] = Array.from({ length: 86 }, (_, index) => {
  const profile = profiles[index % profiles.length];
  const cycle = Math.floor(index / profiles.length);
  const handle = cycle === 0 ? profile[0] : `${profile[0]}.${cycle + 1}`;
  const slug = handle.slice(1).replace(/[^a-z0-9]+/g, "-");
  const stage = stagePattern[index % stagePattern.length];
  const previewStatus =
    stage === "Preview" ? "viewed" : stage === "Aprovação" ? "approved" : "none";
  const overdue = index % 11 === 0;

  return {
    id: index + 1,
    handle,
    category: profile[1],
    owner: index % 3 === 0 ? "Sócia" : "Você",
    stage,
    nextAction:
      index % 10 === 9 ? "Definir próxima ação" : nextActionByStage[stage],
    priority: priorityPattern[index % priorityPattern.length],
    scheduleDay: dayPattern[index % dayPattern.length],
    dueTime: timeForIndex(index),
    overdue,
    siteStatus: sitePattern[index % sitePattern.length],
    instagramUrl: `https://www.instagram.com/${handle.slice(1)}/`,
    offer: index % 4 === 0 ? "Com domínio" : "Sem domínio",
    amount: index % 4 === 0 ? 250 : 200,
    paymentStatus:
      stage === "Aprovação" ? "Aguardando PIX" : "Não aprovado",
    activities: baseActivities.slice(
      0,
      Math.max(1, Math.min(baseActivities.length, stages.indexOf(stage) + 1)),
    ),
    preview: makePreview(slug, previewStatus),
  };
});

export const initialTemplates: MessageTemplate[] = [
  {
    id: 1,
    title: "Primeiro contato",
    category: "Prospecção",
    favorite: true,
    shared: true,
    updatedLabel: "Editado há 2h",
    message:
      "Oi, [nome]! Tudo bem? Sou [seu nome], da OBLIX. Estamos selecionando alguns negócios para uma nova fase do nosso portfólio e o perfil de vocês chamou nossa atenção. Gostaria de criar uma prévia de site, sem cobrar pelo desenvolvimento, para vocês avaliarem. Se fizer sentido, posso te explicar rapidinho como funciona?",
  },
  {
    id: 2,
    title: "Follow-up sem resposta",
    category: "Prospecção",
    favorite: false,
    shared: true,
    updatedLabel: "Editado há 1d",
    message:
      "Oi, [nome]! Passando só para confirmar se você conseguiu ver minha mensagem. A ideia é preparar uma prévia visual do site para você avaliar sem compromisso. Se não for o momento, fica à vontade para me avisar também 🙂",
  },
  {
    id: 3,
    title: "Cliente demonstrou interesse",
    category: "Processo e materiais",
    favorite: false,
    shared: true,
    updatedLabel: "Editado há 3d",
    message:
      "Que ótimo! Funciona assim: você me envia os materiais principais, nós montamos uma prévia personalizada e te mandamos um acesso reservado. Você pode aprovar ou pedir ajustes. O pagamento só acontece depois da aprovação.",
  },
  {
    id: 4,
    title: "Solicitar materiais",
    category: "Processo e materiais",
    favorite: false,
    shared: true,
    updatedLabel: "Editado há 4d",
    message:
      "Para preparar a prévia, pode me enviar por aqui: logotipo (se tiver), fotos que gostaria de usar, lista dos principais serviços, cidade ou região de atendimento e o número de WhatsApp que deve aparecer no site. Pode mandar aos poucos, sem problema.",
  },
  {
    id: 5,
    title: "Quanto custa?",
    category: "Dúvidas e respostas",
    favorite: false,
    shared: true,
    updatedLabel: "Editado há 5d",
    message:
      "O desenvolvimento da prévia não é cobrado. Se você aprovar e quiser ficar com o site, o valor é R$ 200 sem domínio próprio ou R$ 250 com domínio. O pagamento acontece somente depois da aprovação.",
  },
  {
    id: 6,
    title: "Já tenho site",
    category: "Dúvidas e respostas",
    favorite: false,
    shared: true,
    updatedLabel: "Editado há 6d",
    message:
      "Sem problema! A proposta pode servir como uma alternativa visual para você comparar com o site atual. Se o seu site já atende bem, não precisa mudar nada. Posso te mostrar a prévia e você decide com calma.",
  },
  {
    id: 7,
    title: "Preciso pensar",
    category: "Dúvidas e respostas",
    favorite: false,
    shared: true,
    updatedLabel: "Editado há 7d",
    message:
      "Claro, fique à vontade! Vou deixar tudo registrado por aqui. Se quiser, posso te chamar novamente em alguns dias para saber o que achou, sem compromisso.",
  },
];

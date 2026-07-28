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
  requiresLogin: false,
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
  const validationStatus = index < 18 ? "pending" : "valid";
  const operationalStage =
    validationStatus === "pending"
      ? "Validar"
      : stage === "Validar"
        ? "Contatar"
        : stage;
  const previewStatus =
    stage === "Preview" ? "viewed" : stage === "Aprovação" ? "approved" : "none";
  const overdue = index % 11 === 0;

  return {
    id: index + 1,
    handle,
    initialMessageSent: false,
    validationStatus,
    batchName: "Lote de demonstração",
    sourceType: "excel",
    category: profile[1],
    owner: index % 3 === 0 ? "Sócia" : "Você",
    stage: operationalStage,
    nextAction:
      index % 10 === 9
        ? "Definir próxima ação"
        : nextActionByStage[operationalStage],
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
    title: "1. Abordagem inicial",
    category: "Prospecção",
    favorite: true,
    shared: true,
    updatedLabel: "Script oficial",
    message:
      "Oi, [nome]! Tudo bem? Vi seu Instagram e fiquei com uma dúvida: você já tem um site profissional? Não consegui encontrar.",
  },
  {
    id: 2,
    title: "2. Sem resposta",
    category: "Prospecção",
    favorite: true,
    shared: true,
    updatedLabel: "Script oficial",
    message:
      "Perguntei porque trabalho com criação de sites e estou selecionando alguns profissionais para desenvolver novos cases para o portfólio da minha agência.\n\nPosso criar um site personalizado para você, sem cobrar pelo desenvolvimento. Você só paga a publicação e o domínio caso aprove o preview.\n\nDurante a criação, faço os ajustes necessários até a aprovação. Estou com algumas vagas disponíveis para essa etapa, então, caso tenha interesse, me avisa. 😊",
  },
  {
    id: 3,
    title: "3. Respondeu que não tem site",
    category: "Prospecção",
    favorite: true,
    shared: true,
    updatedLabel: "Script oficial",
    message:
      "Entendi! Perguntei porque trabalho com criação de sites e estou selecionando alguns profissionais para desenvolver novos cases para o portfólio da minha agência.\n\nGostei do seu perfil e gostaria de criar um site personalizado para você, sem cobrar pelo desenvolvimento. Você só paga a publicação e o domínio caso aprove o preview.\n\nDurante a criação, faço os ajustes necessários até você aprovar. Estou com algumas vagas disponíveis para essa etapa. Teria interesse?",
  },
  {
    id: 4,
    title: "4. Como funciona?",
    category: "Dúvidas e respostas",
    favorite: false,
    shared: true,
    updatedLabel: "Script oficial",
    message:
      "Funciona de forma bem simples:\n\nVocê me envia as informações, os serviços e algumas fotos que gostaria de apresentar. Eu desenvolvo o site e envio um link de preview para você avaliar.\n\nDurante essa etapa, faço os ajustes necessários. Você só realiza o pagamento se aprovar o resultado e decidir publicar o site com seu domínio próprio.",
  },
  {
    id: 5,
    title: "5. Qual é o valor?",
    category: "Dúvidas e respostas",
    favorite: false,
    shared: true,
    updatedLabel: "Script oficial",
    message:
      "Como estou selecionando alguns projetos para novos cases do portfólio, não estou cobrando pelo desenvolvimento do site.\n\nO valor para configuração, publicação e entrega do site online é de R$ 250, além do valor anual do domínio.\n\nO pagamento só é feito depois que você visualizar o preview e aprovar o resultado.",
  },
  {
    id: 6,
    title: "6. O que está incluído?",
    category: "Dúvidas e respostas",
    favorite: false,
    shared: true,
    updatedLabel: "Script oficial",
    message:
      "O projeto inclui:\n\n• site personalizado para sua identidade profissional;\n• adaptação para celular e computador;\n• apresentação dos seus serviços;\n• botões para WhatsApp e redes sociais;\n• domínio próprio;\n• publicação do site;\n• ajustes durante a etapa de aprovação.\n\nAntes de qualquer pagamento, você recebe o preview completo para avaliar.",
  },
  {
    id: 7,
    title: "7. Vou pensar",
    category: "Dúvidas e respostas",
    favorite: false,
    shared: true,
    updatedLabel: "Script oficial",
    message:
      "Claro, sem problema. 😊\n\nPode analisar com tranquilidade. Só peço que me avise caso decida participar, porque estou selecionando uma quantidade limitada de projetos para essa etapa do portfólio.",
  },
  {
    id: 8,
    title: "8. Já tem site",
    category: "Dúvidas e respostas",
    favorite: false,
    shared: true,
    updatedLabel: "Script oficial",
    message:
      "Entendi, perfeito! Obrigado por responder.\n\nVou dar uma olhada nele também. Caso em algum momento você queira modernizar o visual, melhorar a apresentação no celular ou criar uma página específica para algum serviço, fico à disposição.",
  },
  {
    id: 9,
    title: "9. Quem é você?",
    category: "Dúvidas e respostas",
    favorite: false,
    shared: true,
    updatedLabel: "Script oficial",
    message:
      "Sou Hugo, responsável pela OBLIX Sites. Trabalho com criação de sites e landing pages para profissionais e pequenos negócios.\n\nEstou selecionando alguns perfis para desenvolver novos projetos de portfólio, por isso entrei em contato depois de conhecer seu trabalho pelo Instagram.",
  },
  {
    id: 10,
    title: "10. Cliente desconfiado",
    category: "Dúvidas e respostas",
    favorite: false,
    shared: true,
    updatedLabel: "Script oficial",
    message:
      "Entendo perfeitamente.\n\nPor isso eu trabalho primeiro com o preview: você não precisa pagar nada antecipadamente. Eu desenvolvo a proposta, envio um link para você visualizar e o pagamento só acontece caso goste e queira publicar.\n\nAssim você consegue avaliar o trabalho sem assumir nenhum risco antes.",
  },
  {
    id: 11,
    title: "11. Solicitar materiais",
    category: "Processo e materiais",
    favorite: false,
    shared: true,
    updatedLabel: "Script complementar",
    message:
      "Para preparar a prévia, pode me enviar por aqui: logotipo (se tiver), fotos que gostaria de usar, lista dos principais serviços, cidade ou região de atendimento e o número de WhatsApp que deve aparecer no site. Pode mandar aos poucos, sem problema.",
  },
];

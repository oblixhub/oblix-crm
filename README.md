# OBLIX CRM

Primeira versão navegável do CRM de prospecção da OBLIX.

## Rodar localmente

```bash
pnpm install
pnpm dev
```

## Estado atual

- Dashboard e metas diárias;
- Fila de prospecção;
- Kanban do funil;
- Cadastro local de lead;
- Detalhe e histórico;
- Upload demonstrativo de ZIP;
- Simulação da visão do cliente;
- Aprovação, solicitação de ajustes e pagamento manual;
- Dados sincronizados com o Supabase quando o ambiente está configurado;
- Autenticação da equipe e publicação de previews por ZIP.

## Extensão Chrome — OBLIX Lead Saver

A pasta [`chrome-extension`](./chrome-extension) contém a extensão Manifest V3
para captura manual de perfis do Instagram. Ela usa:

- `GET /api/extension/health`;
- `POST /api/extension/leads`;
- tokens pessoais resolvidos somente no servidor;
- a tabela existente `public.leads`;
- o lote `Extensão Chrome`;
- índice único do Instagram normalizado para bloquear duplicidade concorrente.

Instalação, variáveis, geração de tokens e aplicação da migration estão em
[`chrome-extension/README.md`](./chrome-extension/README.md).

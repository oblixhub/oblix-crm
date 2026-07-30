# OBLIX Lead Saver

Extensão interna do Chrome para salvar manualmente perfis selecionados do Instagram no CRM OBLIX.

## Instalação

Faça estes passos separadamente no computador do Hugo e no computador da Raiza:

1. Abra `chrome://extensions`.
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione a pasta `chrome-extension`.
5. Abra **Detalhes → Opções da extensão**.
6. Informe a URL `https://sites.oblixhub.com`.
7. Informe o token pessoal daquele operador.
8. Clique em **Testar conexão** e depois em **Salvar configurações**.
9. Fixe a extensão na barra do Chrome.

Cada pessoa deve usar seu próprio token. O token fica apenas em
`chrome.storage.local` naquele perfil do Chrome e aparece mascarado depois de
salvo.

## Uso

1. Abra um perfil, por exemplo `https://www.instagram.com/alineestetica/`.
2. Clique na extensão ou use `Alt + S`.
3. Revise prioridade, situação do site e observação.
4. Cole um número/link do WhatsApp, se estiver disponível.
5. Pressione **Salvar no CRM** ou Enter.

Para o fluxo Instagram → WhatsApp, abra primeiro a extensão no perfil. O
rascunho fica salvo por 30 minutos. Depois abra o link do WhatsApp e abra a
extensão novamente; o número será combinado ao perfil, mas nada será cadastrado
sem confirmação.

Rotas internas como `/direct`, `/p`, `/reel`, `/explore` e `/stories` não são
tratadas como perfis.

## Atalho e país padrão

- Altere o atalho em `chrome://extensions/shortcuts`.
- O atalho inicial é `Alt + S`.
- O país padrão é Brasil (`55`). Ele só é acrescentado a números locais com 10
  ou 11 dígitos.
- Números internacionais com `+` e links oficiais do WhatsApp são preservados.

## Atualização

Depois de receber uma nova versão da pasta:

1. Substitua os arquivos locais mantendo a pasta.
2. Abra `chrome://extensions`.
3. Clique em **Atualizar** ou no botão de recarregar do OBLIX Lead Saver.

As configurações continuam no armazenamento local do Chrome.

## Variáveis do servidor

Configure na Vercel, somente no ambiente do servidor:

```env
SUPABASE_URL=
SUPABASE_SECRET_KEY=
OBLIX_EXTENSION_TOKEN_HUGO=
OBLIX_EXTENSION_TOKEN_SOCIA=
OBLIX_EXTENSION_DEFAULT_COUNTRY=55
OBLIX_EXTENSION_RATE_LIMIT_HOURLY=120
```

Também é aceito `SUPABASE_SERVICE_ROLE_KEY` como compatibilidade, mas prefira a
Secret Key atual do Supabase. Nunca use prefixo `VITE_` para chaves
administrativas ou tokens.

Gere dois tokens diferentes e longos. Exemplo local:

```text
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Execute uma vez para Hugo e outra para Raiza. Não coloque os valores no Git.

## Migration

A migration é:

```text
supabase/migrations/20260727155321_chrome_extension_lead_capture.sql
```

Antes de aplicá-la, confira duplicatas legadas que só diferem por `@` ou
maiúsculas:

```sql
select
  lower(regexp_replace(btrim(handle), '^@+', '')) as username,
  count(*) as total,
  array_agg(id) as lead_ids
from public.leads
group by 1
having count(*) > 1;
```

Se houver resultados, resolva-os manualmente. A migration não apaga nada e
falhará de forma segura ao criar o índice único. Depois, aplique pelo fluxo
normal do projeto:

```text
npx supabase db push
```

## Segurança e limites

- A extensão chama apenas a API do CRM; ela nunca recebe chave do Supabase.
- Não lê Direct, seguidores, cookies, publicações ou histórico.
- Não envia mensagens, não segue perfis e não automatiza ações no Instagram.
- O limite horário é persistente e conta capturas criadas pelo operador no
  banco; tentativas inválidas e duplicadas não entram nessa contagem.

# Delícias Manager

Sistema web de gestão para empresas de doces, biscoitos e bolos — vendas, encomendas,
Dias de Venda, clientes e relatórios. Mobile-first, pensado especialmente para uso em
celulares Android.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Firebase (Auth + Firestore + Storage)

## Tema

Paleta em tons de rosa e rosa bebê, claros e leves (`tailwind.config.ts`, chave `brand` e
`babypink`). Tipografia: Quicksand para títulos, Inter para texto e dados. Navegação por
barra inferior no celular (padrão Android) e sidebar no desktop.

## Como rodar localmente

```bash
npm install
cp .env.local.example .env.local
# preencha o .env.local com as credenciais do seu projeto Firebase
npm run dev
```

Abra http://localhost:3000 — a rota raiz redireciona para `/dashboard`.

## Configurar o Firebase

1. Crie um projeto em https://console.firebase.google.com
2. Ative **Authentication** (método E-mail/Senha) e **Cloud Firestore**.
3. Copie as credenciais do app web para `.env.local`.
4. Publique as regras de segurança em `firestore.rules`:
   ```bash
   firebase deploy --only firestore:rules
   ```
5. Crie o primeiro usuário (dono/funcionário) pelo console do Firebase Authentication.

## O que já está implementado

### Fase 1 — Fundação
- Estrutura do projeto (App Router, `src/features`, `src/lib`, `src/types`)
- Tema Tailwind com a paleta rosa/rosa bebê
- Layout responsivo: sidebar (desktop) + barra inferior de navegação (mobile/Android)
- Tela de login com Firebase Authentication
- Dashboard com indicadores, próximo Dia de Venda, próximas encomendas e atividades
  recentes — conectado aos dados reais do Firestore desde a Fase 6
- Componentes de UI reutilizáveis: Button, Input, Select, MoneyInput, Card, Badge,
  EmptyState, StatCard, Modal, ConfirmDialog
- Utilitários de formatação pt-BR (moeda, data, telefone) — `src/lib/utils/format.ts`
- Regras de segurança do Firestore (`firestore.rules`) exigindo autenticação
- Telas de Encomendas, Dias de Venda e Relatórios ainda como estados vazios (empty
  state), prontas para receber as próximas fases

### Fase 2 — Clientes e Produtos
- **`/clientes`** — lista, busca por nome/telefone, cadastro via modal, badge de
  cliente inativo
- **`/clientes/[id]`** — dados do cliente, edição, ativar/desativar (com
  `ConfirmDialog`) e **histórico básico** (seção 8): total comprado, quantidade de
  compras, ticket médio, valor pendente, última compra e produto mais comprado —
  tudo agregado a partir da coleção `sales` da Fase 3
- **`/produtos`** — lista, busca por nome/categoria, cadastro via modal, badge de
  produto inativo
- **`/produtos/[id]`** — dados do produto, edição, ativar/desativar e histórico
  básico (seção 9): quantidade vendida e faturamento
- "Desativar" nunca apaga o registro — só tira o cliente/produto da seleção em
  novas vendas, preservando o histórico (mesma lógica de integridade da Fase 3)

### Fase 3 — Vendas e Pagamentos
- **`/vendas`** — lista as vendas reais do Firestore, com busca por cliente, status
  (Pago / Parcial / Fiado) e estados de loading/erro/vazio
- **`/vendas/nova`** — registro de venda com múltiplos produtos, quantidade e preço
  editáveis, forma de pagamento e valor pago (pagamento parcial ou fiado) — agora
  puxa clientes/produtos ativos já cadastrados pela Fase 2
- **`/vendas/[id]`** — detalhe da venda: itens, histórico de pagamentos e formulário
  para registrar um novo pagamento sobre uma venda parcial/fiado
- Toda a lógica financeira trabalha em **centavos (inteiros)**, nunca em float
  (`MoneyInput`, seção 33 da spec)
- `createSale` e `addPayment` (`src/lib/firebase/sales.ts`) usam **batch/transação**
  do Firestore: a venda, o pagamento inicial e o registro de auditoria são gravados
  atomicamente — nunca fica uma venda "pela metade" (seção 21)
- Eventos de auditoria (`venda_criada`, `pagamento_recebido`, `cliente_cadastrado`)
  são gravados em `activityHistory` a cada ação (seção 22)

**Nota de performance:** o histórico do produto (`getProductStats`) hoje varre as
vendas recentes no cliente para somar quantidade/faturamento, já que não há um
índice dedicado por produto. Funciona bem para o volume de uma confeitaria pequena;
se o catálogo de vendas crescer muito, vale revisar isso — como é uma mudança de
arquitetura, será discutida antes de implementada (seção 31).

### Fase 4 — Encomendas
- **`/encomendas`** — lista todas as encomendas ordenadas pela data prevista de
  entrega, com busca por cliente e filtro por status
- **`/encomendas/nova`** — mesmo fluxo de seleção de produtos da Fase 3, mais data
  prevista de entrega, status inicial, endereço (pré-preenchido a partir do cadastro
  do cliente, editável) e observações; o pagamento no ato é opcional (sinal/depósito),
  diferente da venda onde o padrão é pagar o total
- **`/encomendas/[id]`** — itens, endereço/observações, troca de status (Pendente →
  Confirmada → Em produção → Pronta → Entregue → Cancelada) e o mesmo fluxo de
  pagamentos parciais da Fase 3, incluindo histórico de pagamentos
- `createOrder` e `addOrderPayment` (`src/lib/firebase/orders.ts`) seguem a mesma
  lógica transacional das vendas: nunca deixam a encomenda "pela metade" nem o valor
  pago ultrapassar o total
- Auditoria: `encomenda_criada` ao registrar e `pedido_cancelado` ao mudar o status
  para "Cancelada" (seção 22)
- `firestore.rules` ganhou a subcoleção `orders/{orderId}/payments`, no mesmo padrão
  já usado em `sales/{saleId}/payments`

O campo `salesDayId` já existe no tipo `Order` para vincular a encomenda a um Dia de
Venda, mas fica reservado por enquanto — a Fase 5 ainda não foi implementada.

### Fase 5 — Dias de Venda
- **`/dias-de-venda`** — lista todos os Dias de Venda (mais recente primeiro), com
  badge Aberto/Encerrado
- **`/dias-de-venda/nova`** *(modal na própria listagem)* — cria um Dia de Venda para
  uma data; encomendas já cadastradas com essa data de entrega prevista e sem outro
  Dia de Venda são **vinculadas automaticamente** (`createSalesDay`,
  `src/lib/firebase/sales-days.ts`)
- Encomendas criadas depois, na Fase 4 (`createOrder`), também se vinculam sozinhas
  a um Dia de Venda aberto já existente para a mesma data — os dois lados ficam
  sempre consistentes sem exigir um passo manual extra
- **`/dias-de-venda/[id]`** — resumo (seção 14): total de pedidos, esperado,
  recebido, pendente, fiado e cancelados, calculados ao vivo a partir dos pedidos
  vinculados enquanto o dia está aberto; agrupamento **por endereço**, mostrando
  cliente e quantidade de itens por parada de entrega
- **Encerrar Dia de Venda** (seção 15): grava um instantâneo fechado dos valores
  esperado/recebido/pendente/cancelado/não realizado — sem alterar os pedidos em si,
  então cada valor continua rastreável até sua origem (seção 21)
- "Não realizado" é calculado como o valor dos pedidos que, no momento do
  fechamento, ainda não estavam com status "Entregue" nem "Cancelada"
- Auditoria: `dia_venda_criado` e `dia_venda_encerrado` (seção 22) — os dois tipos
  que faltavam no `ActivityType`, agora completos

### Fase 6 — Dashboard com dados reais
- O Dashboard (`src/lib/firebase/dashboard.ts`) buscou o lugar do mock por consultas
  reais ao Firestore, com estados de loading (skeleton) e erro (com "Tentar
  novamente"), no mesmo padrão das outras telas
- **Vendas hoje / Recebido / Pendente / Fiado** — agregados a partir das vendas
  criadas no intervalo do dia atual (`sales` filtradas por `createdAt`)
- **Próximas encomendas** — as 5 encomendas mais próximas pela data prevista de
  entrega, excluindo as já entregues ou canceladas
- **Próximo Dia de Venda** — o primeiro Dia de Venda aberto a partir de hoje, com
  esperado/recebido/pendente calculados ao vivo a partir dos pedidos vinculados
  (mesma lógica `summarizeOrders` da Fase 5), já que esses valores só ficam
  gravados no documento depois do fechamento
- **Atividades recentes** — as 6 últimas entradas de `activityHistory`

**Limite assumido conscientemente:** "Recebido hoje" soma o `paidCents` das vendas
*criadas* hoje — não inclui pagamentos feitos hoje sobre vendas de dias anteriores
(isso exigiria uma consulta de grupo de coleção sobre todas as subcoleções
`payments`, com índice dedicado). Para o dia a dia de uma confeitaria pequena isso
cobre o caso comum; se precisar do número exato de "dinheiro que entrou hoje"
somando pagamentos avulsos de vendas antigas, isso é uma mudança de escopo que vale
discutir antes de implementar (seção 31).

### Fase 7 — Relatórios e WhatsApp
- **`/relatorios`** — seletor de período (Hoje / Últimos 7 dias / Últimos 30 dias /
  Personalizado) e todos os blocos da seção 16 da spec:
  - **Vendas**: faturamento, recebido, pendente, quantidade de vendas, ticket médio
  - **Produtos**: mais vendidos e menos vendidos no período (produtos ativos sem
    nenhuma venda aparecem em "menos vendidos" com 0 unidades — sinal útil, não
    omitido)
  - **Clientes**: que mais compraram no período, valores pendentes (saldo global,
    não só do período) e clientes ativos sem compra nos últimos 30 dias
  - **Tendências**: variação de faturamento e ticket médio vs. o período anterior
    de mesmo tamanho, dia da semana de maior movimento, produtos em alta/queda —
    e exatamente a frase da seção 16 ("Dados insuficientes para gerar esta
    análise.") quando não há base de comparação, nunca um número inventado
- **Compartilhar no WhatsApp** (seção 17): monta o texto no formato do exemplo da
  spec e abre `wa.me` com o mecanismo padrão de compartilhamento do WhatsApp — sem
  reimplementar nada de mensageria própria; botão "Copiar" como alternativa
- `src/lib/firebase/reports.ts` faz **uma única leitura** de toda a coleção `sales`
  e calcula período, comparação e agregações em memória — evita múltiplas consultas
  e índices compostos, mas assume o volume de uma confeitaria pequena (mesmo
  trade-off documentado na Fase 6 e nas estatísticas de produto da Fase 2)

## Correção pós-deploy: índice composto do Firestore

Depois do primeiro deploy na Vercel, `listActiveCustomers`, `listActiveProducts` e o
"próximo Dia de Venda" do Dashboard pararam de funcionar (Nova Venda, Nova Encomenda
e Dashboard ficavam presos em "Não foi possível carregar"), enquanto o resto do
sistema (cadastro/listagem simples) continuava normal. A causa: essas três consultas
combinavam um filtro de igualdade (`where`) com uma ordenação (`orderBy`) em um
**campo diferente** — isso exige um índice composto no Firestore que nunca foi
criado, e o erro estava sendo engolido silenciosamente (nenhum `catch` dava
`console.error`, só marcava `error: true` na tela).

Corrigido dos dois lados:
- As três consultas agora filtram só por igualdade e ordenam no cliente (JavaScript),
  removendo a dependência de um índice composto — funciona direto, sem nenhum passo
  manual no Console do Firebase
- Todo `catch` do projeto agora dá `console.error(err)` antes de mostrar o erro na
  tela, então qualquer problema parecido no futuro aparece no console do navegador
  em vez de só a mensagem genérica "Verifique sua conexão ou as credenciais do
  Firebase"

## Ajustes pós-lançamento

- **Venda avulsa**: checkbox "Avulso (para clientes não cadastrados)" na tela de
  Nova Venda — quando marcado, dispensa a seleção de cliente cadastrado e permite
  digitar um nome livre (ou deixar em branco, que vira "Cliente avulso"). Vendas
  avulsas gravam `customerId` vazio e por isso **não entram** nos rankings "Clientes
  que mais compraram", "Valores pendentes" nem no cálculo de "Clientes novos vs.
  recorrentes" (Fase 8) — não fazem sentido ali, já que não há um cadastro para
  atribuir fidelidade ou cobrança. Ainda contam normalmente no faturamento e nos
  relatórios de produtos.
- **Histórico de encomendas**: encomendas com status "Entregue" **e** já totalmente
  pagas somem da lista principal de `/encomendas` automaticamente e passam a viver
  em `/encomendas/historico`, para não misturar pedido antigo já resolvido com
  pedido em aberto. A regra é `isOrderCompleted` em `src/lib/firebase/orders.ts` —
  puramente derivada do status + saldo, não é um campo próprio para manter
  sincronizado.
- **Login sempre exigido**: o hook `useAuth` já existia desde a Fase 1 mas nunca
  tinha sido usado em lugar nenhum — não havia nenhuma proteção de rota. Agora o
  `AppShell` verifica a sessão e redireciona para `/login` sempre que não há usuário
  autenticado (inclusive logo depois de um logout). O botão "Sair" da sidebar também
  não navegava para lugar nenhum depois de deslogar — corrigido. A tela de login
  também redireciona sozinha para o Dashboard se a pessoa já estiver logada.
- **Produção pelo WhatsApp**: botão "Produção" em `/encomendas` monta uma lista de
  cliente + produtos a produzir (agrupada por data de entrega), a partir de todas as
  encomendas em aberto — não é um relatório financeiro, é uma lista de tarefas para
  quem vai produzir. Usa o mesmo mecanismo padrão `wa.me` da Fase 7.

### Fase 8 — Insights
- Card "Insights" na tela de Relatórios, abaixo de Tendências:
  - **Clientes novos vs. recorrentes** no período selecionado
  - **Evolução dos últimos 6 meses** (faturamento, ticket médio, quantidade de
    vendas) em formato de tabela simples — meses sem venda aparecem com zero, não
    são omitidos
- Deliberadamente sem gráficos: a seção 3 da spec pede para evitar "gráficos
  desnecessários" numa interface limpa, então os insights ficam em números e texto
  direto, no mesmo espírito do resto do sistema

## Roadmap

As 8 fases da seção 30 da especificação original estão todas implementadas. Dali
para frente, qualquer evolução (novos relatórios, exportações, permissões por
usuário etc.) é conversa nova — pela regra da seção 31, mudanças que afetem banco de
dados, arquitetura, fluxo de vendas/pagamentos ou autenticação são sempre discutidas
antes da implementação.

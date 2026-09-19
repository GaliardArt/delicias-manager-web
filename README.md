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
  recentes (atualmente com **dados de demonstração** em `src/lib/mock/dashboard.ts` —
  a Fase 6 vai conectar isso aos dados reais)
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

## Próximos passos (conforme seção 30 da especificação)

- **Fase 5** — Dias de Venda (agrupamento por endereço, fechamento)
- **Fase 6** — Conectar o Dashboard aos dados reais do Firestore (hoje usa mock)
- **Fase 7** — Relatórios + geração de resumo para WhatsApp
- **Fase 8** — Insights e tendências

Seguindo a regra da seção 31: mudanças que afetem banco de dados, arquitetura, fluxo de
vendas/pagamentos ou autenticação serão sempre discutidas antes da implementação.

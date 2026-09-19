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

## O que já está implementado (Fase 1 — Fundação)

- Estrutura do projeto (App Router, `src/features`, `src/lib`, `src/types`)
- Tema Tailwind com a paleta rosa/rosa bebê
- Layout responsivo: sidebar (desktop) + barra inferior de navegação (mobile/Android)
- Tela de login com Firebase Authentication
- Dashboard com indicadores, próximo Dia de Venda, próximas encomendas e atividades
  recentes (atualmente com **dados de demonstração** em `src/lib/mock/dashboard.ts`)
- Componentes de UI reutilizáveis: Button, Input, Card, Badge, EmptyState, StatCard
- Utilitários de formatação pt-BR (moeda, data, telefone) — `src/lib/utils/format.ts`
- Regras de segurança do Firestore (`firestore.rules`) exigindo autenticação
- Telas de Vendas, Encomendas, Dias de Venda, Clientes, Produtos e Relatórios criadas
  como estados vazios (empty state), prontas para receber as funcionalidades das
  próximas fases

## Próximos passos (conforme seção 30 da especificação)

- **Fase 2** — CRUD de Clientes e Produtos + busca
- **Fase 3** — Registro de vendas, pagamentos parciais e fiado
- **Fase 4** — Encomendas (criação, status, datas)
- **Fase 5** — Dias de Venda (agrupamento por endereço, fechamento)
- **Fase 6** — Conectar o Dashboard aos dados reais do Firestore (hoje usa mock)
- **Fase 7** — Relatórios + geração de resumo para WhatsApp
- **Fase 8** — Insights e tendências

Seguindo a regra da seção 31: mudanças que afetem banco de dados, arquitetura, fluxo de
vendas/pagamentos ou autenticação serão sempre discutidas antes da implementação.

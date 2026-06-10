# Melhorar visualização mobile

Você marcou todas as áreas e todos os sintomas, então vou atacar em 4 fases priorizadas pelo impacto. Cada fase é independente — você pode aprovar tudo ou só as primeiras.

## Princípios aplicados em todas as fases

Seguindo o padrão de responsividade do projeto (Tailwind v4):
- Cabeçalhos com texto + widget viram `grid grid-cols-[minmax(0,1fr)_auto]` no mobile e `sm:flex` no desktop
- Containers de texto recebem `min-w-0` + `truncate` pra não estourar
- Ícones/avatares recebem `shrink-0`
- Tipografia escala (`text-xl sm:text-2xl`, etc.)
- Padding lateral reduz no mobile (`px-4 md:px-10`)
- Tabelas largas viram lista de cards no `<md`

## Fase 1 — Navegação (a coisa que mais incomoda)

Hoje as sidebars de Cliente, Profissional e Admin ocupam a tela inteira ou ficam mal posicionadas no celular.

- **Cliente** (`ClienteSidebar`): virar um menu off-canvas (Sheet) acionado por um botão "menu" no `ClienteHeader`. No desktop continua a sidebar fixa.
- **Profissional** (`ProfissionalSidebar`): mesmo padrão — Sheet no mobile, sidebar no desktop.
- **Admin** (`AdminSidebar` + `AdminHeader`): mesmo padrão, e o header mostra o título da seção ativa no mobile.
- **Header público** (`Header`): revisar o menu mobile, garantir que o logo + CTA cabem em telas de 360px.

## Fase 2 — Textos e elementos cortados

Varredura nos cards e headers de todas as áreas pra aplicar o padrão `grid + min-w-0 + truncate + shrink-0`:

- Home / landing (`src/routes/index.tsx`, `Hero`, seções de serviços, footer)
- `ClienteHeader`, cards de `PedidosTab`, `PagamentosTab`, `DadosTab`
- `ProfissionalHeader`, `OrcamentoCard`, `ProfissionalStats`, `ProfissionalDashboard`
- Cards de KPI/metrics do Admin (`AdminKPIs`, `AdminMetrics`)

## Fase 3 — Tabelas e listas

As tabelas do Admin (`AdminClientes`, `AdminProfissionais`, `AdminPedidos`, `AdminFinanceiro`, `AdminLeads`) estouram horizontal no mobile.

Duas opções por tabela, escolho conforme a densidade:
- **Tabelas leves** (até 5 colunas relevantes): scroll horizontal com `overflow-x-auto` + primeira coluna fixa
- **Tabelas densas**: render alternativo como lista de cards no `<md`, tabela tradicional no `md+`

Mesma coisa em `ProfissionalOrcamentos` e listas longas do Cliente.

## Fase 4 — Polimento

- Espaçamentos e tamanhos de fonte de hero/seções na home
- Modais (`NotificationDetailModal`, `TermoAdesaoDialog`, etc.) virando bottom-sheet no mobile via `Drawer` quando fizer sentido
- Botões e CTAs com `min-h-11` (alvo de toque)
- Revisão final no viewport 360px e 390px

---

## Detalhes técnicos

- Não vou trocar lógica de negócio, só presentation (className, estrutura JSX, breakpoints).
- Onde precisar de estado novo (abrir/fechar Sheet), uso `useState` local no componente.
- O padrão exato vem de `<responsive-layout-patterns>` do projeto.
- Vou usar `Sheet` (já instalado, `src/components/ui/sheet.tsx`) pros menus mobile — sem nova dependência.
- Vou verificar visualmente no preview mobile (viewport 390px) ao final de cada fase.

## Como você quer prosseguir?

Me responde com uma das opções:
1. "Faz tudo" — executo as 4 fases em sequência
2. "Só fase 1" (ou 1 e 2, etc.) — executo só o que você pedir
3. "Começa pelo painel X" — priorizo Cliente, Profissional ou Admin

Recomendo começar por **Fase 1 + Fase 2 no painel do Profissional**, que é onde teus usuários passam mais tempo no celular.
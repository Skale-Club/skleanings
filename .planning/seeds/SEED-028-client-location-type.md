---
id: SEED-028
status: dormant
planted: 2026-05-10
last_revised: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: ao implementar o catálogo de serviços do Xkedule — residencial e não-residencial precisam coexistir desde o início
scope: Medium
---

# SEED-028: Serviços residenciais e não-residenciais — classificação e fluxos acoplados

## Why This Matters

O Xkedule precisa suportar **dois tipos fundamentais de serviço de limpeza simultaneamente, no mesmo tenant:**

1. **Residencial** — vai na casa do cliente. Endereço completo obrigatório, formulário pede infos da casa (quartos, pets), preço normalmente fixo ou por área.
2. **Não-residencial / Comercial** — vai em escritório, restaurante, loja, condomínio. Endereço comercial obrigatório, formulário pede infos do espaço (m², horário de funcionamento, frequência), preço normalmente por contrato/recorrência.

Os dois fluxos têm diferenças importantes que não dá para resolver com uma só lógica:
- Validações de endereço diferentes (apartamento vs unidade comercial)
- Campos de intake diferentes (ver SEED-027 — perguntas customizadas por serviço)
- Modelo de preço diferente (residencial fixo vs comercial por contrato)
- Notificações diferentes (residencial fala com pessoa; comercial fala com responsável da empresa)
- Booking flow diferente (residencial agenda 1 visita; comercial pode agendar recorrência indefinida)

**Why:** Se o sistema só suporta residencial, o tenant precisa criar workarounds estranhos para vender para empresas. Se só suporta comercial, perde 90% do mercado de limpeza. Acoplar os dois fluxos desde o início evita refatoração massiva depois.

## When to Surface

**Trigger:** ao implementar o módulo de catálogo de serviços do Xkedule (conjunto com SEED-013), porque a estrutura de dados precisa suportar os dois desde o schema inicial.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de catálogo de serviços do Xkedule
- Milestone de booking flow (precisa renderizar fluxos diferentes baseado no tipo)
- Conjunto com SEED-013 (multi-tenant) e SEED-031 (recurring)

## Scope Estimate

**Medium** — Uma fase substancial. Componentes:

1. **Schema:**
   - Coluna `serviceCategory` em `services` (enum: `residential` | `commercial` | `both`) — determina o fluxo de intake e validação
   - Coluna `defaultLocationType` em `services` (enum: `client_address` | `business_address` | `pickup` | `phone` | `online`) — onde o serviço é executado
   - Coluna `requiresContract` em `services` (boolean) — comerciais grandes podem exigir aceite de contrato antes do booking
   - Coluna `customerType` em `bookings` (enum: `individual` | `business`) — registrar quem foi o cliente

2. **Backend:**
   - Validação de endereço diferente por `serviceCategory` (residencial: apt opcional; comercial: razão social + responsável obrigatórios)
   - Modelo de preço residencial vs comercial pode usar pricingType diferentes (`fixed_item` vs `custom_quote`)

3. **Frontend:**
   - Booking flow detecta `serviceCategory` do primeiro serviço no cart e renderiza step de Customer Details apropriado
   - Residencial: Nome, email, telefone, endereço (com apt/unit), instruções de entrada
   - Comercial: Razão social, CNPJ, responsável (nome, cargo, email, telefone), endereço comercial, horário de funcionamento, instruções de acesso
   - Cart pode misturar serviços residenciais e comerciais? Decidir no planning — provavelmente NÃO (cliente diferente cada vez)

4. **Admin:**
   - Filtro de bookings por `customerType` (individual vs business) — relatórios separados
   - Templates de email/SMS diferentes (residencial: tom pessoal; comercial: tom institucional)

## Breadcrumbs

- `shared/schema.ts` — tabela `services` (adicionar `serviceCategory`, `defaultLocationType`, `requiresContract`)
- `shared/schema.ts` — tabela `bookings` (adicionar `customerType`, possivelmente `businessName`, `businessTaxId`, `contactPerson`)
- `client/src/pages/BookingPage.tsx` — step de Customer Details — branching baseado em `serviceCategory`
- `client/src/components/admin/ServicesSection.tsx` — UI de edição de serviço — campo "Categoria"
- Conjunto com SEED-027 (custom booking questions) — cada categoria pode ter perguntas padrão diferentes
- Conjunto com SEED-031 (recurring) — comerciais grandes tendem a ser recorrentes; alinhar UX

## Notes

**Tipo `both`:** alguns serviços (ex: limpeza de tapete) podem ser vendidos tanto para residencial quanto comercial. Esse caso usa `both` e o booking flow pergunta no início do checkout "É para sua casa ou empresa?".

**Contrato para comerciais:** quando `requiresContract = true`, o booking não é confirmado até o cliente aceitar termos específicos do contrato (digital signature ou upload de PDF assinado). Pode ser uma extensão futura — começar sem isso, com aceite simples de termos.

**Razão social / CNPJ:** para o mercado brasileiro. Para mercado americano, usar EIN. Schema deve ser genérico (`businessTaxId` text) — validação por tenant/país (SEED-011 locale).

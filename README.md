# Dashboard de Exportação — MilionCRM

Dashboard próprio para exportar leads/cartões do Kanban do MilionCRM com os
campos customizados (custom_attributes) da conversa, que não saem na
exportação nativa do CRM.

## Stack
React + Vite + biblioteca `xlsx`, deploy na Vercel.

## Como funciona
- **Login**: e-mail e senha do próprio MilionCRM (mesma lógica do projeto `milionchat`).
- **Seleção de conta**: automática — se o usuário tem acesso a mais de uma empresa, aparece um seletor.
- **Período**: Hoje / 7 dias / 30 dias / Este mês / Personalizado. O filtro é aplicado no
  cliente (frontend), depois de buscar todos os itens paginados do funil.
- **Exportação**: gera um `.xlsx` com colunas fixas — título, status, valor, data,
  e os 9 campos customizados mapeados na conta Render (distribuidora, usina, valor
  da conta, comissões, canal de aquisição, parceiro, modelo de pagamento).

## Rodar localmente
```bash
npm install
npm run dev
```

## Deploy
Publicar na Vercel normalmente. O `vercel.json` já configura o proxy de `/api/*`
para `https://milioncrm.agmilionario.com.br/*`, evitando problema de CORS.

## Próximos passos possíveis
- Tornar as colunas de exportação configuráveis por conta (hoje são fixas, pensadas
  para o Render).
- Buscar `custom_attribute_definitions` dinamicamente para detectar novos campos
  automaticamente.

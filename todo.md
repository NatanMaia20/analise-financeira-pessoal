# TODO - Dashboard Financeiro Pessoal

## Fase 1: Banco de Dados e Backend

- [x] Criar schema do banco de dados (transactions, imports, categories, financial_goals)
- [x] Implementar API de importação XLSX com validação e detecção de duplicatas
- [x] Criar helpers de processamento de dados (parsing de datas, valores, categorias)
- [x] Implementar lógica de cálculo de métricas (saldo, receitas, despesas, economia)
- [x] Criar sistema de análise automática para gerar insights
- [x] Implementar API de consulta de dados com filtros (período, categoria, conta, tipo)
- [x] Criar API para o assistente financeiro (contexto de dados para LLM)
- [x] Implementar sistema de metas financeiras
- [x] Criar API de projeções financeiras

## Fase 2: Frontend - Layout e Estrutura

- [x] Configurar tema escuro com paleta de cores (verde/esmeralda para positivo, vermelho para negativo)
- [x] Implementar DashboardLayout com sidebar de navegação
- [x] Criar página Home com placeholder para dashboard
- [x] Implementar navegação lateral com links para todas as seções
- [x] Configurar responsividade para desktop e mobile
- [x] Adicionar componentes de skeleton loading

## Fase 3: Frontend - Dashboard Principal

- [x] Criar componente de resumo financeiro (saldo, receitas, despesas, economia)
- [x] Implementar filtro global de período (semana, mês, trimestre, ano, personalizado)
- [x] Integrar filtro global com todos os gráficos e métricas
- [x] Criar indicadores KPI com cores apropriadas
- [x] Implementar atualização em tempo real dos dados ao mudar filtros

## Fase 4: Frontend - Gráficos Interativos

- [x] Implementar gráfico de evolução mensal (receitas vs despesas)
- [x] Implementar gráfico de distribuição de gastos por categoria (pizza/donut)
- [x] Implementar gráfico de gastos ao longo do tempo (linha)
- [x] Adicionar interatividade aos gráficos (hover, click, zoom)
- [ ] Implementar heatmap de gastos por dia/semana
- [ ] Criar gráfico de comparação mês a mês
- [ ] Adicionar exportação de gráficos como imagem

## Fase 5: Frontend - Tabela e Filtros

- [ ] Criar tabela de transações com paginação
- [ ] Implementar filtros por período, categoria, conta, tipo
- [ ] Adicionar busca por comentário/descrição
- [ ] Implementar ordenação por coluna
- [ ] Adicionar ações na tabela (editar, deletar, duplicar)
- [ ] Criar visualização em card para mobile

## Fase 6: Frontend - Análise por Categorias

- [ ] Criar página de análise por categorias
- [ ] Implementar ranking de categorias por gasto
- [ ] Criar gráfico de evolução histórica por categoria
- [ ] Implementar comparativo mês a mês por categoria
- [ ] Adicionar página de detalhes por categoria com histórico

## Fase 7: Frontend - Importação de XLSX

- [x] Criar página de importação de arquivo
- [x] Implementar drag-and-drop para upload
- [x] Adicionar validação de estrutura do arquivo
- [ ] Criar preview dos dados antes de importar
- [x] Implementar histórico de importações
- [ ] Adicionar opção de atualizar período já importado
- [x] Criar sistema de detecção de duplicatas

## Fase 8: Frontend - Insights Automáticos

- [x] Criar seção de insights na dashboard
- [x] Implementar geração de insights por IA
- [x] Exibir alertas de gastos elevados
- [x] Mostrar categorias com maior variação
- [x] Identificar meses de maior economia/gasto
- [x] Criar recomendações de redução de gastos

## Fase 9: Frontend - Assistente Financeiro

- [x] Implementar componente de chat
- [x] Integrar com API de assistente financeiro
- [x] Criar interface de conversa inteligente
- [x] Implementar histórico de mensagens
- [x] Adicionar sugestões de perguntas
- [ ] Implementar streaming de respostas

## Fase 10: Frontend - Metas e Projeções

- [ ] Criar página de metas financeiras
- [ ] Implementar criação de metas (economia mensal, limite por categoria, meta anual)
- [ ] Adicionar visualização de progresso das metas
- [ ] Implementar alertas quando limites são ultrapassados
- [ ] Criar página de projeções financeiras
- [ ] Implementar gráficos de projeção de gastos/receitas/saldo

## Fase 11: Frontend - Relatórios e Exportação

- [ ] Criar página de relatórios
- [ ] Implementar exportação para PDF
- [ ] Implementar exportação para Excel
- [ ] Criar relatório executivo com resumo e insights
- [ ] Adicionar exportação de gráficos como imagem
- [ ] Implementar agendamento de relatórios

## Fase 12: Testes e Validação

- [x] Escrever testes unitários para APIs
- [ ] Escrever testes de integração para importação XLSX
- [ ] Testar geração de insights com dados reais
- [ ] Testar assistente financeiro com perguntas variadas
- [ ] Validar responsividade em diferentes dispositivos
- [ ] Testar performance com grande volume de dados
- [x] Validar precisão dos cálculos financeiros

## Fase 13: Entrega e Documentação

- [ ] Importar arquivo real do usuário
- [ ] Validar dashboard com dados reais
- [ ] Criar documentação de uso
- [ ] Fazer checkpoint final
- [ ] Entregar projeto ao usuário

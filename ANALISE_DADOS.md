# Análise do Arquivo GastosFinanceiros.xlsx

## Resumo Executivo

- **Período**: 26/09/2025 a 10/06/2026 (9 meses)
- **Total de Despesas**: R$ 26.008,67
- **Total de Receita**: R$ 25.990,29
- **Saldo Líquido**: -R$ 18,38
- **Total de Transações**: 732 (530 despesas + 202 receitas)

## Estrutura das Abas

### 1. Aba "Despesas"
- **Linhas**: 530 registros
- **Colunas**: 9
  - Data e hora (formato: DD-MM-YY)
  - Categoria (20 categorias diferentes)
  - Conta (apenas "Banco do Brasil")
  - Valor na moeda da conta (BRL)
  - Moeda da conta (sempre BRL)
  - Valor da transação na moeda da transação (geralmente vazio)
  - Moeda de transação (geralmente vazio)
  - Etiquetas (tags opcionais)
  - Comentário (descrição da transação)

### 2. Aba "Receita"
- **Linhas**: 202 registros
- **Colunas**: 9 (mesma estrutura de Despesas)
- **Categorias**: 6 categorias

### 3. Aba "Transferências"
- **Linhas**: 0 registros (vazia)
- **Colunas**: 8
  - Data e hora
  - Saída (conta de origem)
  - Entrada (conta de destino)
  - Valor na moeda de saída
  - Moeda de saída
  - Valor na moeda de entrada
  - Moeda de entrada
  - Comentário

## Categorias de Despesas (20)

1. Café
2. Bares e Restaurantes
3. Casa
4. Compras de mercado
5. Namorado
6. Transf. Entre Contas
7. Despesas Pessoais
8. Outros
9. Cartão de Crédito
10. Transporte
11. Educação
12. Investimentos
13. Desp. Temp. De Terceiros
14. Presentes
15. Exercício físico
16. Lazer
17. Saúde
18. Perdas Financeiras
19. Família
20. Roupas e Acessórios

## Categorias de Receita (6)

1. Transf. entre Contas
2. Salário
3. Reembolso - Divisão de Conta
4. Investimentos
5. Outros
6. Estornos e Devoluções

## Etiquetas Identificadas

RU, FEIRA, MOTO, MERENDA, ÔNIBUS FACUL, BOLÃO, ACADEMIA, FARMÁCIA, ROLÊS E SAÍDAS, FESTAS

## Observações Importantes

1. **Moeda única**: Todas as transações estão em BRL
2. **Conta única**: Apenas "Banco do Brasil" é utilizada
3. **Transferências**: A aba está vazia, mas pode ser usada no futuro
4. **Comentários**: Fornecem contexto valioso sobre as transações
5. **Etiquetas**: Permitem categorização adicional e filtros avançados
6. **Padrão de datas**: Formato DD-MM-YY (ex: 06-10-26 = 10 de junho de 2026)

## Estrutura do Banco de Dados Recomendada

### Tabela: transactions
- id (PK)
- date (DateTime)
- type ('expense' | 'income' | 'transfer')
- category (String)
- account (String)
- amount (Decimal)
- currency (String, default: 'BRL')
- tags (JSON array)
- description (Text)
- import_id (FK para rastrear importações)
- created_at (DateTime)
- updated_at (DateTime)

### Tabela: imports
- id (PK)
- file_name (String)
- imported_at (DateTime)
- total_records (Int)
- status ('success' | 'failed')
- error_message (Text, nullable)

### Tabela: categories
- id (PK)
- name (String)
- type ('expense' | 'income')
- color (String, para UI)
- created_at (DateTime)

### Tabela: financial_goals
- id (PK)
- name (String)
- type ('monthly_savings' | 'category_limit' | 'annual_goal')
- target_amount (Decimal)
- current_amount (Decimal)
- period ('monthly' | 'quarterly' | 'annual')
- created_at (DateTime)
- updated_at (DateTime)

/**
 * Category classification rules.
 *
 * The user's personal finance export records internal money movements
 * (transfers between their own accounts, money advanced/repaid between
 * friends, investment contributions) as regular "Despesas"/"Receita"
 * categories instead of using a dedicated transfers sheet.
 *
 * If those categories are treated as normal expense/income, the totals
 * (saldo, taxa de economia, gasto médio mensal, etc.) become inflated
 * and misleading. This module centralizes the logic that recognizes
 * those special categories so the importer and the analysis layer agree
 * on how to treat them.
 */

export type CategoryFlow = 'personal' | 'internal_transfer' | 'third_party' | 'investment';

export const CATEGORY_FLOW_LABELS: Record<CategoryFlow, string> = {
  personal: 'Pessoal',
  internal_transfer: 'Transferência interna',
  third_party: 'Terceiros (repasse/reembolso)',
  investment: 'Investimento / Reserva',
};

export const CATEGORY_FLOW_DESCRIPTIONS: Record<CategoryFlow, string> = {
  personal: 'Gasto ou receita que afeta seu orçamento pessoal.',
  internal_transfer:
    'Dinheiro que apenas mudou de lugar entre suas próprias contas (ex: Banco do Brasil ↔ Mercado Pago, poupança). Não é considerado gasto nem receita real.',
  third_party:
    'Valores pagos por você em nome de outra pessoa ou reembolsos recebidos por isso. Não representa consumo nem ganho pessoal — é dinheiro "de passagem".',
  investment:
    'Valores destinados a investimentos/reservas. Saem do seu caixa, mas continuam fazendo parte do seu patrimônio.',
};

/**
 * Normalizes a category name for matching: lowercase, accents removed,
 * punctuation/extra whitespace collapsed.
 */
export function normalizeCategoryName(category: string | null | undefined): string {
  return (category ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .toLowerCase()
    .replace(/[.,_-]+/g, ' ') // punctuation -> space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Classifies a category name into a "flow" type that determines how it
 * should be treated in totals and charts.
 *
 * Matching is intentionally based on substrings of the normalized name so
 * that small variations ("Transf. Entre Contas" vs "Transf. entre Contas"
 * vs "Transferência entre contas") are all recognized.
 */
export function getCategoryFlow(category: string | null | undefined): CategoryFlow {
  const name = normalizeCategoryName(category);

  if (!name) return 'personal';

  // Internal transfers between the user's own accounts
  // e.g. "Transf. Entre Contas", "Transf. entre Contas", "Transferência entre contas"
  if (name.includes('transf') && (name.includes('conta') || name.includes('saldo'))) {
    return 'internal_transfer';
  }

  // Money advanced for / reimbursed by third parties
  // e.g. "Desp. Temp. De Terceiros", "Reembolso - Divisão de Conta"
  if (
    name.includes('terceiro') ||
    name.includes('reembolso') ||
    name.includes('rateio') ||
    name.includes('divisao de conta')
  ) {
    return 'third_party';
  }

  // Investments / savings allocations
  // e.g. "Investimentos"
  if (name.includes('invest') || name.includes('poupanca') || name.includes('reserva')) {
    return 'investment';
  }

  return 'personal';
}

export function isInternalTransferCategory(category: string | null | undefined): boolean {
  return getCategoryFlow(category) === 'internal_transfer';
}

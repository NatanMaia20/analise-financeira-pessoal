import { describe, it, expect } from 'vitest';
import { getCategoryFlow, normalizeCategoryName, isInternalTransferCategory } from './category-rules';

describe('category-rules', () => {
  describe('normalizeCategoryName', () => {
    it('removes accents, lowercases and collapses punctuation', () => {
      expect(normalizeCategoryName('Transf. Entre Contas')).toBe('transf entre contas');
      expect(normalizeCategoryName('Desp. Temp. De Terceiros')).toBe('desp temp de terceiros');
      expect(normalizeCategoryName('  Café  ')).toBe('cafe');
      expect(normalizeCategoryName(null)).toBe('');
      expect(normalizeCategoryName(undefined)).toBe('');
    });
  });

  describe('getCategoryFlow', () => {
    it('classifies internal transfer categories', () => {
      expect(getCategoryFlow('Transf. Entre Contas')).toBe('internal_transfer');
      expect(getCategoryFlow('Transf. entre Contas')).toBe('internal_transfer');
      expect(getCategoryFlow('Transferência entre contas')).toBe('internal_transfer');
    });

    it('classifies third-party pass-through categories', () => {
      expect(getCategoryFlow('Desp. Temp. De Terceiros')).toBe('third_party');
      expect(getCategoryFlow('Reembolso - Divisão de Conta')).toBe('third_party');
    });

    it('classifies investment categories', () => {
      expect(getCategoryFlow('Investimentos')).toBe('investment');
    });

    it('classifies everything else as personal', () => {
      expect(getCategoryFlow('Café')).toBe('personal');
      expect(getCategoryFlow('Bares e Restaurantes')).toBe('personal');
      expect(getCategoryFlow('Salário')).toBe('personal');
      expect(getCategoryFlow('Compras de mercado')).toBe('personal');
      expect(getCategoryFlow('')).toBe('personal');
      expect(getCategoryFlow(null)).toBe('personal');
    });

    it('does not misclassify "Transporte" as a transfer just because it shares letters', () => {
      expect(getCategoryFlow('Transporte')).toBe('personal');
    });
  });

  describe('isInternalTransferCategory', () => {
    it('matches helper to getCategoryFlow', () => {
      expect(isInternalTransferCategory('Transf. Entre Contas')).toBe(true);
      expect(isInternalTransferCategory('Café')).toBe(false);
    });
  });
});

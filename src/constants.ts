export const PAYMENT_METHODS = [
  { id: 'cash', label: 'Dinheiro' },
  { id: 'credit_card', label: 'Cartão de Crédito' },
  { id: 'debit_card', label: 'Cartão de Débito' },
  { id: 'pix', label: 'PIX' },
] as const;

export const TRANSACTION_CATEGORIES = [
  { id: 'sale', label: 'Venda' },
  { id: 'purchase', label: 'Compra de Estoque' },
  { id: 'expense', label: 'Despesa' },
  { id: 'other', label: 'Outros' },
] as const;

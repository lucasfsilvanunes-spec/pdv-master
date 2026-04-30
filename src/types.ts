export interface Product {
  id: string;
  name: string;
  price: number;
  costPrice: number;
  stock: number;
  category: string;
  sku: string;
  createdAt: string;
}

export interface SaleItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export type PaymentMethod = 'cash' | 'credit_card' | 'debit_card' | 'pix';

export interface SalePayment {
  method: PaymentMethod;
  amount: number;
  received?: number; // amount received (for cash)
  change?: number;   // change returned (for cash)
}

export interface UserProfile {
  id: string; // auth uid
  email: string;
  name: string;
  isActive: boolean;
  validityDate: string; // ISO string
  role: 'admin' | 'user';
  createdAt: string;
  // Onboarding fields
  full_name?: string;
  whatsapp?: string;
  cpf?: string;
  company_name?: string;
  cnpj?: string;
  business_industry?: string;
  trialUsed?: boolean;
  supportNotes?: string;
  planoEscolhido?: string;
  statusPagamento?: 'aguardando' | 'pago' | 'cancelado';
  dataSolicitacao?: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  cpf?: string;
  address?: string;
  createdAt: string;
  userId: string;
}

export interface CashierSession {
  id: string;
  openedAt: string;
  closedAt?: string;
  openingBalance: number;
  expectedClosingBalance: number;
  reportedClosingBalance?: number;
  status: 'open' | 'closed';
  userId: string;
}

export interface Invoice {
  id: string;
  saleId: string;
  invoiceNumber: string;
  accessKey: string;
  status: 'issued' | 'cancelled';
  xmlUrl?: string; // Simulated
  pdfUrl?: string; // Simulated
  createdAt: string;
  userId: string;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  payments: SalePayment[];
  customerId?: string;
  invoiceId?: string;
  createdAt: string;
  userId: string;
}

export interface CashTransaction {
  id: string;
  type: 'in' | 'out';
  amount: number;
  description: string;
  category: string;
  date: string;
  userId: string;
}

export interface Feedback {
  id: string;
  userId: string;
  userEmail: string;
  companyName?: string;
  message: string;
  type: 'bug' | 'suggestion' | 'support';
  status: 'new' | 'read' | 'resolved';
  createdAt: string;
}

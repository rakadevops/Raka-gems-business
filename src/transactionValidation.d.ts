export type TransactionKind = "Purchase" | "Expense" | "Sale" | "Payment";
export type PaymentDirection = "Incoming" | "Outgoing";
export type PaymentMethod = "Cash" | "Bank transfer" | "Cheque" | "Other";
export interface TransactionDraft {
  type: TransactionKind;
  counterparty: string;
  amount: string;
  weight?: string;
  stoneId?: string;
  paymentDirection?: PaymentDirection;
  paymentMethod?: PaymentMethod;
}
export function validateTransactionDraft(draft: TransactionDraft): { valid: boolean; errors: string[] };

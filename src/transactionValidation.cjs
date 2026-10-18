/**
 * Pure validation for the TradePilot transaction preview.
 * This module deliberately does not persist or post financial records.
 */
function validateTransactionDraft(draft) {
  const errors = [];
  const amount = Number(draft.amount);
  const weight = Number(draft.weight);

  if (!String(draft.counterparty || "").trim()) {
    errors.push("Enter the supplier or counterparty.");
  }
  if (!String(draft.amount || "").trim() || !Number.isFinite(amount) || amount <= 0) {
    errors.push("Enter an amount greater than zero.");
  }
  if (draft.type === "Purchase" && (!String(draft.weight || "").trim() || !Number.isFinite(weight) || weight <= 0)) {
    errors.push("A purchase needs a valid weight greater than zero.");
  }
  if (draft.type === "Sale" && !String(draft.stoneId || "").trim()) {
    errors.push("A sale must be linked to a stone ID.");
  }
  if (draft.type === "Payment" && !["Incoming", "Outgoing"].includes(draft.paymentDirection)) {
    errors.push("Choose whether the payment is incoming or outgoing.");
  }
  if (draft.type === "Payment" && !["Cash", "Bank transfer", "Cheque", "Other"].includes(draft.paymentMethod)) {
    errors.push("Choose a payment method.");
  }
  return { valid: errors.length === 0, errors };
}

module.exports = { validateTransactionDraft };

const test = require("node:test");
const assert = require("node:assert/strict");
const { validateTransactionDraft } = require("../src/transactionValidation.cjs");

test("accepts a valid purchase draft", () => {
  assert.deepEqual(validateTransactionDraft({type:"Purchase",counterparty:"Sunil Elahera",amount:"2200000",weight:"22"}), {valid:true,errors:[]});
});
test("rejects missing counterparty and non-positive amount", () => {
  const result = validateTransactionDraft({type:"Expense",counterparty:" ",amount:"0"});
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 2);
});
test("purchase requires a positive carat weight", () => {
  assert.equal(validateTransactionDraft({type:"Purchase",counterparty:"Supplier",amount:"1000",weight:"0"}).valid, false);
});
test("sale must be linked to a stone ID", () => {
  assert.match(validateTransactionDraft({type:"Sale",counterparty:"Buyer",amount:"150000",stoneId:" "}).errors[0], /stone ID/);
});
test("payment requires direction and method", () => {
  assert.equal(validateTransactionDraft({type:"Payment",counterparty:"Supplier",amount:"5000"}).valid, false);
  assert.equal(validateTransactionDraft({type:"Payment",counterparty:"Supplier",amount:"5000",paymentDirection:"Outgoing",paymentMethod:"Cheque"}).valid, true);
});
test("rejects non-numeric amounts", () => {
  assert.equal(validateTransactionDraft({type:"Expense",counterparty:"Courier",amount:"abc"}).valid, false);
});

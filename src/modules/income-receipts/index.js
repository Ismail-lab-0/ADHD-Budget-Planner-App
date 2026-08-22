// The Income Receipts module's public interface. See docs/ARCHITECTURE.md
// §7 and docs/DATA-MODEL.md "IncomeReceipt". Not a user-facing CRUD
// module — no create/update/delete actions — just the automatic
// historical log created by src/modules/incomes/ "Mark received" and read
// by src/modules/dashboard/index.js's `getPeriodSummary`.

export { createIncomeReceipt } from './create-receipt.js';
export { getAllIncomeReceipts, getIncomeReceiptsForPeriod, getIncomeReceiptsTotalCents } from './selectors.js';

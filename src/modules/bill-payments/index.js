// The Bill Payments module's public interface. See docs/ARCHITECTURE.md
// §7 and docs/DATA-MODEL.md "BillPayment". Not a user-facing CRUD module
// — no create/update/delete actions — just the automatic historical log
// created/un-created by src/modules/bills/ "Mark paid"/"Mark unpaid" and
// read by src/modules/dashboard/index.js's `getPeriodSummary`.

export { createBillPayment } from './create-payment.js';
export { getAllBillPayments, getBillPaymentsForPeriod, getBillPaymentsTotalCents } from './selectors.js';

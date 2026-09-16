import { useEffect, useRef } from "react";
import { formatCurrency } from "../utils/dashboardCalculations.js";

export default function PurchaseDialog({ isOpen, totals, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <dialog
      className="purchase-dialog"
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="purchase-dialog__header">
        <div>
          <p>Purchase summary</p>
          <h2>Total Purchase</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close purchase summary">
          ×
        </button>
      </div>

      <dl className="purchase-breakdown">
        <div>
          <dt>Transactions with other companies</dt>
          <dd>{formatCurrency(totals.companyTransactions)}</dd>
        </div>
        <div>
          <dt>Outside service purchases</dt>
          <dd>{formatCurrency(totals.outsideServices)}</dd>
        </div>
        <div className="purchase-breakdown__total">
          <dt>Combined total</dt>
          <dd>{formatCurrency(totals.totalPurchases)}</dd>
        </div>
      </dl>
    </dialog>
  );
}

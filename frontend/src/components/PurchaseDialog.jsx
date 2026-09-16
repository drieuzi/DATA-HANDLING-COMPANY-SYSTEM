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
          <p>Supplier purchase summary</p>
          <h2>Monthly Purchase</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close purchase summary">
          ×
        </button>
      </div>

      <dl className="purchase-breakdown">
        <div>
          <dt>Total supplier payables</dt>
          <dd>{formatCurrency(totals.payablePurchases)}</dd>
        </div>
      </dl>

      <p className="purchase-dialog__note">
        Outside-service expenses are calculated separately in Monthly Expenses Analytics.
      </p>
    </dialog>
  );
}

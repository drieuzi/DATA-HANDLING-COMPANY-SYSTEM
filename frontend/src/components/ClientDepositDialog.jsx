import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "../utils/dashboardCalculations.js";
import { formatRecordDate } from "../utils/recordHelpers.js";

function dateInputValue(value) {
  if (!value || value === "—") return "";
  const directMatch = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  if (directMatch) return directMatch[1];
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function ClientDepositDialog({
  transaction,
  clientName,
  onConfirm,
  onReschedule,
  onClose
}) {
  const dialogRef = useRef(null);
  const [chequeDate, setChequeDate] = useState("");
  const [message, setMessage] = useState("");
  const [workingAction, setWorkingAction] = useState("");

  useEffect(() => {
    setChequeDate(dateInputValue(transaction?.chequeDate));
    setMessage("");
    setWorkingAction("");
  }, [transaction]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (transaction && !dialog.open) dialog.showModal();
    if (!transaction && dialog.open) dialog.close();
  }, [transaction]);

  async function confirmDeposit() {
    setWorkingAction("confirm");
    setMessage("");
    try {
      await onConfirm(transaction.paymentId);
      onClose();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setWorkingAction("");
    }
  }

  async function saveNewDate() {
    if (!chequeDate) {
      setMessage("Choose a new cheque date.");
      return;
    }
    const collectionDate = dateInputValue(transaction.collectionDate);
    if (collectionDate && chequeDate < collectionDate) {
      setMessage("Cheque date cannot be earlier than the collection date.");
      return;
    }
    setWorkingAction("reschedule");
    setMessage("");
    try {
      await onReschedule(transaction.paymentId, chequeDate);
      onClose();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setWorkingAction("");
    }
  }

  return (
    <dialog className="record-dialog deposit-confirmation-dialog" ref={dialogRef} onClose={onClose}>
      <div className="record-dialog__header">
        <div><p>Client cheque</p><h2>Deposit Confirmation</h2></div>
        <button type="button" onClick={onClose} aria-label="Close deposit confirmation">×</button>
      </div>
      <div className="deposit-confirmation-content">
        <p className="deposit-confirmation-intro">
          Confirm the cheque only after the bank has successfully accepted the deposit.
        </p>
        <dl className="deposit-confirmation-details">
          <div><dt>Client</dt><dd>{clientName || "—"}</dd></div>
          <div><dt>Amount</dt><dd>{formatCurrency(transaction?.amount || 0)}</dd></div>
          <div><dt>C.R. Number</dt><dd>{transaction?.collectionReceipt || "—"}</dd></div>
          <div><dt>Collection Date</dt><dd>{formatRecordDate(transaction?.collectionDate)}</dd></div>
          <div><dt>Cheque Date</dt><dd>{formatRecordDate(transaction?.chequeDate)}</dd></div>
          <div><dt>Current Status</dt><dd>Pending Deposit</dd></div>
        </dl>

        <section className="deposit-reschedule-panel" aria-labelledby="newChequeDateLabel">
          <div>
            <strong id="newChequeDateLabel">Cheque not deposited yet?</strong>
            <span>Choose its new expected deposit date.</span>
          </div>
          <input
            type="date"
            min={dateInputValue(transaction?.collectionDate) || undefined}
            value={chequeDate}
            onChange={(event) => setChequeDate(event.target.value)}
          />
          <button type="button" className="secondary-action" disabled={Boolean(workingAction)} onClick={saveNewDate}>
            {workingAction === "reschedule" ? "Saving…" : "Save New Date"}
          </button>
        </section>

        {message && <p className="record-form__message" role="alert">{message}</p>}
        <div className="deposit-confirmation-actions">
          <button type="button" className="secondary-action" disabled={Boolean(workingAction)} onClick={onClose}>Close</button>
          <button type="button" className="primary-action" disabled={Boolean(workingAction) || !transaction?.depositDue} onClick={confirmDeposit}>
            {workingAction === "confirm" ? "Confirming…" : "Confirm Deposited"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

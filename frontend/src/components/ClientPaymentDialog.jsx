import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "../utils/dashboardCalculations.js";

const today = () => new Date().toISOString().slice(0, 10);

export default function ClientPaymentDialog({ isOpen, transaction, clientName, onSave, onClose }) {
  const dialogRef = useRef(null);
  const [fields, setFields] = useState({ amount: "", collectionDate: today(), collectionReceipt: "", chequeDate: "" });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFields({ amount: transaction ? String(transaction.balance) : "", collectionDate: today(), collectionReceipt: "", chequeDate: "" });
    setMessage("");
  }, [transaction, isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  async function submit(event) {
    event.preventDefault();
    const amount = Number(fields.amount);
    if (!transaction || amount !== Number(transaction.balance)) {
      setMessage("Partial payments are not allowed. Enter the full remaining balance.");
      return;
    }
    if (!fields.collectionDate || !fields.chequeDate) {
      setMessage("Collection date and cheque date are required.");
      return;
    }
    if (fields.chequeDate < fields.collectionDate) {
      setMessage("Cheque date cannot be earlier than the collection date.");
      return;
    }
    setSaving(true);
    try {
      await onSave({ ...fields, amount });
      onClose();
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  }

  return (
    <dialog className="record-dialog" ref={dialogRef} onClose={onClose}>
      <div className="record-dialog__header"><div><p>Receive client cheque</p><h2>{clientName}</h2></div><button type="button" onClick={onClose} aria-label="Close payment form">×</button></div>
      <form className="record-form" onSubmit={submit}>
        <div className="payment-balance record-form__wide"><span>Remaining balance</span><strong>{formatCurrency(transaction?.balance || 0)}</strong></div>
        <label>Full Payment Amount<input type="number" name="amount" value={fields.amount} readOnly aria-readonly="true" required /></label>
        <label>Collection Date<input type="date" name="collectionDate" value={fields.collectionDate} onChange={(event) => setFields({ ...fields, collectionDate: event.target.value })} required /></label>
        <label>Collection Receipt #<input name="collectionReceipt" value={fields.collectionReceipt} onChange={(event) => setFields({ ...fields, collectionReceipt: event.target.value })} /></label>
        <label>Cheque Date / Deposit Date<input type="date" name="chequeDate" min={fields.collectionDate || undefined} value={fields.chequeDate} onChange={(event) => setFields({ ...fields, chequeDate: event.target.value })} required /></label>
        <p className="record-form__message record-form__wide">The transaction will remain Not Paid until the cheque deposit is manually confirmed.</p>
        <p className="record-form__message record-form__wide" role="alert">{message}</p>
        <div className="record-form__actions record-form__wide"><button className="secondary-action" type="button" onClick={onClose}>Cancel</button><button className="primary-action" type="submit" disabled={saving}>{saving ? "Recording…" : "Record Pending Cheque"}</button></div>
      </form>
    </dialog>
  );
}

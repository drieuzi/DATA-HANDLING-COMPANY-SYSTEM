import { useEffect, useRef, useState } from "react";

const today = () => new Date().toISOString().slice(0, 10);
const emptyService = () => ({
  payee: "", item: "", receiptInvoiceNumber: "",
  tinNumber: "", amount: "", date: today()
});
const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];

export default function OutsideServiceEditorDialog({ isOpen, service, onSave, onClose }) {
  const dialogRef = useRef(null);
  const [fields, setFields] = useState(emptyService);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [attachment, setAttachment] = useState(null);

  useEffect(() => {
    setFields(service
      ? {
          payee: service.payee || "", item: service.item || "",
          receiptInvoiceNumber: service.receiptInvoiceNumber || "",
          tinNumber: service.tinNumber || "", amount: String(service.amount || ""),
          date: service.date || today()
        }
      : emptyService());
    setMessage("");
    setAttachment(null);
  }, [service, isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  function change(event) {
    setFields((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function selectAttachment(event) {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file) return;
    if (!allowedTypes.includes(file.type)) {
      return setMessage("Only PDF, JPG, and PNG attachments are allowed.");
    }
    if (file.size > 5 * 1024 * 1024) {
      return setMessage("The attachment must not exceed 5 MB.");
    }
    setAttachment(file);
    setMessage("");
  }

  async function submit(event) {
    event.preventDefault();
    if (!fields.payee.trim()) return setMessage("Enter the payee or company name.");
    if (!fields.item.trim()) return setMessage("Enter the other expense item.");
    if (!fields.receiptInvoiceNumber.trim()) return setMessage("Enter the OR/S.I. number.");
    if (!fields.tinNumber.trim()) return setMessage("Enter the TIN number.");
    if (!fields.date) return setMessage("Select the expense date.");
    if (!Number.isFinite(Number(fields.amount)) || Number(fields.amount) <= 0) {
      return setMessage("Enter an amount greater than zero.");
    }
    setSaving(true);
    setMessage("");
    try {
      await onSave({
        payee: fields.payee.trim(),
        item: fields.item.trim(),
        receiptInvoiceNumber: fields.receiptInvoiceNumber.trim(),
        tinNumber: fields.tinNumber.trim(),
        amount: Number(fields.amount).toFixed(2),
        date: fields.date,
        attachment
      });
      onClose();
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  }

  return (
    <dialog className="record-dialog" ref={dialogRef} onClose={onClose}>
      <div className="record-dialog__header">
        <div>
          <p>{service ? "Edit other expense" : "New other expense"}</p>
          <h2>Expense Information</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close other expense form">×</button>
      </div>
      <form className="record-form" onSubmit={submit}>
        <label className="record-form__wide">
          Payee / Company Name
          <input name="payee" value={fields.payee} onChange={change} maxLength="160" required />
        </label>
        <label className="record-form__wide">
          Item
          <input name="item" value={fields.item} onChange={change} maxLength="200" required />
        </label>
        <label>
          OR/S.I. Number
          <input name="receiptInvoiceNumber" value={fields.receiptInvoiceNumber} onChange={change} maxLength="80" required />
        </label>
        <label>
          TIN Number
          <input name="tinNumber" value={fields.tinNumber} onChange={change} maxLength="40" required />
        </label>
        <label>
          Amount
          <input name="amount" type="number" min="0.01" step="0.01" value={fields.amount} onChange={change} required />
        </label>
        <label>
          Date
          <input name="date" type="date" value={fields.date} onChange={change} required />
        </label>
        <div className="record-form__wide outside-service-attachment-field">
          <span>Attachment <small>(optional · PDF, JPG, or PNG · maximum 5 MB)</small></span>
          <label className="outside-service-file-button">
            {attachment ? "Choose a different file" : service?.hasAttachment ? "Replace attachment" : "Choose file"}
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={selectAttachment} />
          </label>
          {attachment ? (
            <div className="outside-service-selected-file">
              <span>{attachment.name}</span>
              <button type="button" onClick={() => setAttachment(null)}>Remove file</button>
            </div>
          ) : service?.hasAttachment ? (
            <small>Current attachment: {service.attachmentName}</small>
          ) : <small>No file selected.</small>}
        </div>
        <p className="record-form__message record-form__wide" role="alert">{message}</p>
        <div className="record-form__actions record-form__wide">
          <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
          <button className="primary-action" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save Other Expense"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

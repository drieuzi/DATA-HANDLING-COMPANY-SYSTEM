import { useEffect, useRef, useState } from "react";

const today = () => new Date().toISOString().slice(0, 10);
const emptyService = () => ({ item: "", amount: "", date: today() });

export default function OutsideServiceEditorDialog({ isOpen, service, onSave, onClose }) {
  const dialogRef = useRef(null);
  const [fields, setFields] = useState(emptyService);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFields(service
      ? { item: service.item || "", amount: String(service.amount || ""), date: service.date || today() }
      : emptyService());
    setMessage("");
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

  async function submit(event) {
    event.preventDefault();
    if (!fields.item.trim()) return setMessage("Enter the outside service item.");
    if (!fields.date) return setMessage("Select the service date.");
    if (!Number.isFinite(Number(fields.amount)) || Number(fields.amount) <= 0) {
      return setMessage("Enter an amount greater than zero.");
    }
    setSaving(true);
    setMessage("");
    try {
      await onSave({
        item: fields.item.trim(),
        amount: Number(fields.amount).toFixed(2),
        date: fields.date
      });
      onClose();
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  }

  return (
    <dialog className="record-dialog" ref={dialogRef} onClose={onClose}>
      <div className="record-dialog__header">
        <div>
          <p>{service ? "Edit outside service" : "New outside service"}</p>
          <h2>Service Information</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close outside service form">×</button>
      </div>
      <form className="record-form" onSubmit={submit}>
        <label className="record-form__wide">
          Item
          <input name="item" value={fields.item} onChange={change} maxLength="200" required />
        </label>
        <label>
          Amount
          <input name="amount" type="number" min="0.01" step="0.01" value={fields.amount} onChange={change} required />
        </label>
        <label>
          Date
          <input name="date" type="date" value={fields.date} onChange={change} required />
        </label>
        <p className="record-form__message record-form__wide" role="alert">{message}</p>
        <div className="record-form__actions record-form__wide">
          <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
          <button className="primary-action" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save Outside Service"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

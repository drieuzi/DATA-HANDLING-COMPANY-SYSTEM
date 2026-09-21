import { useEffect, useRef, useState } from "react";

const emptySupplier = {
  name: "",
  contactPerson: "",
  contactNumber: "",
  isActive: true
};

export default function SupplierEditorDialog({ isOpen, supplier, onSave, onClose }) {
  const dialogRef = useRef(null);
  const [fields, setFields] = useState(emptySupplier);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFields(supplier ? { ...emptySupplier, ...supplier } : emptySupplier);
    setMessage("");
  }, [supplier, isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  async function submit(event) {
    event.preventDefault();
    if (fields.name.trim().length < 2) {
      setMessage("Enter the supplier name.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await onSave({ ...fields, name: fields.name.trim() });
      onClose();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog className="record-dialog" ref={dialogRef} onClose={onClose}>
      <div className="record-dialog__header">
        <div><p>{supplier ? "Edit supplier" : "New supplier"}</p><h2>Supplier Information</h2></div>
        <button type="button" onClick={onClose} aria-label="Close supplier form">×</button>
      </div>
      <form className="record-form" onSubmit={submit}>
        <label className="record-form__wide">Company Name<input name="name" value={fields.name} onChange={(event) => setFields({ ...fields, name: event.target.value })} required /></label>
        <label>Contact Person<input name="contactPerson" value={fields.contactPerson} onChange={(event) => setFields({ ...fields, contactPerson: event.target.value })} /></label>
        <label>Contact Number<input name="contactNumber" value={fields.contactNumber} onChange={(event) => setFields({ ...fields, contactNumber: event.target.value })} /></label>
        <p className="record-form__message record-form__wide" role="alert">{message}</p>
        <div className="record-form__actions record-form__wide">
          <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
          <button className="primary-action" type="submit" disabled={saving}>{saving ? "Saving…" : "Save Supplier"}</button>
        </div>
      </form>
    </dialog>
  );
}

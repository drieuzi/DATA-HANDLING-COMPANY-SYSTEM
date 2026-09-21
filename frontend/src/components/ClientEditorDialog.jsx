import { useEffect, useRef, useState } from "react";

const emptyClient = {
  name: "", contactPerson: "", contactNumber: "", isActive: true
};

export default function ClientEditorDialog({ isOpen, client, onSave, onClose }) {
  const dialogRef = useRef(null);
  const [fields, setFields] = useState(emptyClient);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFields(client ? { ...emptyClient, ...client } : emptyClient);
    setMessage("");
  }, [client, isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  async function submit(event) {
    event.preventDefault();
    if (fields.name.trim().length < 2) return setMessage("Enter the client name.");
    setSaving(true);
    setMessage("");
    try {
      await onSave({ ...fields, name: fields.name.trim() });
      onClose();
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  }

  const change = (event) => setFields((current) => ({ ...current, [event.target.name]: event.target.value }));
  return (
    <dialog className="record-dialog" ref={dialogRef} onClose={onClose}>
      <div className="record-dialog__header"><div><p>{client ? "Edit client" : "New client"}</p><h2>Client Information</h2></div><button type="button" onClick={onClose} aria-label="Close client form">×</button></div>
      <form className="record-form" onSubmit={submit}>
        <label className="record-form__wide">Company Name<input name="name" value={fields.name} onChange={change} required /></label>
        <label>Contact Person<input name="contactPerson" value={fields.contactPerson} onChange={change} /></label>
        <label>Contact Number<input name="contactNumber" value={fields.contactNumber} onChange={change} /></label>
        <p className="record-form__message record-form__wide" role="alert">{message}</p>
        <div className="record-form__actions record-form__wide"><button className="secondary-action" type="button" onClick={onClose}>Cancel</button><button className="primary-action" type="submit" disabled={saving}>{saving ? "Saving…" : "Save Client"}</button></div>
      </form>
    </dialog>
  );
}

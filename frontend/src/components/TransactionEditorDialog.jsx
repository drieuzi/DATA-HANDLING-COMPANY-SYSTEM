import { useEffect, useRef, useState } from "react";

function createInitialFields(type, transaction) {
  if (transaction) {
    return {
      ...transaction,
      amount: String(transaction.amount ?? ""),
      balance: String(transaction.balance ?? ""),
      voucherDate: transaction.voucherDate === "—" ? "" : transaction.voucherDate || "",
      paymentDate: transaction.paymentDate === "—" ? "" : transaction.paymentDate || "",
      chequeDate: transaction.chequeDate === "—" ? "" : transaction.chequeDate || ""
    };
  }

  return type === "supplier"
    ? {
        purchaseOrder: "",
        salesInvoice: "",
        amount: "",
        attachmentName: ""
      }
    : {
        purchaseOrder: "",
        salesInvoice: "",
        collectionReceipt: "",
        date: new Date().toISOString().slice(0, 10),
        paymentDate: "",
        amount: "",
        balance: "",
        attachmentName: ""
      };
}

export default function TransactionEditorDialog({
  isOpen,
  type,
  companyName,
  transaction,
  onSave,
  onClose
}) {
  const dialogRef = useRef(null);
  const [fields, setFields] = useState(() => createInitialFields(type, transaction));
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const isSupplier = type === "supplier";

  useEffect(() => {
    setFields(createInitialFields(type, transaction));
    setMessage("");
  }, [type, transaction, isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  function updateField(event) {
    const { name, value } = event.target;
    setFields((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const amount = Number(fields.amount);
    const balance = transaction?.balance ?? amount;

    if (!fields.purchaseOrder.trim() || !fields.salesInvoice.trim() || amount <= 0) {
      setMessage("P.O. number, S.I. number, and a valid amount are required.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      await onSave({
        ...fields,
        id: transaction?.id,
        purchaseOrder: fields.purchaseOrder.trim(),
        salesInvoice: fields.salesInvoice.trim(),
        collectionReceipt: isSupplier ? undefined : fields.collectionReceipt?.trim() || "—",
        paymentDate: fields.paymentDate || (isSupplier ? "" : "—"),
        amount,
        balance,
        attachmentName: fields.attachmentName || ""
      });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog className="record-dialog" ref={dialogRef} onClose={onClose}>
      <div className="record-dialog__header">
        <div>
          <p>{transaction ? "Edit transaction" : "New transaction"}</p>
          <h2>{companyName}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close transaction form">×</button>
      </div>

        <form className="record-form" onSubmit={handleSubmit}>
          <label>
            P.O. Number
            <input name="purchaseOrder" value={fields.purchaseOrder} onChange={updateField} required />
          </label>

          <label>
            S.I. Number
            <input name="salesInvoice" value={fields.salesInvoice} onChange={updateField} required />
          </label>

          {!isSupplier && (
            <label>
              Transaction Date
              <input type="date" name="date" value={fields.date} onChange={updateField} required />
            </label>
          )}

          <label>
            Amount
            <input type="number" min="0.01" step="0.01" name="amount" value={fields.amount} onChange={updateField} required />
          </label>

          <label className="record-form__wide">
            Hardcopy attachment
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(event) => {
                const file = event.target.files?.[0];
                setFields((current) => ({ ...current, attachmentName: file?.name || "" }));
              }}
            />
            {fields.attachmentName && <small>Selected: {fields.attachmentName}</small>}
          </label>

          <p className="record-form__message" role="alert">{message}</p>

          <div className="record-form__actions record-form__wide">
            <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
            <button className="primary-action" type="submit" disabled={saving}>{saving ? "Saving…" : "Save Transaction"}</button>
          </div>
        </form>
    </dialog>
  );
}

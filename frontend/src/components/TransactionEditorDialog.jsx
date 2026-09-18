import { useEffect, useRef, useState } from "react";

function createInitialFields(type, transaction) {
  if (transaction) {
    return {
      ...transaction,
      amount: String(transaction.amount ?? ""),
      balance: String(transaction.balance ?? ""),
      paymentDate: transaction.paymentDate === "—" ? "" : transaction.paymentDate || ""
    };
  }

  return type === "supplier"
    ? {
        purchaseOrder: "",
        salesInvoice: "",
        collectionReceipt: "",
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
  const isSupplier = type === "supplier";
  const isVoucherLocked = isSupplier && ["Draft", "Issued"].includes(transaction?.voucherStatus);

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

  function handleSubmit(event) {
    event.preventDefault();
    const amount = Number(fields.amount);
    const balance = isSupplier
      ? transaction?.balance ?? amount
      : fields.balance === "" ? amount : Number(fields.balance);

    if (!fields.purchaseOrder.trim() || !fields.salesInvoice.trim() || amount <= 0) {
      setMessage("P.O. number, S.I. number, and a valid amount are required.");
      return;
    }

    if (balance < 0 || balance > amount) {
      setMessage("Balance must be between zero and the transaction amount.");
      return;
    }

    if (!isSupplier && balance < amount && !fields.paymentDate) {
      setMessage("Enter the exact payment date for a paid or partially paid transaction.");
      return;
    }

    onSave({
      ...fields,
      id: transaction?.id,
      purchaseOrder: fields.purchaseOrder.trim(),
      salesInvoice: fields.salesInvoice.trim(),
      collectionReceipt: fields.collectionReceipt.trim() || "—",
      paymentDate: fields.paymentDate || "—",
      amount,
      balance,
      attachmentName: fields.attachmentName || ""
    });
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

      {isVoucherLocked ? (
        <div className="locked-record-message">
          This transaction is locked because voucher {transaction.voucherNumber} is {transaction.voucherStatus.toLowerCase()}.
          Cancel the voucher before editing its financial details.
        </div>
      ) : (
        <form className="record-form" onSubmit={handleSubmit}>
          <label>
            P.O. Number
            <input name="purchaseOrder" value={fields.purchaseOrder} onChange={updateField} required />
          </label>

          <label>
            S.I. Number
            <input name="salesInvoice" value={fields.salesInvoice} onChange={updateField} required />
          </label>

          <label>
            C.R. Number
            <input name="collectionReceipt" value={fields.collectionReceipt} onChange={updateField} />
          </label>

          {!isSupplier && (
            <label>
              Transaction Date
              <input type="date" name="date" value={fields.date} onChange={updateField} required />
            </label>
          )}

          {!isSupplier && (
            <label>
              Exact Payment Date
              <input type="date" name="paymentDate" value={fields.paymentDate} onChange={updateField} />
            </label>
          )}

          <label>
            Amount
            <input type="number" min="0.01" step="0.01" name="amount" value={fields.amount} onChange={updateField} required />
          </label>

          {!isSupplier && (
            <label>
              Remaining Balance
              <input type="number" min="0" step="0.01" name="balance" value={fields.balance} onChange={updateField} />
            </label>
          )}

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
            <button className="primary-action" type="submit">Save Transaction</button>
          </div>
        </form>
      )}
    </dialog>
  );
}

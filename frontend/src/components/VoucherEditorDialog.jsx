import { useEffect, useMemo, useRef, useState } from "react";

const currentDate = () => new Date().toISOString().slice(0, 10);

export default function VoucherEditorDialog({ isOpen, voucherNumber, suppliers, onSave, onClose }) {
  const dialogRef = useRef(null);
  const [fields, setFields] = useState({});
  const [message, setMessage] = useState("");
  const supplier = suppliers.find((item) => item.id === fields.supplierId);
  const availableTransactions = useMemo(
    () => supplier?.transactions.filter((item) => Number(item.balance) > 0 && !["Draft", "Issued"].includes(item.voucherStatus)) || [],
    [supplier]
  );
  const transaction = availableTransactions.find((item) => item.id === fields.transactionId);

  useEffect(() => {
    if (!isOpen) return;
    setFields({ voucherNumber, supplierId: "", transactionId: "", voucherDate: currentDate(), paymentDate: currentDate(), chequeNumber: "", chequeDate: currentDate(), particulars: "", amountApplied: "", attachmentName: "", status: "Draft" });
    setMessage("");
  }, [isOpen, voucherNumber]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  function updateField(event) {
    const { name, value } = event.target;
    setFields((current) => {
      if (name === "supplierId") return { ...current, supplierId: value, transactionId: "", amountApplied: "" };
      if (name === "transactionId") {
        const selected = availableTransactions.find((item) => item.id === value);
        return { ...current, transactionId: value, amountApplied: selected ? String(selected.balance) : "" };
      }
      return { ...current, [name]: value };
    });
  }

  function submit(event) {
    event.preventDefault();
    const amountApplied = Number(fields.amountApplied);
    if (!supplier || !transaction || !fields.chequeNumber.trim() || amountApplied <= 0) {
      setMessage("Supplier, transaction, cheque number, and a valid amount are required.");
      return;
    }
    if (amountApplied > Number(transaction.balance)) {
      setMessage("Applied amount cannot be greater than the payable balance.");
      return;
    }
    if (amountApplied !== Number(transaction.balance)) {
      setMessage("The voucher amount must equal the full payable balance. Issuing it will mark the transaction Paid.");
      return;
    }
    onSave({ ...fields, supplierName: supplier.name, purchaseOrder: transaction.purchaseOrder, salesInvoice: transaction.salesInvoice, chequeNumber: fields.chequeNumber.trim(), amountApplied });
  }

  return (
    <dialog className="record-dialog voucher-dialog" ref={dialogRef} onClose={onClose}>
      <div className="record-dialog__header">
        <div><p>New voucher cheque</p><h2>Voucher #{voucherNumber}</h2></div>
        <button type="button" onClick={onClose} aria-label="Close voucher form">×</button>
      </div>
      <form className="record-form" onSubmit={submit}>
        <label>Supplier
          <select name="supplierId" value={fields.supplierId || ""} onChange={updateField} required>
            <option value="">Select supplier</option>
            {suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>Payable transaction
          <select name="transactionId" value={fields.transactionId || ""} onChange={updateField} disabled={!supplier} required>
            <option value="">Select P.O. / S.I.</option>
            {availableTransactions.map((item) => <option key={item.id} value={item.id}>{item.purchaseOrder} · {item.salesInvoice} · ₱{Number(item.balance).toLocaleString()}</option>)}
          </select>
        </label>
        <label>Voucher Date<input type="date" name="voucherDate" value={fields.voucherDate || ""} onChange={updateField} required /></label>
        <label>Payment Date<input type="date" name="paymentDate" value={fields.paymentDate || ""} onChange={updateField} required /></label>
        <label>Cheque Number<input name="chequeNumber" value={fields.chequeNumber || ""} onChange={updateField} required /></label>
        <label>Cheque Date<input type="date" name="chequeDate" value={fields.chequeDate || ""} onChange={updateField} required /></label>
        <label>Payment Amount<input type="number" min="0.01" max={transaction?.balance || undefined} step="0.01" name="amountApplied" value={fields.amountApplied || ""} onChange={updateField} required /></label>
        <label>Status
          <select name="status" value={fields.status || "Draft"} onChange={updateField}><option>Draft</option><option>Issued</option></select>
        </label>
        <label className="record-form__wide">Particulars<textarea name="particulars" value={fields.particulars || ""} onChange={updateField} rows="3" /></label>
        <label className="record-form__wide">Scanned voucher or hardcopy
          <input type="file" accept="image/*,.pdf" onChange={(event) => setFields((current) => ({ ...current, attachmentName: event.target.files?.[0]?.name || "" }))} />
          {fields.attachmentName && <small>Selected: {fields.attachmentName}</small>}
        </label>
        <p className="record-form__message record-form__wide" role="alert">{message}</p>
        <div className="record-form__actions record-form__wide"><button className="secondary-action" type="button" onClick={onClose}>Cancel</button><button className="primary-action" type="submit">Save Voucher</button></div>
      </form>
    </dialog>
  );
}

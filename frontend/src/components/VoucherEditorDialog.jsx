import { useEffect, useMemo, useRef, useState } from "react";

const currentDate = () => new Date().toISOString().slice(0, 10);

export default function VoucherEditorDialog({ isOpen, voucherNumber, voucher = null, suppliers, onSave, onClose }) {
  const dialogRef = useRef(null);
  const [fields, setFields] = useState({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const supplier = suppliers.find((item) => String(item.id) === String(fields.supplierId));
  const availableTransactions = useMemo(
    () => supplier?.transactions.filter((item) => !item.deletedAt && (Number(item.balance) > 0 || String(item.id) === String(voucher?.transactionId))) || [],
    [supplier, voucher]
  );
  const transaction = availableTransactions.find((item) => String(item.id) === String(fields.transactionId));
  const maximumPayment = voucher?.status === "Issued"
    ? Number(transaction?.balance || 0) + Number(voucher.amountApplied || 0)
    : Number(transaction?.balance || 0);

  useEffect(() => {
    if (!isOpen) return;
    setFields(voucher ? {
      ...voucher,
      voucherNumber: voucher.voucherNumber || voucherNumber,
      supplierId: String(voucher.supplierId || ""),
      transactionId: String(voucher.transactionId || ""),
      voucherDate: String(voucher.voucherDate || "").slice(0, 10),
      paymentDate: voucher.paymentDate === "—" ? "" : String(voucher.paymentDate || "").slice(0, 10),
      chequeDate: voucher.chequeDate === "—" ? "" : String(voucher.chequeDate || "").slice(0, 10),
      amountApplied: String(voucher.amountApplied || "")
    } : { voucherNumber, supplierId: "", transactionId: "", voucherDate: currentDate(), paymentDate: currentDate(), chequeNumber: "", chequeDate: currentDate(), particulars: "", amountApplied: "", status: "Draft" });
    setMessage("");
  }, [isOpen, voucherNumber, voucher]);

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
        const selected = availableTransactions.find((item) => String(item.id) === String(value));
        return { ...current, transactionId: value, amountApplied: selected ? String(selected.balance) : "" };
      }
      return { ...current, [name]: value };
    });
  }

  async function submit(event) {
    event.preventDefault();
    const amountApplied = Number(fields.amountApplied);
    if (!fields.voucherNumber?.trim() || !supplier || !transaction || !fields.chequeNumber.trim() || amountApplied <= 0) {
      setMessage("Supplier, transaction, cheque number, and a valid amount are required.");
      return;
    }
    if (amountApplied > maximumPayment) {
      setMessage("Applied amount cannot be greater than the payable balance.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await onSave({ ...fields, voucherNumber: fields.voucherNumber.trim(), supplierName: supplier.name, purchaseOrder: transaction.purchaseOrder, salesInvoice: transaction.salesInvoice, chequeNumber: fields.chequeNumber.trim(), amountApplied });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog className="record-dialog voucher-dialog" ref={dialogRef} onClose={onClose}>
      <div className="record-dialog__header">
        <div><p>{voucher ? "Edit voucher cheque" : "New voucher cheque"}</p><h2>Voucher #{fields.voucherNumber || voucherNumber}</h2></div>
        <button type="button" onClick={onClose} aria-label="Close voucher form">×</button>
      </div>
      <form className="record-form" onSubmit={submit}>
        <label>Voucher Number<input value={fields.voucherNumber || voucherNumber} readOnly aria-readonly="true" /></label>
        <label>Supplier
          <select name="supplierId" value={fields.supplierId || ""} onChange={updateField} disabled={Boolean(voucher)} required>
            <option value="">Select supplier</option>
            {suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>Payable transaction
          <select name="transactionId" value={fields.transactionId || ""} onChange={updateField} disabled={!supplier || Boolean(voucher)} required>
            <option value="">Select P.O. / S.I.</option>
            {availableTransactions.map((item) => <option key={item.id} value={item.id}>P.O. {item.purchaseOrder} · S.I. {item.salesInvoice}</option>)}
          </select>
        </label>
        <label>Voucher Date<input type="date" name="voucherDate" value={fields.voucherDate || ""} onChange={updateField} required /></label>
        <label>Payment Date<input type="date" name="paymentDate" value={fields.paymentDate || ""} onChange={updateField} required /></label>
        <label>Cheque Number<input name="chequeNumber" value={fields.chequeNumber || ""} onChange={updateField} required /></label>
        <label>Cheque Date<input type="date" name="chequeDate" value={fields.chequeDate || ""} onChange={updateField} required /></label>
        <label>Payment Amount<input type="number" min="0.01" max={maximumPayment || undefined} step="0.01" name="amountApplied" value={fields.amountApplied || ""} onChange={updateField} required /></label>
        <label>Status
          <select name="status" value={fields.status || "Draft"} onChange={updateField} disabled={Boolean(voucher)}><option>Draft</option><option>Issued</option></select>
        </label>
        <label className="record-form__wide">Particulars<textarea name="particulars" value={fields.particulars || ""} onChange={updateField} rows="3" /></label>
        <p className="record-form__message record-form__wide" role="alert">{message}</p>
        <div className="record-form__actions record-form__wide"><button className="secondary-action" type="button" onClick={onClose}>Cancel</button><button className="primary-action" type="submit" disabled={saving}>{saving ? "Saving…" : voucher ? "Save Changes" : "Save Voucher"}</button></div>
      </form>
    </dialog>
  );
}

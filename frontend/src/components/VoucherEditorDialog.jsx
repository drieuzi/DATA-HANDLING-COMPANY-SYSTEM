import { useEffect, useMemo, useRef, useState } from "react";

const currentDate = () => new Date().toISOString().slice(0, 10);

export default function VoucherEditorDialog({ isOpen, voucherNumber = "", voucher = null, suppliers, onSave, onClose }) {
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
  const grossAmount = Number(fields.amountApplied || 0);
  const withholdingTaxAmount = fields.applyWithholdingTax
    ? Math.round(grossAmount * 0.01 * 100) / 100
    : 0;
  const netChequeAmount = Math.max(grossAmount - withholdingTaxAmount, 0);
  const displayedVoucherNumber = String(fields.voucherNumber || voucherNumber || "").trim();

  useEffect(() => {
    if (!isOpen) return;
    setFields(voucher ? {
      ...voucher,
      voucherNumber: voucher.voucherNumber || "",
      supplierId: String(voucher.supplierId || ""),
      transactionId: String(voucher.transactionId || ""),
      voucherDate: String(voucher.voucherDate || "").slice(0, 10),
      paymentDate: voucher.paymentDate === "—" ? "" : String(voucher.paymentDate || "").slice(0, 10),
      chequeDate: voucher.chequeDate === "—" ? "" : String(voucher.chequeDate || "").slice(0, 10),
      amountApplied: String(voucher.amountApplied || ""),
      applyWithholdingTax: Number(voucher.withholdingTaxRate || 0) === 0.01,
      bankName: voucher.bankName || ""
    } : { voucherNumber, supplierId: "", transactionId: "", voucherDate: currentDate(), paymentDate: currentDate(), chequeNumber: "", chequeDate: currentDate(), particulars: "", amountApplied: "", applyWithholdingTax: false, bankName: "", status: "Draft" });
    setMessage("");
  }, [isOpen, voucher, voucherNumber]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setFields((current) => {
      if (name === "supplierId") return { ...current, supplierId: value, transactionId: "", amountApplied: "" };
      if (name === "transactionId") {
        const selected = availableTransactions.find((item) => String(item.id) === String(value));
        return { ...current, transactionId: value, amountApplied: selected ? String(selected.balance) : "" };
      }
      return { ...current, [name]: type === "checkbox" ? checked : value };
    });
  }

  async function submit(event) {
    event.preventDefault();
    const amountApplied = Number(fields.amountApplied);
    if (!voucher && !displayedVoucherNumber) {
      setMessage("The next voucher number has not loaded. Close this form and try again.");
      return;
    }
    if (!supplier || !transaction || !fields.chequeNumber.trim() || !fields.bankName?.trim() || amountApplied <= 0) {
      setMessage("Supplier, transaction, cheque number, bank used, and a valid amount are required.");
      return;
    }
    if (amountApplied > maximumPayment) {
      setMessage("Applied amount cannot be greater than the payable balance.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await onSave({ ...fields, supplierName: supplier.name, purchaseOrder: transaction.purchaseOrder, salesInvoice: transaction.salesInvoice, chequeNumber: fields.chequeNumber.trim(), bankName: fields.bankName.trim(), amountApplied });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog className="record-dialog voucher-dialog" ref={dialogRef} onClose={onClose}>
      <div className="record-dialog__header">
        <div><p>{voucher ? "Edit voucher cheque" : "New voucher cheque"}</p><h2>Voucher #{displayedVoucherNumber}</h2></div>
        <button type="button" onClick={onClose} aria-label="Close voucher form">×</button>
      </div>
      <form className="record-form" onSubmit={submit}>
        <label>Voucher Number<input value={displayedVoucherNumber} readOnly aria-readonly="true" /></label>
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
        <label className="voucher-tax-toggle record-form__wide">
          <input type="checkbox" name="applyWithholdingTax" checked={Boolean(fields.applyWithholdingTax)} onChange={updateField} />
          Apply 1% withholding tax
        </label>
        <label>Withholding Tax (1%)<input value={withholdingTaxAmount.toFixed(2)} readOnly aria-readonly="true" /></label>
        <label>Bank Used<input name="bankName" value={fields.bankName || ""} onChange={updateField} placeholder="Example: BPI" required /></label>
        <label>Net Cheque Amount<input value={netChequeAmount.toFixed(2)} readOnly aria-readonly="true" /></label>
        <label>Status
          <select name="status" value={fields.status || "Draft"} onChange={updateField}>
            <option>Draft</option>
            <option>Issued</option>
            {voucher && <option>Cancelled</option>}
          </select>
        </label>
        <label className="record-form__wide">Particulars<textarea name="particulars" value={fields.particulars || ""} onChange={updateField} rows="3" /></label>
        <p className="record-form__message record-form__wide" role="alert">{message}</p>
        <div className="record-form__actions record-form__wide"><button className="secondary-action" type="button" onClick={onClose}>Cancel</button><button className="primary-action" type="submit" disabled={saving}>{saving ? "Saving…" : voucher ? "Save Changes" : "Save Voucher"}</button></div>
      </form>
    </dialog>
  );
}

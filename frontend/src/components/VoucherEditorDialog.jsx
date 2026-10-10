import { useEffect, useMemo, useRef, useState } from "react";

const currentDate = () => new Date().toISOString().slice(0, 10);
const formatVoucherAmount = (value) => new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(Number(value || 0));

export default function VoucherEditorDialog({ isOpen, voucherNumber = "", voucher = null, suppliers, onSave, onClose }) {
  const dialogRef = useRef(null);
  const [fields, setFields] = useState({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const supplier = suppliers.find((item) => String(item.id) === String(fields.supplierId));
  const availableTransactions = useMemo(
    () => supplier?.transactions.filter((item) => !item.deletedAt && (
      Number(item.balance) > 0 || (voucher?.transactionIds || [voucher?.transactionId]).map(String).includes(String(item.id))
    )) || [],
    [supplier, voucher]
  );
  const selectedTransactions = availableTransactions.filter((item) =>
    (fields.transactionIds || []).map(String).includes(String(item.id))
  );
  const grossAmount = voucher
    ? Number(voucher.amountApplied || 0)
    : selectedTransactions.reduce((sum, item) => sum + Number(item.balance || 0), 0);
  const withholdingTaxAmount = fields.applyWithholdingTax
    ? Math.round((grossAmount / 1.12) * 0.01 * 100) / 100
    : 0;
  const netChequeAmount = Math.max(grossAmount - withholdingTaxAmount, 0);
  const displayedVoucherNumber = String(fields.voucherNumber || voucherNumber || "").trim();

  useEffect(() => {
    if (!isOpen) return;
    setFields(voucher ? {
      ...voucher,
      voucherNumber: voucher.voucherNumber || "",
      supplierId: String(voucher.supplierId || ""),
      transactionIds: (voucher.transactionIds || [voucher.transactionId]).filter(Boolean).map(String),
      voucherDate: String(voucher.voucherDate || "").slice(0, 10),
      paymentDate: voucher.paymentDate === "—" ? "" : String(voucher.paymentDate || "").slice(0, 10),
      chequeDate: voucher.chequeDate === "—" ? "" : String(voucher.chequeDate || "").slice(0, 10),
      amountApplied: String(voucher.amountApplied || ""),
      applyWithholdingTax: Number(voucher.withholdingTaxRate || 0) === 0.01,
      bankName: voucher.bankName || ""
    } : { voucherNumber, supplierId: "", transactionIds: [], voucherDate: currentDate(), paymentDate: currentDate(), chequeNumber: "", chequeDate: currentDate(), particulars: "", applyWithholdingTax: false, bankName: "", status: "Draft" });
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
      if (name === "supplierId") return { ...current, supplierId: value, transactionIds: [] };
      if (name === "bankName") return { ...current, bankName: value.toUpperCase() };
      return { ...current, [name]: type === "checkbox" ? checked : value };
    });
  }

  function toggleTransaction(transactionId) {
    setFields((current) => {
      const selected = new Set((current.transactionIds || []).map(String));
      if (selected.has(String(transactionId))) selected.delete(String(transactionId));
      else selected.add(String(transactionId));
      return { ...current, transactionIds: [...selected] };
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (voucher) {
      if (!fields.voucherDate || !fields.paymentDate || !fields.chequeDate
        || !fields.status || fields.status === "Deleted") {
        setMessage("Voucher date, payment date, cheque date, and a valid status are required.");
        return;
      }
      setSaving(true);
      setMessage("");
      try {
        await onSave({
          voucherDate: fields.voucherDate,
          paymentDate: fields.paymentDate,
          chequeDate: fields.chequeDate,
          status: fields.status
        });
      } catch (error) {
        setMessage(error.message);
      } finally {
        setSaving(false);
      }
      return;
    }
    const amountApplied = grossAmount;
    if (!voucher && !displayedVoucherNumber) {
      setMessage("The next voucher number has not loaded. Close this form and try again.");
      return;
    }
    if (!supplier || !selectedTransactions.length || !fields.chequeNumber.trim() || !fields.bankName?.trim() || amountApplied <= 0) {
      setMessage("Supplier, at least one transaction, cheque number, bank used, and a valid amount are required.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await onSave({
        ...fields,
        transactionIds: selectedTransactions.map((item) => String(item.id)),
        supplierName: supplier.name,
        chequeNumber: fields.chequeNumber.trim(),
        bankName: fields.bankName.trim(),
        amountApplied
      });
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
        {voucher && <p className="record-form__message record-form__wide">Voucher date, payment date, cheque date, and status can be edited after creation.</p>}
        <label>Voucher Number<input value={displayedVoucherNumber} readOnly aria-readonly="true" /></label>
        <label>Supplier
          <select name="supplierId" value={fields.supplierId || ""} onChange={updateField} disabled={Boolean(voucher)} required>
            <option value="">Select supplier</option>
            {suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <fieldset className="voucher-transaction-picker record-form__wide" disabled={!supplier || Boolean(voucher)}>
          <legend>{voucher ? "Linked payable transactions" : "Payable transactions (select one or more)"}</legend>
          {availableTransactions.length ? availableTransactions.map((item) => (
            <label key={item.id} className="voucher-transaction-option">
              <input type="checkbox" checked={(fields.transactionIds || []).map(String).includes(String(item.id))} onChange={() => toggleTransaction(item.id)} />
              <span><strong>S.I. {item.salesInvoice} / P.O. {item.purchaseOrder}</strong><small>{formatVoucherAmount(voucher ? (voucher.transactions?.find((linked) => String(linked.id) === String(item.id))?.amountApplied || 0) : item.balance)}</small></span>
            </label>
          )) : <p className="voucher-transaction-empty">{supplier ? "No unpaid transactions are available." : "Select a supplier first."}</p>}
        </fieldset>
        <label>Voucher Date<input type="date" name="voucherDate" value={fields.voucherDate || ""} onChange={updateField} required /></label>
        <label>Payment Date<input type="date" name="paymentDate" value={fields.paymentDate || ""} onChange={updateField} required /></label>
        <label>Cheque Number<input name="chequeNumber" value={fields.chequeNumber || ""} onChange={updateField} disabled={Boolean(voucher)} required /></label>
        <label>Cheque Date<input type="date" name="chequeDate" value={fields.chequeDate || ""} onChange={updateField} required /></label>
        <label>Combined Full Payment Amount<input value={formatVoucherAmount(grossAmount)} readOnly aria-readonly="true" required /></label>
        <label className="voucher-tax-toggle record-form__wide">
          <input type="checkbox" name="applyWithholdingTax" checked={Boolean(fields.applyWithholdingTax)} onChange={updateField} disabled={Boolean(voucher)} />
          Apply 1% withholding tax
        </label>
        <label>Withholding Tax (1%)<input value={formatVoucherAmount(withholdingTaxAmount)} readOnly aria-readonly="true" /></label>
        <label>Bank Used<input name="bankName" value={fields.bankName || ""} onChange={updateField} disabled={Boolean(voucher)} placeholder="Example: BPI" required /></label>
        <label>Net Cheque Amount<input value={formatVoucherAmount(netChequeAmount)} readOnly aria-readonly="true" /></label>
        <label>Status
          <select name="status" value={fields.status || "Draft"} onChange={updateField} disabled={Boolean(voucher?.status === "Deleted")}>
            <option>Draft</option>
            <option>Issued</option>
            <option>Cancelled</option>
          </select>
        </label>
        <label className="record-form__wide">Particulars<textarea name="particulars" value={fields.particulars || ""} onChange={updateField} disabled={Boolean(voucher)} rows="3" /></label>
        <p className="record-form__message record-form__wide" role="alert">{message}</p>
        <div className="record-form__actions record-form__wide"><button className="secondary-action" type="button" onClick={onClose}>Cancel</button><button className="primary-action" type="submit" disabled={saving}>{saving ? "Saving…" : voucher ? "Save Changes" : "Save Voucher"}</button></div>
      </form>
    </dialog>
  );
}

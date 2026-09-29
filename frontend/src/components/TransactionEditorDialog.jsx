import { useEffect, useRef, useState } from "react";

function createInitialFields(type, transaction) {
  if (transaction) {
    return {
      ...transaction,
      amount: String(transaction.amount ?? ""),
      balance: String(transaction.balance ?? ""),
      voucherDate: transaction.voucherDate === "—" ? "" : transaction.voucherDate || "",
      paymentDate: transaction.paymentDate === "—" ? "" : transaction.paymentDate || "",
      chequeDate: transaction.chequeDate === "—" ? "" : transaction.chequeDate || "",
      tinNumber: transaction.tinNumber === "—" ? "" : transaction.tinNumber || ""
    };
  }

  return type === "supplier"
    ? {
        purchaseOrder: "",
        salesInvoice: "",
        tinNumber: "",
        amount: "",
        attachmentName: ""
      }
    : {
        purchaseOrder: "",
        salesInvoice: "",
        collectionReceipt: "",
        tinNumber: "",
        date: new Date().toISOString().slice(0, 10),
        paymentDate: "",
        amount: "",
        balance: "",
        attachmentName: ""
      };
}

function normalizeAmountInput(value) {
  const cleaned = String(value || "").replaceAll(",", "").replace(/[^\d.]/g, "");
  if (!cleaned) return "";
  const decimalIndex = cleaned.indexOf(".");
  const wholeSource = decimalIndex >= 0 ? cleaned.slice(0, decimalIndex) : cleaned;
  const fractionSource = decimalIndex >= 0
    ? cleaned.slice(decimalIndex + 1).replaceAll(".", "").slice(0, 2)
    : "";
  const whole = wholeSource.replace(/^0+(?=\d)/, "") || "0";
  return decimalIndex >= 0 ? `${whole}.${fractionSource}` : whole;
}

function formatAmountInput(value) {
  if (value === "" || value === null || value === undefined) return "";
  const [wholeSource = "0", fractionSource = ""] = String(value).split(".");
  const whole = (wholeSource || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${whole}.${fractionSource.slice(0, 2).padEnd(2, "0")}`;
}

function restoreAmountCaret(input, beforeCaret) {
  const formatted = input.value;
  const decimalIndex = formatted.indexOf(".");
  const sourceDecimalIndex = beforeCaret.indexOf(".");
  let position = 0;

  if (sourceDecimalIndex >= 0) {
    const fractionDigits = beforeCaret.slice(sourceDecimalIndex + 1).replace(/\D/g, "").length;
    position = decimalIndex + 1 + Math.min(fractionDigits, 2);
  } else {
    const wholeDigits = beforeCaret.replace(/\D/g, "").length;
    let seen = 0;
    position = 0;
    while (position < decimalIndex && seen < wholeDigits) {
      if (/\d/.test(formatted[position])) seen += 1;
      position += 1;
    }
  }

  input.setSelectionRange(position, position);
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
  const amountInputRef = useRef(null);
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

  function updateAmount(event) {
    const input = event.target;
    const beforeCaret = input.value.slice(0, input.selectionStart ?? input.value.length);
    const amount = normalizeAmountInput(input.value);
    setFields((current) => ({ ...current, amount }));
    window.requestAnimationFrame(() => {
      if (amountInputRef.current) restoreAmountCaret(amountInputRef.current, beforeCaret);
    });
  }

  function handleAmountKeyDown(event) {
    if (event.key !== "." || !event.currentTarget.value.includes(".")) return;
    event.preventDefault();
    const decimalIndex = event.currentTarget.value.indexOf(".");
    event.currentTarget.setSelectionRange(decimalIndex + 1, decimalIndex + 1);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const amount = Number(fields.amount);
    const balance = transaction?.balance ?? amount;

    if (!fields.purchaseOrder.trim() || !fields.salesInvoice.trim() || !fields.tinNumber?.trim() || amount <= 0) {
      setMessage("P.O. number, S.I. number, TIN number, and a valid amount are required.");
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
        tinNumber: fields.tinNumber.trim(),
        collectionReceipt: isSupplier ? undefined : fields.collectionReceipt?.trim() || "—",
        paymentDate: fields.paymentDate || (isSupplier ? "" : "—"),
        amount: amount.toFixed(2),
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
            <span className="currency-amount-input">
              <span className="currency-amount-input__prefix" aria-hidden="true">₱</span>
              <input
                ref={amountInputRef}
                type="text"
                inputMode="decimal"
                name="amount"
                value={formatAmountInput(fields.amount)}
                onChange={updateAmount}
                onKeyDown={handleAmountKeyDown}
                placeholder="0.00"
                aria-label="Transaction amount in Philippine pesos"
                required
              />
            </span>
          </label>

          <label>
            TIN Number
            <input name="tinNumber" maxLength="40" value={fields.tinNumber || ""} onChange={updateField} required />
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

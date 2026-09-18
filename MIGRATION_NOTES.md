# React migration notes

The frontend was migrated from separate HTML, CSS, and vanilla JavaScript pages to one React application powered by Vite.

## Current frontend

- `frontend/index.html` is the only HTML entry point.
- `frontend/src/main.jsx` starts React and imports the shared styles.
- `frontend/src/App.jsx` owns page navigation and the shared local record state.
- `frontend/src/pages` contains login, dashboard, client, supplier, payable, receivable, and voucher pages.
- `frontend/src/components` contains reusable cards, headers, charts, tables, and record dialogs.
- `frontend/src/hooks/usePersistentState.js` saves the current prototype data to browser `localStorage`.
- `frontend/src/services` contains the prepared future API calls.
- `frontend/public/illuminux-logo.png` is served at `/illuminux-logo.png`.

The previous standalone files such as `dashboard.html`, `style.css`, and `frontend/js/*.js` are no longer part of the React application and should not be restored.

## Record relationships in the local prototype

- Supplier transactions are the source for Payables and Total Purchase.
- Client transactions are the source for Receivables and Total Sales.
- A voucher cheque links to one supplier transaction through its transaction ID and voucher number.
- Saving a draft voucher reserves the payable transaction.
- Issuing that voucher reduces its balance to zero and changes its billing status to Paid.
- Cancelling the voucher restores the payable balance.
- Monthly expense analytics combines payable purchases and outside-service expense data.

## Package-file locations

- The root `package.json` contains convenience commands and automatically installs frontend dependencies.
- `frontend/package.json` contains React and Vite dependencies.
- The filename `packcage.json` is a typo and must not be used.
- Vite's `index.html`, `vite.config.js`, and `.env.example` belong inside `frontend`.

## Local-only limitations

Records currently exist only in the browser where they were entered. Clearing site data removes them, and they are not shared with another computer. File inputs retain the filename only; the file itself is not uploaded or stored.

## Backend connection later

When the backend is ready, copy `frontend/.env.example` to `frontend/.env` and set:

```env
VITE_USE_DEMO_DATA=false
```

The prepared calls are `POST /api/auth/login` and `GET /api/dashboard?year=YYYY`. Supplier, client, payable, receivable, voucher, activity, and document endpoints still need to be designed and implemented.

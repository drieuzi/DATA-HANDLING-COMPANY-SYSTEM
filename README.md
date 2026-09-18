# Data Handling Company System

Illuminux General Merch Company's local transaction-management frontend for clients, suppliers, receivables, payables, voucher cheques, balances, and monthly expense analytics.

## Technology

- React 19
- Vite 8
- CSS
- Browser `localStorage` for the current frontend-only records
- Node.js/Express and PostgreSQL folders reserved for later backend development

## Required software

Vite 8 requires Node.js 20.19+ or 22.12+. Confirm your installation with:

```bash
node --version
npm --version
```

## Run from the repository root

Open Git Bash or the VS Code terminal in `DATA HANDLING SYSTEM`, where this README and the root `package.json` are located. Run:

```bash
npm install
npm run dev
```

The root installation automatically installs the dependencies inside `frontend`. Open the Vite address displayed in the terminal, normally `http://localhost:5173/`.

You can also work directly from the frontend folder:

```bash
cd frontend
npm install
npm run dev
```

## Production check

From the repository root:

```bash
npm run build
npm run preview
```

## Project structure

```text
DATA HANDLING SYSTEM/
├── package.json                 Root commands
├── README.md
├── MIGRATION_NOTES.md
├── frontend/
│   ├── package.json             React/Vite dependencies
│   ├── index.html               Vite HTML entry
│   ├── vite.config.js
│   ├── public/
│   │   └── illuminux-logo.png
│   └── src/
│       ├── components/          Reusable UI and form dialogs
│       ├── data/                Initial demonstration records
│       ├── hooks/               Browser-persistence hook
│       ├── pages/               Login, dashboard, record pages
│       ├── services/            Prepared API clients
│       ├── styles/              Page and component CSS
│       ├── utils/               Calculations and record helpers
│       ├── App.jsx              Navigation and shared record state
│       └── main.jsx             React entry point
├── backend/                     Reserved for the future API
└── database/                    Reserved for the future SQL schema
```

Do not place `index.html`, `vite.config.js`, or the React dependency `package.json` beside the root README. Those files belong inside `frontend`. The file must be named `package.json`, not `packcage.json`.

## Current local behavior

- Supplier and client transactions can be added and edited.
- Clients Track Records contains Receivables and Client Names and Records tabs.
- Suppliers Track Records contains Payables and Supplier Names and Records tabs.
- Supplier and Payables tables omit payment-date and cheque-date columns.
- Monthly Total Sales includes the exact payment date for each client transaction.
- Voucher listings omit cheque-number and cheque-date columns.
- Payables and receivables use the same records as their corresponding company pages.
- Voucher numbers are generated in series.
- A draft voucher reserves its payable transaction.
- Issuing a voucher marks the linked payable as paid.
- Cancelling an issued voucher restores its payable balance.
- Dashboard totals are calculated from locally stored transactions.
- The Total Sales dashboard card opens a monthly report generated from client transactions.
- Search and status filters are available on financial record pages.
- Activity history and entered data persist in the same browser through `localStorage`.

Selected hardcopy files are not uploaded yet. The local prototype stores only the selected filename. Real document storage, user accounts, and multi-computer synchronization require the future backend and database.

## Future API configuration

Copy `frontend/.env.example` to `frontend/.env` when the Express backend is implemented:

```env
VITE_API_BASE_URL=/api
VITE_USE_DEMO_DATA=false
```

The prepared frontend endpoints are:

- `POST /api/auth/login`
- `GET /api/dashboard?year=YYYY`

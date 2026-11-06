# Deployment Guide: All-in-One on Render + Neon

Deploy the entire **Illuminux Company Management System** (Frontend + Backend) as a **single Web Service on Render**, connected to **Neon PostgreSQL**.

---

## Why this setup is the best
- **1 Service on Render**: Both the React frontend and Node.js backend run together on a single free Render Web Service.
- **Zero CORS issues**: Frontend and Backend share the exact same domain (`https://your-app.onrender.com`).
- **Never-expiring Database**: Neon provides a free, perpetual cloud PostgreSQL database that will not expire after 30 days.
- **Simple setup**: You only deploy once!

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│             Render Web Service                         │
│         https://your-app.onrender.com                  │
│                                                        │
│  • GET /              ──▶ Serves React/Vite Frontend   │
│  • GET/POST /api/*    ──▶ Express API Backend          │
└───────────────────────────┬────────────────────────────┘
                            │
                            │ SSL Connection
                            ▼
┌────────────────────────────────────────────────────────┐
│                    Neon PostgreSQL                     │
│  ep-super-credit-be2h99ho-pooler.c-9.us-east-2.aws... │
└────────────────────────────────────────────────────────┘
```

---

## Step 1: Initialize Database & Create Admin Account

Since you already have your Neon connection string in `backend/.env`, initialize the database tables and create your first Admin user directly from your local terminal:

1. Open your terminal in the project root (`DATA HANDLING SYSTEM`).
2. Run database initialization:
   ```bash
   npm run db:init
   ```
   *Expected output: `Database schema initialized successfully.`*

3. Create the initial administrator account:
   ```bash
   npm run create-admin -- admin "YourPassword123!" "System Administrator"
   ```
   *Expected output: `Admin account ready: admin (System Administrator)`*

---

## Step 2: Push Your Code to GitHub

Make sure all changes are committed and pushed to your repository:

```bash
git add .
git commit -m "Configure fullstack deployment for Render and Neon"
git push origin main
```

---

## Step 3: Deploy to Render

1. Go to [dashboard.render.com](https://dashboard.render.com).
2. Click **New +** → **Web Service**.
3. Select your repository: `DATA-HANDLING-COMPANY-SYSTEM` (or connect your GitHub account if needed).
4. Fill in the settings:
   - **Name**: `illuminux-system` (or any name you prefer)
   - **Region**: Choose a region near your Neon database (e.g. `Ohio (US East)` or `Singapore`)
   - **Branch**: `main`
   - **Root Directory**: *(Leave blank / empty - it will use root)*
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`

5. Under **Environment Variables**, add:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | *(Paste your Neon connection string from `backend/.env`)* |
| `DATABASE_SSL` | `true` |
| `JWT_SECRET` | *(Generate a random 32+ character string, e.g. using `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)* |
| `JWT_EXPIRES_IN` | `8h` |

6. Click **Create Web Service**.

---

## Step 4: Open Your System!

1. Render will spend ~2–3 minutes running `npm install`, building the React frontend, and starting the Express server.
2. Once the status shows **Live**, click your public URL (e.g., `https://illuminux-system.onrender.com`).
3. You will see the login page! Log in with:
   - **Username**: `admin`
   - **Password**: `YourPassword123!` (the password you created in Step 1)
4. Your complete company system is now live online!

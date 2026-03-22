# Nutrigrid

Full-stack hackathon prototype for the Fuel the Future challenge. Nutrigrid is an offline-first nutrition system that connects community health workers, supply visibility, and pilot request workflows.

## Features
- Multi-page public site (Problem, Solution, Impact, Pilot)
- Pilot request form with backend storage
- Admin dashboard with login
- Role-based access (admin, reviewer)
- Admin user management (create/disable users)
- CSV export (filter by status/date)
- Email notifications on new pilot requests

## Tech Stack
- Vercel serverless functions
- Postgres (Vercel Postgres / `pg`)
- JWT auth via HttpOnly cookies
- Vanilla HTML/CSS/JS frontend

## Vercel Deployment
This project is configured for Vercel serverless functions + Postgres.

### 1) Provision Postgres
Create a Vercel Postgres database and copy the `POSTGRES_URL` connection string.

### 2) Set Environment Variables (Vercel Project Settings)
- `POSTGRES_URL`
- `SESSION_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `REVIEWER_EMAIL` (optional)
- `REVIEWER_PASSWORD` (optional)

Optional email notifications:
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`
- `SMTP_USER`, `SMTP_PASS`
- `NOTIFY_EMAIL`
- `MAIL_FROM`

### 3) Deploy
Push to GitHub and import into Vercel, or run:
```bash
vercel
```

## Local Development (Vercel CLI)
```bash
npm install
npm run dev
```

Open:
- Public site: `http://localhost:3000`
- Admin dashboard: `http://localhost:3000/admin`

## Default Admin Login
If you set `ADMIN_EMAIL` and `ADMIN_PASSWORD`, a default admin is created automatically.

Override defaults with environment variables:
```powershell
$env:ADMIN_EMAIL="admin@your.org"
$env:ADMIN_PASSWORD="StrongPassword1!"
$env:SESSION_SECRET="long-random-string"
```

## Reviewer Accounts
Create reviewers in the admin dashboard, or seed via env vars:
```powershell
$env:REVIEWER_EMAIL="reviewer@your.org"
$env:REVIEWER_PASSWORD="ReviewerPassword1!"
```

## Email Notifications
Configure SMTP to send notifications when a pilot request is submitted.

```powershell
$env:SMTP_HOST="smtp.yourprovider.com"
$env:SMTP_PORT="587"
$env:SMTP_SECURE="false"
$env:SMTP_USER="smtp-user"
$env:SMTP_PASS="smtp-pass"
$env:NOTIFY_EMAIL="ops@your.org"
$env:MAIL_FROM="Nutrigrid <no-reply@your.org>"
```

If SMTP is not configured, the app continues without sending emails.

## CSV Export
Admins can export pilot requests with filters:
```
/api/admin/requests.csv?status=new&start=2026-03-01&end=2026-03-31
```

Filters also apply in the admin dashboard request list.

## Data Storage
- Postgres tables: `pilot_requests`, `users`

## Project Structure
```
public/
  index.html
  problem.html
  solution.html
  impact.html
  pilot.html
  admin.html
  styles.css
  app.js
  admin.js
api/
  request-pilot.js
  login.js
  logout.js
  me.js
  admin/
    requests.js
    requests.csv.js
    requests/[id].js
    users.js
    users/[id].js
  _db.js
  _auth.js
  _email.js
package.json
vercel.json
```

## Security Notes
- This is a hackathon prototype. For production, add:
  - HTTPS
  - Stronger session secrets
  - Password reset / MFA
  - Input validation + rate limiting

## License
MIT (or replace with your preferred license).

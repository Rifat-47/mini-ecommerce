# Mini E-Commerce Backend

A RESTful e-commerce backend built with **Django REST Framework** and **PostgreSQL**. Features JWT authentication, role-based access control, product catalog, cart, wishlist, order management, ShurjoPay payment integration (bKash, Nagad, Rocket), address book, coupons, 2FA, and automated email notifications.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Python / Django 6.0+ + Django REST Framework |
| Database | PostgreSQL (local) / Neon (staging/production) |
| Auth | SimpleJWT (access: 1 day, refresh: 30 days) |
| 2FA | pyotp (TOTP) + qrcode[pil] |
| Payments | ShurjoPay (bKash, Nagad, Rocket) |
| PDF | reportlab |
| Email | Mailjet (production) / Resend (fallback) / Gmail SMTP (local dev) |
| Background tasks | cron-job.org HTTP endpoints |
| Environment | python-dotenv |

---

## Getting Started

### Prerequisites

- Python 3.10+
- PostgreSQL running locally
- Git

---

### 1. Clone the Repository

```bash
git clone <repository-url>
cd mini_ecommerce_backend
```

---

### 2. Create & Activate Virtual Environment

**Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**Mac / Linux:**
```bash
python -m venv venv
source venv/bin/activate
```

---

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

---

### 4. Database Setup

Make sure PostgreSQL is installed and running. Then create the database:

```sql
CREATE DATABASE ecommerce_db;
```

---

### 5. Environment Configuration

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```env
# Django
SECRET_KEY=your-secret-key-here

# Database (local PostgreSQL)
DB_NAME=ecommerce_db
DB_USER=postgres
DB_PASSWORD=your-postgres-password
DB_HOST=localhost
DB_PORT=5432

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5173

# Email — local dev uses Gmail SMTP (leave MAILJET/RESEND keys blank)
EMAIL_HOST_USER=your-gmail@gmail.com
EMAIL_HOST_PASSWORD=your-gmail-app-password

# Mailjet (production — takes priority over Resend and Gmail SMTP when set)
MAILJET_API_KEY=
MAILJET_SECRET_KEY=
MAILJET_FROM_EMAIL=

# Resend (fallback when Mailjet keys are blank)
RESEND_API_KEY=
RESEND_FROM_EMAIL=onboarding@resend.dev

# ShurjoPay (sandbox)
SHURJOPAY_BASE_URL=https://sandbox.shurjopayment.com
SHURJOPAY_USERNAME=sp_sandbox
SHURJOPAY_PASSWORD=pyyk97hu&6u6
SHURJOPAY_PREFIX=SP
SHURJOPAY_RETURN_URL=http://localhost:8000/api/payments/callback/
SHURJOPAY_CANCEL_URL=http://localhost:8000/api/payments/callback/

# Frontend base URL (for post-payment redirects and password reset links)
FRONTEND_URL=http://localhost:5173

# Returns — days after delivery within which a return can be requested
RETURN_WINDOW_DAYS=7

# Cron — secret token for /api/internal/cron/* endpoints (used by cron-job.org)
# Generate: python -c "import secrets; print(secrets.token_urlsafe(40))"
CRON_SECRET=your-cron-secret-here
```

> **`EMAIL_HOST_PASSWORD`** must be a **Gmail App Password**, not your regular password.
> To generate: Google Account → Security → 2-Step Verification → App Passwords.

> **Mailjet** — For production email, create a free account at [mailjet.com](https://www.mailjet.com), get your API keys from **Account → API Keys**, and verify a sender address under **Senders & Domains**. See [Third-Party Service Setup → Mailjet](#mailjet-email) for full steps.

> **ShurjoPay** — The sandbox credentials above are ShurjoPay's official public test credentials and work out of the box locally. For production, register at [shurjopayment.com](https://shurjopayment.com) to get real merchant credentials. See [Third-Party Service Setup → ShurjoPay](#shurjopay-payments) for full steps.

> **cron-job.org** — `CRON_SECRET` is a secret token you generate yourself. After deploying, set up two jobs on [cron-job.org](https://cron-job.org) to call the birthday and low-stock endpoints. See [Scheduled Background Tasks](#scheduled-background-tasks) for full steps.

> **Email priority:** If `MAILJET_API_KEY` is set, Mailjet is used. If not, falls back to Resend. If neither is set, falls back to Gmail SMTP.

---

### 6. Run Migrations

```bash
python manage.py migrate
```

---

### 7. Create a Superadmin

```bash
python manage.py createsuperuser
```

> After creation, log into the Django admin at `http://localhost:8000/django-admin/` and open **Config → Site Settings** to set your store name, from-email, and other defaults.

---

### 8. Run the Development Server

```bash
python manage.py runserver
```

API available at: `http://localhost:8000/api`

---

## Email

The app sends emails for the following events:

| Event | Recipient |
|-------|-----------|
| Order placed | Customer (order confirmation) |
| Order status → In-Progress | Customer |
| Order status → Delivered | Customer |
| Order cancelled | Customer |
| Payment confirmed / failed | Customer |
| Forgot password | Customer (reset link, expires 24h) |
| Birthday (daily cron) | Customer (birthday wish + coupon) |
| Low stock (daily cron) | All superadmins |

To use console output during development instead of sending real emails, add to `settings.py`:

```python
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
```

---

## Scheduled Background Tasks

Tasks run via **[cron-job.org](https://cron-job.org)** — it sends HTTP POST requests to secured backend endpoints. No separate worker process is needed.

### Setup on cron-job.org

1. Create a free account at [cron-job.org](https://cron-job.org)
2. Create two cron jobs with the settings below:

| Title | URL | Method | Schedule |
|-------|-----|--------|----------|
| Birthday Emails | `https://<your-backend>/api/internal/cron/birthday-emails/` | POST | `5 0 * * *` (12:05 AM daily) |
| Low Stock Alerts | `https://<your-backend>/api/internal/cron/low-stock-alerts/` | POST | `0 12 * * *` (12:00 PM daily) |

3. For each job, add a request header:
   - **Key:** `Authorization`
   - **Value:** `Bearer <your CRON_SECRET value>`

4. Generate a secure `CRON_SECRET`:
```bash
python -c "import secrets; print(secrets.token_urlsafe(40))"
```

To trigger manually without cron-job.org:
```bash
python manage.py send_birthday_emails
python manage.py send_low_stock_alerts
```

---

## User Roles

| Role | Access |
|------|--------|
| `superadmin` | Full access — catalog, orders, users, coupons, audit log, admin management, site settings |
| `admin` | Manage catalog, orders, users, coupons |
| `customer` | Browse products, cart, wishlist, orders, profile |

---

## API Overview

Base URL: `http://localhost:8000/api`

Pass the access token in the `Authorization` header for authenticated endpoints:
```
Authorization: Bearer <your_access_token>
```

**Validation rules:** All endpoints enforce the following field-level constraints (violations return HTTP 400):

| Field | Min length | Max length | Applies to |
|-------|-----------|-----------|------------|
| `password` | 8 | — | Register, profile update, reset password |
| `first_name` | — | 150 | Register, profile update, user/admin create |
| `last_name` | — | 150 | Register, profile update, user/admin create |
| `name` (category/product) | 2 | 100 | Category/product create/update |
| `description` (category/product) | — | 2000 | Category/product create/update |
| `full_name` | 2 | 255 | Address create/update |
| `phone` | 7 | 20 | Address create/update |
| `address_line_1` | 5 | 255 | Address create/update |
| `address_line_2` | — | 255 | Address create/update |
| `city` | 2 | 100 | Address create/update |
| `state` | 2 | 100 | Address create/update |
| `postal_code` | 3 | 20 | Address create/update |
| `country` | 2 | 100 | Address create/update |
| `label` | — | 50 | Address create/update |
| `comment` | — | 1000 | Product review |
| `reason` | 10 | 1000 | Return request |
| `code` (coupon) | 3 | 50 | Coupon create/update |

All list endpoints are **paginated** (default: 20 items/page):
```json
{ "count": 85, "next": "...?page=2", "previous": null, "results": [...] }
```

Access tokens expire after **1 day**. Use `/auth/token/refresh/` to get a new one. Refresh tokens expire after **30 days**.

For full request/response details → [`business docs/api_documentation.md`](business%20docs/api_documentation.md)

---

## Project Structure

```
mini_ecommerce_backend/
├── ecommerce_backend/      # Django project settings, URLs, cron views, email utils
├── users/                  # User model, auth, address book, 2FA, GDPR, audit log
├── catalog/                # Categories, products, reviews, images, inventory tracking
├── orders/                 # Orders, coupons, returns, refunds, PDF generation
├── cart/                   # Cart and wishlist
├── payments/               # ShurjoPay integration
├── notifications/          # In-app notifications, email logs
├── config/                 # Site settings model and admin
├── business docs/          # API docs, implementation plan, production checklist
├── postman/                # Postman collection
├── manage.py
├── requirements.txt
├── .env.example
└── .env                    # Local environment variables (never commit)
```

---

## Third-Party Service Setup

### Mailjet (Email)

1. Create a free account at [mailjet.com](https://www.mailjet.com)
2. Go to **Account → API Keys** → copy your **API Key** and **Secret Key**
3. Go to **Senders & Domains** → verify a sender email address
4. Set these env vars:
```env
MAILJET_API_KEY=your-api-key
MAILJET_SECRET_KEY=your-secret-key
MAILJET_FROM_EMAIL=your-verified-sender@example.com
```

### ShurjoPay (Payments)

ShurjoPay supports **bKash**, **Nagad**, and **Rocket** in Bangladesh.

**Sandbox (development):**
```env
SHURJOPAY_BASE_URL=https://sandbox.shurjopayment.com
SHURJOPAY_USERNAME=sp_sandbox
SHURJOPAY_PASSWORD=pyyk97hu&6u6
SHURJOPAY_PREFIX=SP
```

**Production:**
1. Register at [shurjopayment.com](https://shurjopayment.com) to get merchant credentials
2. Update env vars:
```env
SHURJOPAY_BASE_URL=https://engine.shurjopayment.com
SHURJOPAY_USERNAME=your-merchant-username
SHURJOPAY_PASSWORD=your-merchant-password
```

The callback URL must be publicly accessible — set it to your deployed backend URL:
```env
SHURJOPAY_RETURN_URL=https://<your-backend>/api/payments/callback/
SHURJOPAY_CANCEL_URL=https://<your-backend>/api/payments/callback/
```

---

## Deployment

| Layer | Platform |
|-------|----------|
| Backend | Railway (auto-deploys from `staging` branch) |
| Database | Neon (PostgreSQL) — set `DATABASE_URL` in Railway env vars |
| Frontend | Netlify |
| Cron jobs | cron-job.org |
| Email | Mailjet |

Railway automatically detects `DATABASE_URL` and switches from local PostgreSQL to Neon.

Key production env vars to set on Railway:

```env
DATABASE_URL=<from Neon>
SECRET_KEY=<long random string>
DEBUG=False
ALLOWED_HOSTS=<your-railway-domain>,<your-netlify-domain>
CORS_ALLOWED_ORIGINS=https://<your-netlify-domain>
FRONTEND_URL=https://<your-netlify-domain>
MAILJET_API_KEY=<your key>
MAILJET_SECRET_KEY=<your key>
MAILJET_FROM_EMAIL=<verified sender>
SHURJOPAY_BASE_URL=https://engine.shurjopayment.com
SHURJOPAY_USERNAME=<your merchant username>
SHURJOPAY_PASSWORD=<your merchant password>
SHURJOPAY_RETURN_URL=https://<your-railway-domain>/api/payments/callback/
SHURJOPAY_CANCEL_URL=https://<your-railway-domain>/api/payments/callback/
CRON_SECRET=<long random string>
```

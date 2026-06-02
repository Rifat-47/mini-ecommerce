# Mini E-Commerce

A full-stack e-commerce platform for the Bangladeshi market, featuring product management, cart, wishlist, orders, ShurjoPay payments (bKash, Nagad, Rocket), coupon system, returns/refunds, in-app notifications, admin dashboard, and 2FA.

## Structure

```
mini_ecommerce/
├── mini_ecommerce_frontend/   # React 19 + Vite + Tailwind CSS v4 + shadcn/ui
└── mini_ecommerce_backend/    # Django 6 + Django REST Framework + PostgreSQL
```

## Documentation

| Document | Description |
|---|---|
| [Business Overview](BUSINESS_OVERVIEW.md) | Features, user roles, workflows, store configuration |
| [Technical Overview](TECHNICAL_OVERVIEW.md) | Architecture, API reference, DB schema, deployment |
| [Backend README](mini_ecommerce_backend/README.md) | Backend setup, env vars, email, cron jobs |
| [Frontend README](mini_ecommerce_frontend/README.md) | Frontend setup, state management, auth flow |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, shadcn/ui, Zustand, React Router 7 |
| Backend | Django 6, Django REST Framework, SimpleJWT |
| Database | PostgreSQL |
| Payments | ShurjoPay (bKash, Nagad, Rocket) |
| Auth | JWT + 2FA (TOTP) |
| Email | Mailjet / Resend / Gmail SMTP |
| Media | Cloudinary |

## Quick Start

```bash
# 1. Backend
cd mini_ecommerce_backend
python -m venv venv && venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env        # fill in your values
python manage.py migrate
python manage.py seed_data  # optional: load sample data
python manage.py runserver  # → http://localhost:8000

# 2. Frontend (new terminal)
cd mini_ecommerce_frontend
npm install
cp .env.example .env        # set VITE_API_BASE_URL=http://localhost:8000/api
npm run dev                 # → http://localhost:5173
```

## Test Accounts (after seed_data)

| Email | Password | Role |
|---|---|---|
| `admin@shop.com` | `admin123` | Admin |
| `alice@example.com` | `pass1234` | Customer |
| `bob@example.com` | `pass1234` | Customer |

Coupon code: **`WELCOME10`** — 10% off any order.

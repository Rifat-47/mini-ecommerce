# Technical Overview — Mini E-Commerce Platform

## Architecture

A decoupled full-stack web application:

```
┌─────────────────────────────┐       ┌─────────────────────────────┐
│   React SPA (Frontend)      │  HTTP │  Django REST API (Backend)  │
│   localhost:5173             │◄─────►│  localhost:8000/api         │
│   Vite + Tailwind + Zustand  │  JWT  │  DRF + PostgreSQL            │
└─────────────────────────────┘       └─────────────────────────────┘
```

The frontend is a Single Page Application that communicates exclusively via the REST API. The backend is API-only (no server-rendered HTML except Django admin).

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend framework | React | 19 |
| Frontend build | Vite | latest |
| CSS framework | Tailwind CSS | 4.x |
| UI components | shadcn/ui (Radix UI + Tailwind) | latest |
| State management | Zustand | latest |
| Routing (frontend) | React Router DOM | 7 |
| HTTP client | Axios | latest |
| Icons | Lucide React | latest |
| Toasts | Sonner | latest |
| Theme | next-themes | latest |
| Backend framework | Django | 6.0.4 |
| REST API | Django REST Framework | 3.17.1 |
| Authentication | SimpleJWT | 5.5.1 |
| Database | PostgreSQL | — |
| DB adapter | psycopg2-binary | 2.9.11 |
| Image storage | Cloudinary | 1.42.1 |
| Image processing | Pillow | 12.2.0 |
| Payment gateway | ShurjoPay | (custom client) |
| Email | Mailjet / Resend / Gmail SMTP | — |
| PDF generation | ReportLab | 4.4.10 |
| 2FA | pyotp | 2.9.0 |
| QR codes | qrcode[pil] | 8.2 |
| Environment | python-dotenv | 1.2.2 |
| Static files | WhiteNoise | 6.9.0 |
| CORS | django-cors-headers | 4.9.0 |
| Cloud DB URL | dj-database-url | 3.1.2 |

---

## Repository Structure

```
mini_ecommerce/
├── mini_ecommerce_backend/
│   ├── ecommerce_backend/     # Django project: settings, root URLs, email utils, cron views
│   ├── users/                 # User model, auth, 2FA, addresses, GDPR, audit log
│   ├── catalog/               # Categories, products, images, reviews, stock tracking
│   ├── orders/                # Orders, order items, coupons, returns, PDF generation
│   ├── cart/                  # Cart items, wishlist items
│   ├── payments/              # ShurjoPay integration, payment records
│   ├── notifications/         # In-app notifications, email logs
│   ├── config/                # SiteSettings singleton model
│   ├── postman/               # Postman collection and environment
│   ├── requirements.txt
│   └── .env.example
│
└── mini_ecommerce_frontend/
    ├── src/
    │   ├── api/axios.js        # Axios instance + JWT interceptor + silent refresh
    │   ├── store/              # Zustand stores (auth, cart, wishlist, notifications, settings, theme)
    │   ├── pages/              # Page components (catalog, cart, checkout, orders, auth, admin, etc.)
    │   ├── components/         # Layout wrappers, shared components, shadcn/ui components
    │   ├── router/index.jsx    # React Router config with route guards
    │   └── index.css           # Tailwind + OKLCH design tokens
    ├── index.html
    └── vite.config.js
```

---

## Backend — Django Apps

### `users`
- Custom `User` model extending `AbstractUser`, using email as the username field
- `UserAddress` — multiple addresses per user with default shipping/billing flags
- `AuditLog` — immutable admin action log
- Views: registration, login (with lockout), logout, profile CRUD, avatar, 2FA TOTP setup/confirm/disable, password change/reset, GDPR export/delete, address CRUD, admin user management

### `catalog`
- `Category`, `Product`, `ProductImage`, `Review`, `StockMovement`
- Product images stored on Cloudinary (up to 5 per product, one primary)
- `StockMovement` records every stock change (sale, cancel, return, manual adjust) with an audit trail
- Views: public product listing/detail/search, public category listing, image management, review CRUD (verified buyers only), admin stock adjust, CSV export, bulk update

### `orders`
- `Order`, `OrderItem`, `Coupon`, `ReturnRequest`
- Order creation is transactional: validates stock, applies coupon, deducts stock, clears cart
- Order cancellation restores stock via `Order.cancel()` method
- `ReturnRequest` tracks approval workflow and refund status
- PDF invoice and credit note generated with ReportLab
- Views: order CRUD, cancel, invoice, return request CRUD, admin bulk update, CSV export, admin coupon CRUD, admin return management

### `cart`
- `CartItem` and `WishlistItem`, both with unique (user, product) constraints
- Views: list/add/update/remove/clear cart, list/add/remove wishlist, move-to-cart

### `payments`
- `Payment` model linked 1:1 to `Order`
- ShurjoPay integration: initiate checkout URL, callback handler, verify payment
- COD endpoint marks order for cash-on-delivery
- Views: initiate, callback (no auth — ShurjoPay webhook), verify, status, COD, admin list/update

### `notifications`
- `Notification` per-user with type, title, message, is_read
- `EmailLog` records every email send attempt (status, error if any)
- Views: list, unread count, mark read, mark all read, admin email logs

### `config`
- `SiteSettings` singleton — `SiteSettings.get()` returns the one instance
- Covers store branding, currency, tax, shipping threshold, return window, birthday coupons, payment toggles, security settings
- Views: public settings (GET), admin settings (GET/PATCH)

---

## Database Schema Summary

### Key Relationships

```
User ──< UserAddress
User ──< Order ──< OrderItem >── Product
Order ──  Payment (1:1)
Order ──  ReturnRequest (1:1)
Order >── Coupon
Product >── Category
Product ──< ProductImage
Product ──< Review >── User
Product ──< StockMovement
User ──< CartItem >── Product
User ──< WishlistItem >── Product
User ──< Notification
User ──< AuditLog (as admin)
```

### Notable Model Design Decisions

| Model | Decision |
|---|---|
| `User` | `public_id` (UUID) exposed externally; integer PK stays internal |
| `Order` | `user` is SET_NULL on delete (GDPR — orders remain, user PII removed) |
| `Order` | `public_id` (UUID) used in all customer-facing URLs |
| `Product` | `status` field: active / inactive / coming_soon |
| `SiteSettings` | Singleton via `get_or_create(pk=1)` |
| `Review` | Unique (product, user) — one review per buyer per product |
| `StockMovement` | Append-only audit trail; never updated or deleted |

---

## API Design

**Base URL:** `http://localhost:8000/api`

**Authentication:** JWT Bearer token in `Authorization` header.

**Pagination:** All list endpoints return:
```json
{ "count": 85, "next": "...?page=2", "previous": null, "results": [...] }
```
Default page size: 20.

**Throttling:**

| Scope | Limit |
|---|---|
| Unauthenticated | 100/min |
| Authenticated | 10/min |
| Login | 10/min |
| Register | 5/min |
| Forgot password | 5/min |

### Endpoint Index

#### Auth & Profile
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login/` | ✗ | Login; returns JWT or 2FA challenge |
| POST | `/auth/register/` | ✗ | Register new customer account |
| POST | `/auth/logout/` | ✓ | Logout; blacklists refresh token |
| POST | `/auth/token/refresh/` | ✗ | Rotate access token |
| GET/PATCH | `/auth/profile/` | ✓ | Get or update profile |
| POST/DELETE | `/auth/profile/avatar/` | ✓ | Upload or delete avatar |
| POST | `/auth/forgot-password/` | ✗ | Send password reset email |
| POST | `/auth/reset-password/{uid}/{token}/` | ✗ | Confirm password reset |
| POST | `/auth/update-password/` | ✓ | Change password while logged in |
| GET | `/auth/2fa/status/` | ✓ | Is 2FA enabled? |
| POST | `/auth/2fa/setup/` | ✓ | Generate TOTP QR code |
| POST | `/auth/2fa/verify-setup/` | ✓ | Activate 2FA |
| POST | `/auth/2fa/confirm/` | ✗ | Complete login with TOTP code |
| POST | `/auth/2fa/disable/` | ✓ | Disable 2FA |
| GET | `/profile/export/` | ✓ | GDPR data export |
| DELETE | `/profile/delete/` | ✓ | GDPR account deletion |

#### Address Book
| Method | Path | Auth | Description |
|---|---|---|---|
| GET/POST | `/addresses/` | ✓ | List / create address |
| GET/PATCH/DELETE | `/addresses/{id}/` | ✓ | Get / update / delete address |
| PATCH | `/addresses/{id}/set-default/` | ✓ | Set as default shipping/billing |

#### Catalog
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/products/` | ✗ | List products (search, filter, sort, paginate) |
| GET | `/products/{id}/` | ✗ | Product detail |
| GET | `/products/search/suggestions/` | ✗ | Autocomplete suggestions (`?q=`) |
| GET | `/categories/` | ✗ | List active categories |
| GET | `/products/{pid}/reviews/` | ✗ | List reviews |
| POST | `/products/{pid}/reviews/` | ✓ | Submit review (verified buyer) |
| PATCH/DELETE | `/products/{pid}/reviews/{id}/` | ✓ | Edit / delete own review |
| POST | `/products/` | ✓ Admin | Create product |
| PATCH/DELETE | `/products/{id}/` | ✓ Admin | Update / delete product |
| POST | `/categories/` | ✓ Admin | Create category |
| PATCH/DELETE | `/categories/{id}/` | ✓ Admin | Update / delete category |
| GET/POST | `/products/{pid}/images/` | ✓ Admin | List / upload product images |
| PATCH/DELETE | `/products/{pid}/images/{id}/` | ✓ Admin | Set primary / delete image |
| GET | `/admin/products/{pid}/stock-history/` | ✓ Admin | Stock movement log |
| POST | `/admin/products/{pid}/adjust-stock/` | ✓ Admin | Manual stock adjustment |
| POST | `/admin/products/bulk-update/` | ✓ Admin | Bulk update products |
| GET | `/admin/products/export/` | ✓ Admin | CSV export |

#### Cart & Wishlist
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/cart/` | ✓ | View cart |
| POST | `/cart/` | ✓ | Add to cart |
| PATCH | `/cart/{id}/` | ✓ | Update quantity |
| DELETE | `/cart/{id}/` | ✓ | Remove item |
| DELETE | `/cart/` | ✓ | Clear entire cart |
| GET | `/wishlist/` | ✓ | View wishlist |
| POST | `/wishlist/` | ✓ | Add to wishlist |
| DELETE | `/wishlist/{id}/` | ✓ | Remove from wishlist |
| POST | `/wishlist/{id}/move-to-cart/` | ✓ | Move item to cart |

#### Orders & Coupons
| Method | Path | Auth | Description |
|---|---|---|---|
| GET/POST | `/orders/` | ✓ | List / create orders |
| GET | `/orders/{public_id}/` | ✓ | Order detail |
| POST | `/orders/{public_id}/cancel/` | ✓ | Cancel pending order |
| GET | `/orders/{public_id}/invoice/` | ✓ | Download PDF invoice |
| POST | `/orders/{public_id}/return/` | ✓ | Request return |
| GET | `/orders/{public_id}/credit-note/` | ✓ | Download credit note PDF |
| GET | `/coupons/` | ✓ | List available coupons |
| POST | `/coupons/validate/` | ✓ | Validate coupon (`code` + `cart_total`) |
| GET/POST | `/admin/coupons/` | ✓ Admin | List / create coupons |
| GET/PATCH/DELETE | `/admin/coupons/{id}/` | ✓ Admin | Manage coupon |
| GET/PATCH | `/admin/returns/{id}/` | ✓ Admin | View / update return request |
| POST | `/admin/returns/{id}/refund/` | ✓ Admin | Mark refund complete |
| POST | `/admin/orders/bulk-update/` | ✓ Admin | Bulk order status update |
| GET | `/admin/orders/export/` | ✓ Admin | CSV export |

#### Payments
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/payments/initiate/` | ✓ | Start ShurjoPay checkout |
| GET | `/payments/callback/` | ✗ | ShurjoPay payment callback |
| GET | `/payments/verify/{order_id}/` | ✓ | Verify payment status |
| GET | `/payments/order/{order_id}/` | ✓ | Get payment for order |
| POST | `/payments/cod/` | ✓ | Mark order as cash-on-delivery |
| GET | `/admin/payments/` | ✓ Admin | All payments |
| PATCH | `/admin/payments/{id}/` | ✓ Admin | Update payment status |

#### Notifications
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/notifications/` | ✓ | List notifications |
| GET | `/notifications/unread-count/` | ✓ | Unread count |
| PATCH | `/notifications/{id}/read/` | ✓ | Mark single as read |
| POST | `/notifications/mark-all-read/` | ✓ | Mark all as read |
| GET | `/admin/email-logs/` | ✓ SuperAdmin | Email delivery log |

#### Admin — Users & Settings
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/stats/` | ✓ Admin | Dashboard statistics |
| GET/POST | `/admin/users/` | ✓ Admin | List / create users |
| GET/PATCH/DELETE | `/admin/users/{id}/` | ✓ Admin | Manage user |
| GET | `/admin/admins/` | ✓ SuperAdmin | List admin accounts |
| GET | `/admin/audit-log/` | ✓ SuperAdmin | Audit log |
| GET/PATCH | `/admin/settings/` | ✓ Admin | Site settings |
| GET | `/settings/` | ✗ | Public settings |

---

## Frontend Architecture

### State Management (Zustand)

| Store | Persisted | Purpose |
|---|---|---|
| `authStore` | `localStorage` | User object, JWT tokens, login/logout, 2FA confirm |
| `cartStore` | `localStorage` (guest only) | Cart items; guest uses `guest_cart` key; syncs on login |
| `wishlistStore` | `localStorage` (guest only) | Wishlist; same dual-mode as cart |
| `notificationStore` | Memory | Notification list, unread count |
| `settingsStore` | Memory | Site-wide settings fetched from `/settings/` |
| `themeStore` | `localStorage` | dark / light theme preference |

### Axios Interceptor Flow

```
Request → attach Bearer token from localStorage
                    │
Response 401? ─── Is refreshing? ─► queue request
                    │  No
                    ▼
        POST /auth/token/refresh/
                    │
            Success ─► save new tokens, retry queued requests
            Failure ─► clear auth, redirect to /login
```

### Route Guards

| Guard | Behaviour |
|---|---|
| `ProtectedRoute` | Redirects to `/login` if no `accessToken` |
| `AdminRoute` | Redirects to `/login` or `/` if not admin/superadmin |
| `SuperAdminRoute` | Redirects to `/admin` if not superadmin |
| `GuestOnlyRoute` | Redirects to `/` if already authenticated |

### Frontend Routes

```
Public (no auth)
/                          Product listing (search, filter, sort)
/products/:id              Product detail + reviews
/cart                      Shopping cart
/login                     Login (guest only)
/register                  Register (guest only)
/forgot-password           Password reset request
/reset-password/:uid/:token  Password reset confirm
/payment/success|failed|cancelled  Payment result pages

Protected (require login)
/wishlist                  Wishlist management
/checkout                  Checkout with address + payment method
/orders                    Order history
/orders/:id                Order detail + return request
/profile                   Profile, addresses, 2FA, GDPR

Admin (require admin or superadmin)
/admin                     Dashboard with KPIs
/admin/products            Product management
/admin/orders              Order management
/admin/users               User management
/admin/coupons             Coupon management
/admin/returns             Return request management
/admin/payments            Payment records
/admin/categories          Category management
/admin/settings            Site settings

Superadmin only
/admin/audit-log           Admin action log
/admin/email-logs          Email delivery log
/admin/admins              Admin account management
```

---

## Authentication & Security

### JWT Configuration
- **Access token lifetime:** 1 day
- **Refresh token lifetime:** 30 days, rotating (new token issued on every refresh)
- **Blacklist:** Logout endpoint blacklists the refresh token (prevents reuse)

### 2FA Flow
1. Customer enables 2FA: `POST /auth/2fa/setup/` → receives TOTP secret + QR code URL
2. Customer scans QR with authenticator app, confirms: `POST /auth/2fa/verify-setup/`
3. On next login: server returns `{ requires_2fa: true, two_fa_token: "..." }` instead of JWT
4. Customer submits TOTP code: `POST /auth/2fa/confirm/` with `{ two_fa_token, code }` → receives JWT

### Account Lockout
- Configurable `max_login_attempts` (default 5) and `lockout_minutes` (default 15) in `SiteSettings`
- `failed_login_attempts` counter incremented on each failed login; reset on success
- `lockout_until` timestamp set when limit is exceeded; login blocked until it expires

### Password Reset
- Django's built-in token-based reset flow
- Email link valid for 24 hours
- Uses `uidb64` + token in URL: `/reset-password/{uid}/{token}`

---

## Email Architecture

Email provider priority (configured via env vars):

```
MAILJET_API_KEY set? ─► Use Mailjet (recommended for production)
        │ No
        ▼
RESEND_API_KEY set? ─► Use Resend
        │ No
        ▼
Gmail SMTP (local dev — requires App Password)
```

### Transactional Emails Sent
| Trigger | Recipient |
|---|---|
| Order placed | Customer |
| Order → In-Progress | Customer |
| Order → Delivered | Customer |
| Order cancelled | Customer |
| Payment success | Customer |
| Payment failed | Customer |
| Return approved | Customer |
| Return rejected | Customer |
| Refund completed | Customer |
| Password reset | Customer |
| Birthday (daily cron) | Customer |
| Low stock alert (daily cron) | All superadmins |

---

## Background Jobs (Cron)

No worker process required. Jobs are triggered via HTTP POST to secured endpoints by [cron-job.org](https://cron-job.org).

| Job | Endpoint | Schedule | Auth |
|---|---|---|---|
| Birthday emails | `POST /api/internal/cron/birthday-emails/` | `5 0 * * *` (12:05 AM daily) | `Authorization: Bearer <CRON_SECRET>` |
| Low stock alerts | `POST /api/internal/cron/low-stock-alerts/` | `0 12 * * *` (12:00 PM daily) | `Authorization: Bearer <CRON_SECRET>` |

Can also be triggered manually:
```bash
python manage.py send_birthday_emails
python manage.py send_low_stock_alerts
```

---

## Deployment Architecture

| Component | Platform |
|---|---|
| Frontend | Netlify (static build from `dist/`) |
| Backend | Railway (auto-detects `DATABASE_URL`) |
| Database | Neon (managed PostgreSQL) |
| Media storage | Cloudinary |
| Email | Mailjet |
| Cron jobs | cron-job.org |

### Key Production Environment Variables

```env
DATABASE_URL=<Neon connection string>
SECRET_KEY=<long random string>
DEBUG=False
ALLOWED_HOSTS=<railway-domain>,<netlify-domain>
CORS_ALLOWED_ORIGINS=https://<netlify-domain>
FRONTEND_URL=https://<netlify-domain>
MAILJET_API_KEY=...
MAILJET_SECRET_KEY=...
MAILJET_FROM_EMAIL=...
SHURJOPAY_BASE_URL=https://engine.shurjopayment.com
SHURJOPAY_USERNAME=...
SHURJOPAY_PASSWORD=...
SHURJOPAY_RETURN_URL=https://<railway-domain>/api/payments/callback/
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CRON_SECRET=<long random string>
```

---

## Development Setup

### Backend
```bash
cd mini_ecommerce_backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
cp .env.example .env           # fill in values
python manage.py migrate
python manage.py seed_data     # load sample data
python manage.py runserver     # http://localhost:8000
```

### Frontend
```bash
cd mini_ecommerce_frontend
npm install
cp .env.example .env           # set VITE_API_BASE_URL=http://localhost:8000/api
npm run dev                    # http://localhost:5173
```

### Seed Data
`python manage.py seed_data` creates:
- 3 users: `admin@shop.com` / `alice@example.com` / `bob@example.com`
- 3 categories: Electronics, Clothing, Books
- 7 products with placeholder images
- 1 coupon: `WELCOME10` (10% off)
- 3 orders with items, cart entries, and wishlist entries

The command is idempotent — safe to run multiple times.

---

## Field Validation Reference

| Field | Constraint |
|---|---|
| `password` | Min 8 characters |
| `first_name`, `last_name` | Max 150 characters |
| `name` (product/category) | 2–100 characters |
| `description` (product/category) | Max 2000 characters |
| `full_name` (address) | 2–255 characters |
| `phone` | 7–20 characters |
| `address_line_1` | 5–255 characters |
| `city`, `state` | 2–100 characters |
| `postal_code` | 3–20 characters |
| `country` | 2–100 characters |
| `comment` (review) | Max 1000 characters |
| `reason` (return) | 10–1000 characters |
| `code` (coupon) | 3–50 characters |
| `rating` (review) | Integer 1–5 |
| Product images | Max 5 per product |

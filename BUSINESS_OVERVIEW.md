# Business Overview — Mini E-Commerce Platform

## What Is This?

Mini E-Commerce is a full-featured, multi-tenant e-commerce platform built for the Bangladeshi market. It enables store owners to manage an online shop end-to-end — from product listings and inventory to customer orders, payments, and after-sales support — through a modern web interface.

Customers browse products, manage a cart and wishlist, place orders, and track deliveries. Store admins manage the full operations through a dedicated dashboard. Payments are processed via **ShurjoPay**, supporting **bKash**, **Nagad**, and **Rocket** — Bangladesh's dominant mobile financial services.

---

## Who Uses It?

| Role | What They Do |
|---|---|
| **Customer** | Browse products, add to cart/wishlist, place orders, apply coupons, track orders, request returns, manage their profile and addresses |
| **Admin** | Manage products, categories, orders, users, coupons, returns, payments, and store settings |
| **Superadmin** | Everything an admin can do, plus manage other admin accounts, view audit logs, view email delivery logs, and override system settings |

---

## Core Features

### Shopping Experience
- **Product Catalogue** — Browse and filter products by category, price range, and stock availability. Sort by newest, price, rating, or popularity.
- **Product Search** — Real-time search with autocomplete suggestions.
- **Product Reviews** — Verified buyers can leave 1–5 star ratings and comments. Reviews are editable within a configurable time window.
- **Shopping Cart** — Works for guests (stored locally in the browser) and logged-in customers (synced to the server). Guest carts merge on login.
- **Wishlist** — Save items for later, same guest/authenticated dual-mode behaviour as the cart.
- **Move to Cart** — Move wishlist items directly to the cart.

### Checkout & Orders
- **Address Book** — Save multiple delivery addresses, mark defaults for shipping and billing.
- **Coupon System** — Apply discount codes at checkout. Coupons support:
  - Percentage, fixed-amount, and free-shipping discount types
  - Expiry dates and usage limits (global and per customer)
  - Minimum order value requirements
  - Maximum discount caps on percentage coupons
  - Category restrictions (coupon only applies to specific product categories)
  - First-order-only restriction
  - Personal coupons assigned to a specific customer
- **Order Placement** — Atomic transaction: stock validated and reserved, coupon applied, cart cleared.
- **Order Tracking** — Status progression: Pending → In-Progress → Delivered.
- **Order Cancellation** — Customers can cancel pending orders; stock is automatically restored.
- **PDF Invoice** — Downloadable PDF invoice for every order.

### Payments
- **Online Payments** — Powered by **ShurjoPay**: redirects to payment gateway, handles callback, updates order status.
  - Supported methods: bKash, Nagad, Rocket, debit/credit cards
- **Cash on Delivery (COD)** — Configurable availability and minimum order value.
- **Payment Status** — Tracks pending, completed, failed, cancelled states.

### Returns & Refunds
- **Return Window** — Configurable days after delivery within which returns can be requested.
- **Return Request** — Customer submits a reason; admin reviews and approves or rejects.
- **Refund Tracking** — Admin marks refund completion after processing offline.
- **Stock Restoration** — Approved returns automatically restore product stock.
- **Credit Note PDF** — Downloadable credit note for approved returns.
- **Email Notifications** — Auto-sent to the customer at each stage.

### Notifications
- **In-App Notifications** — Real-time unread badge in the navbar; notification panel with read/unread tracking.
- **Email Notifications** — Sent for: order placed, order status changes, cancellation, payment success/failure, return status updates, password reset, birthday coupon.
- **Birthday Coupons** — Automated daily cron job sends a personalised discount coupon to customers on their birthday.

### Customer Account
- **Profile** — Edit name, avatar, date of birth, and password.
- **Two-Factor Authentication (2FA)** — TOTP-based second factor (Google Authenticator compatible). Optional per user; can be enabled and disabled.
- **GDPR Compliance** — Export personal data (JSON) and permanently delete the account (requires password confirmation).

---

## Admin Dashboard

| Section | Capabilities |
|---|---|
| **Dashboard** | Revenue summary, order counts by status, new customers today, top-selling products |
| **Products** | Create, edit, delete products; manage images (up to 5); bulk price/stock updates; CSV export; stock movement history; manual stock adjustments |
| **Categories** | Create, edit, delete product categories; set active/inactive |
| **Orders** | View all orders; update statuses; bulk status update; CSV export |
| **Returns** | Review return requests; approve/reject; mark refund complete |
| **Coupons** | Create and manage discount codes with full restriction options |
| **Payments** | View all payment records; update statuses |
| **Users** | Create, edit, delete customer accounts; assign roles |
| **Settings** | Store name, contact details, currency, tax rate, return window, free shipping threshold, birthday coupons, payment methods, registration toggle, security settings |
| **Audit Log** *(superadmin)* | Immutable log of all admin actions (product changes, order updates, user management, etc.) |
| **Email Logs** *(superadmin)* | Delivery status of every transactional email sent |
| **Admin Management** *(superadmin)* | Create and manage admin and superadmin accounts |

---

## Store Configuration

Store owners can configure the platform through the Admin Settings panel:

| Setting | Description |
|---|---|
| Store name & branding | Display name shown across the storefront |
| Support / from email | Contact and notification sender address |
| Currency | Default: BDT (Bangladeshi Taka) |
| Tax rate | Applied at checkout |
| Free shipping threshold | Orders above this amount qualify for free shipping |
| Return window | Days after delivery within which returns are accepted |
| Review edit window | Days within which customers can edit their reviews |
| Birthday coupon | Enable/disable, set discount %, set validity period |
| Payment methods | Enable/disable COD and/or online payments; set COD minimum |
| Email notifications | Global on/off switch for transactional emails |
| Registration | Enable/disable new customer sign-ups |
| Security | Failed login attempt limit and lockout duration |

---

## Payment Flow

```
Customer places order
        │
        ├─► COD selected ──────────────────► Order stays Pending, awaits delivery
        │
        └─► Online payment selected
                │
                ▼
        ShurjoPay checkout page
        (bKash / Nagad / Rocket / Card)
                │
                ▼
        Payment callback received
                │
                ├─► Success ─► Order marked In-Progress, customer notified
                └─► Failure ─► Payment marked failed, customer notified
```

---

## Order Status Workflow

```
Pending ──► In-Progress ──► Delivered
   │                            │
   └──► Cancelled               └──► Return-Requested ──► Return-Approved ──► Returned
                                                       └──► Return-Rejected
```

---

## Technology Highlights

- Fully responsive web application — works on desktop, tablet, and mobile
- Dark/light theme toggle
- Real-time notification badge with polling
- Lazy-loaded pages for fast initial load
- Separate admin interface with role-based access control
- Automated cron jobs for birthday emails and low-stock alerts (no worker process required)
- PDF generation for invoices and credit notes

---

## Test Accounts (Development)

| Email | Password | Role |
|---|---|---|
| `admin@shop.com` | `admin123` | Admin |
| `alice@example.com` | `pass1234` | Customer |
| `bob@example.com` | `pass1234` | Customer |

Seed data includes 7 products across 3 categories, 1 coupon (`WELCOME10` — 10% off), and 3 sample orders.

# Mini E-Commerce Frontend

React frontend for the Mini E-Commerce platform. Connects to the Django REST API backend.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| React 19 + Vite | UI framework + build tool |
| React Router v7 | Client-side routing with lazy loading |
| Tailwind CSS v4 + shadcn/ui | Styling + accessible UI components |
| Zustand | State management (auth, cart, wishlist, notifications, settings, theme) |
| Axios | HTTP client with JWT interceptor + silent token refresh |
| Lucide React | Icon library |
| Sonner | Toast notifications |
| next-themes | Dark/light theme with system preference detection |

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Set `VITE_API_BASE_URL` to your backend URL:

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

### 3. Start development server

```bash
npm run dev
```

App runs at `http://localhost:5173`

> Make sure the Django backend is running at `http://localhost:8000` before starting the frontend.

---

## Project Structure

```
src/
├── api/
│   └── axios.js              # Axios instance: JWT attach + silent token refresh on 401
├── components/
│   ├── layout/               # PublicLayout (Navbar+Footer), AdminLayout (sidebar), AuthLayout
│   ├── shared/               # ProductCard, Pagination, EmptyState, StarRating, etc.
│   └── ui/                   # shadcn/ui components (button, card, input, dialog, etc.)
├── pages/
│   ├── auth/                 # Login, Register, ForgotPassword, ResetPassword
│   ├── catalog/              # ProductListPage, ProductDetailPage
│   ├── cart/                 # CartPage
│   ├── checkout/             # CheckoutPage
│   ├── orders/               # OrdersPage, OrderDetailPage
│   ├── payment/              # PaymentSuccessPage, PaymentFailedPage, PaymentCancelledPage
│   ├── profile/              # ProfilePage (profile, addresses, 2FA, GDPR)
│   ├── wishlist/             # WishlistPage
│   ├── admin/                # Dashboard, Products, Orders, Users, Coupons, Returns, etc.
│   └── NotFoundPage.jsx
├── store/
│   ├── authStore.js          # User, JWT tokens, login/logout, 2FA confirm
│   ├── cartStore.js          # Guest cart (localStorage) + backend sync on login
│   ├── wishlistStore.js      # Guest wishlist (localStorage) + backend sync on login
│   ├── notificationStore.js  # Unread count, notification list
│   ├── settingsStore.js      # Site settings (store name, currency, feature flags)
│   └── themeStore.js         # Dark/light theme
├── router/
│   └── index.jsx             # All routes + ProtectedRoute, AdminRoute, GuestOnlyRoute guards
├── lib/
│   ├── utils.js              # cn() utility, formatting helpers
│   └── errors.js             # API error message parser
├── App.jsx
├── main.jsx
└── index.css                 # Tailwind v4 + OKLCH design tokens (light + dark)
```

---

## State Management

| Store | Persisted | Description |
|---|---|---|
| `authStore` | `localStorage` | User object, access token, refresh token; handles login, logout, 2FA |
| `cartStore` | `localStorage` (`guest_cart`) | Guest cart in localStorage; syncs to backend on login |
| `wishlistStore` | `localStorage` (`guest_wishlist`) | Same dual-mode pattern as cart |
| `notificationStore` | Memory only | Unread count + notification list; fetched on demand |
| `settingsStore` | Memory only | Public store settings; fetched on layout mount |
| `themeStore` | `localStorage` | Persists dark/light preference |

---

## Authentication Flow

- **Access token:** 1 day | **Refresh token:** 30 days (rotating)
- Axios request interceptor attaches `Authorization: Bearer <token>` to every request
- On 401: interceptor silently calls `POST /auth/token/refresh/` and retries the original request
- Refresh token rotates on every refresh — new token always saved to localStorage
- If refresh fails (expired/blacklisted): auth is cleared, user redirected to `/login`
- **2FA:** If login returns `{ requires_2fa: true, two_fa_token }`, JWT tokens are NOT stored until `POST /auth/2fa/confirm/` succeeds with the TOTP code

---

## Cart & Wishlist Behaviour

- **Guest users:** Items stored in `localStorage` (`guest_cart` / `guest_wishlist`)
- **On login:** Local items are pushed to the backend and merged with any existing backend items; localStorage is cleared
- **Authenticated:** Backend is the source of truth; optimistic UI updates

---

## Route Guards

| Guard | Behaviour |
|---|---|
| `ProtectedRoute` | Redirects to `/login` if no access token |
| `AdminRoute` | Redirects to `/login` or `/` if role is not `admin` or `superadmin` |
| `SuperAdminRoute` | Redirects to `/admin` if role is not `superadmin` |
| `GuestOnlyRoute` | Redirects to `/` if already authenticated |

---

## Adding shadcn/ui Components

```bash
npx shadcn@latest add button
npx shadcn@latest add input
npx shadcn@latest add dialog
```

Components are added to `src/components/ui/`.

---

## Design System

Styling uses **Tailwind CSS v4** with a custom OKLCH-based color palette defined in `src/index.css`. Supports full light/dark mode via CSS custom properties.

| Token | Light | Dark |
|---|---|---|
| `--primary` | Indigo-blue (`oklch(0.52 0.26 265)`) | Lighter blue for dark backgrounds |
| `--background` | Subtle blue-tinted off-white | Deep blue-tinted near-black |
| `--card` | Pure white (lifts off background) | Slightly lighter surface |
| `--destructive` | Red | Red |
| `--success` | Green | Green |

Typography: **Inter** (Google Fonts) with `letter-spacing: -0.02em` on headings.

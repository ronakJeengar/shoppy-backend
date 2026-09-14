# Phase 08 — India-First EMI & Buy Now, Pay Later (BNPL) System

## Overview
A production-ready, backend-first, provider-agnostic EMI and BNPL financing engine for Shoppy. All calculations (reducing balance interest, No-Cost EMI, processing fees, eligibility, tenures) are strictly computed authoritatively on the backend.

## Key Components

### 1. Calculation Service (`src/services/emiCalculation.service.js`)
- **Standard Bank EMI**: Uses standard financial reducing-balance formula:
  $$EMI = \frac{P \cdot r \cdot (1 + r)^n}{(1 + r)^n - 1}$$
  where $r = \frac{\text{annualRate}}{12 \times 100}$.
- **No-Cost EMI**: Monthly installment $= \frac{P}{n}$, interest is zero to customer ($0\%$).
- **Processing Fees**: Supports `FIXED` (e.g., ₹99, ₹199) or `PERCENTAGE`.
- **Rounding & Precision**: Strict 2-decimal rounding with `Number.EPSILON` to avoid precision drift.

### 2. Eligibility Service (`src/services/emiEligibility.service.js`)
- Enforces system-level enable flag (`appConfig.emi.enabled`).
- Min order value check (`₹3,000` default) $\to$ `EMI_AMOUNT_TOO_LOW`.
- Max order value check (`₹5,00,000` default) $\to$ `EMI_AMOUNT_TOO_HIGH`.
- Provider-level filtering (`minAmount`, `maxAmount`, active state).
- Mutual exclusivity with COD.

### 3. EMI Service & Data Model (`src/models/emi_plan.model.js`, `src/services/emi.service.js`)
- Default seed plans for top Indian banks: HDFC, ICICI, SBI, Axis, and Demo Partner.
- Supports both Mongo-backed store and fast offline fallback store.
- CRUD methods for admin configuration.

### 4. Checkout & Order Snapshot Integration
- `checkout.controller.js`:
  - Enforces `validateAndCalculateSelectedPlan` during checkout validation and creation.
  - Attaches immutable `emiDetails` snapshot on the `Order` document.
  - Order status is set to `PENDING_PAYMENT`, payment status to `PENDING`.
  - Attaches `emi` snapshot on the `Payment` document.
- `invoice.service.js`:
  - Renders EMI financing breakdown card in HTML and JSON tax invoice.

### 5. API Endpoints
- `GET /api/v1/emi/plans?amount=:amount` (Public)
- `POST /api/v1/emi/calculate` (Public)
- `GET /api/v1/admin/emi/plans` (Admin)
- `POST /api/v1/admin/emi/plans` (Admin)
- `GET /api/v1/admin/emi/plans/:id` (Admin)
- `PATCH /api/v1/admin/emi/plans/:id` (Admin)
- `PATCH /api/v1/admin/emi/plans/:id/status` (Admin)
- `DELETE /api/v1/admin/emi/plans/:id` (Admin)

## Test Coverage
- 18 tests in `tests/emi.test.js` covering calculation math, No-Cost EMI, eligibility bounds, public APIs, admin CRUD, checkout integration, and invoice snapshot.

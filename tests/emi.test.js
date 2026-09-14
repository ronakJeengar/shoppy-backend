import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import { EmiCalculationService } from "../src/services/emiCalculation.service.js";
import { EmiEligibilityService, EMI_REASON_CODES } from "../src/services/emiEligibility.service.js";
import { EmiService } from "../src/services/emi.service.js";
import { InvoiceService } from "../src/services/invoice.service.js";
import { _clearTestOrders } from "../src/controllers/order.controller.js";

const secretKey =
  process.env.ACCESS_TOKEN_KEY ||
  "shoppy_access_token_secret_key_development_example";

const customerUser = {
  _id: "64f1a2b3c4d5e6f7a8b9c991",
  email: "emi_customer@example.com",
  fullname: "EMI Customer",
  username: "emi_customer",
  role: "CUSTOMER",
};

const adminUser = {
  _id: "64f1a2b3c4d5e6f7a8b9c990",
  email: "admin_emi@example.com",
  fullname: "Admin EMI",
  username: "admin_emi",
  role: "ADMIN",
};

const customerToken = jwt.sign(customerUser, secretKey, { expiresIn: "1h" });
const adminToken = jwt.sign(adminUser, secretKey, { expiresIn: "1h" });

const customerHeaders = {
  Authorization: `Bearer ${customerToken}`,
  "Content-Type": "application/json",
};

const adminHeaders = {
  Authorization: `Bearer ${adminToken}`,
  "Content-Type": "application/json",
};

describe("Feature 8: EMI / Buy Now Pay Later (BNPL) System Tests", () => {
  beforeEach(() => {
    EmiService._resetMemoryPlans();
    _clearTestOrders();
  });

  afterEach(() => {
    EmiService._resetMemoryPlans();
    _clearTestOrders();
  });

  describe("1. Mathematical Calculation Engine (EmiCalculationService)", () => {
    test("Zero-interest / No Cost EMI: uses P / n without division by zero", () => {
      const quote = EmiCalculationService.calculateEmi({
        principal: 12000,
        tenureMonths: 6,
        annualInterestRate: 0,
        processingFee: 99,
        processingFeeType: "FIXED",
      });

      assert.strictEqual(quote.principal, 12000);
      assert.strictEqual(quote.tenureMonths, 6);
      assert.strictEqual(quote.monthlyInstallment, 2000);
      assert.strictEqual(quote.totalInterest, 0);
      assert.strictEqual(quote.processingFee, 99);
      assert.strictEqual(quote.totalPayable, 12099);
    });

    test("Standard reducing balance EMI with 14% annual interest", () => {
      const quote = EmiCalculationService.calculateEmi({
        principal: 30000,
        tenureMonths: 12,
        annualInterestRate: 14,
        processingFee: 199,
        processingFeeType: "FIXED",
      });

      assert.strictEqual(quote.principal, 30000);
      assert.strictEqual(quote.tenureMonths, 12);
      // Monthly rate r = 14 / 12 / 100 = 0.01166667
      // EMI = 30000 * 0.01166667 * (1.01166667)^12 / ((1.01166667)^12 - 1) ≈ 2693.99
      assert.ok(quote.monthlyInstallment > 2690 && quote.monthlyInstallment < 2700);
      assert.strictEqual(quote.processingFee, 199);
      const expectedTotalPayable = Math.round((quote.monthlyInstallment * 12 + 199) * 100) / 100;
      assert.strictEqual(quote.totalPayable, expectedTotalPayable);
    });

    test("Percentage-based processing fee calculation", () => {
      const fee = EmiCalculationService.calculateProcessingFee(25000, 1.5, "PERCENTAGE");
      assert.strictEqual(fee, 375); // 1.5% of 25000
    });

    test("Handles invalid or edge inputs safely", () => {
      const zeroQuote = EmiCalculationService.calculateEmi({
        principal: 0,
        tenureMonths: 6,
        annualInterestRate: 12,
      });
      assert.strictEqual(zeroQuote.monthlyInstallment, 0);
      assert.strictEqual(zeroQuote.totalPayable, 0);
    });
  });

  describe("2. EMI Eligibility Evaluator (EmiEligibilityService)", () => {
    test("Rejects amount below minimum order value (₹3000)", async () => {
      const result = await EmiEligibilityService.evaluateEligibility({
        amount: 2500,
      });
      assert.strictEqual(result.eligible, false);
      assert.strictEqual(result.reasonCode, EMI_REASON_CODES.AMOUNT_TOO_LOW);
    });

    test("Rejects amount above maximum order value (₹500,000)", async () => {
      const result = await EmiEligibilityService.evaluateEligibility({
        amount: 550000,
      });
      assert.strictEqual(result.eligible, false);
      assert.strictEqual(result.reasonCode, EMI_REASON_CODES.AMOUNT_TOO_HIGH);
    });

    test("Approves valid amount within bounds (₹25,000)", async () => {
      const result = await EmiEligibilityService.evaluateEligibility({
        amount: 25000,
      });
      assert.strictEqual(result.eligible, true);
      assert.strictEqual(result.reasonCode, null);
      assert.ok(result.minAmount <= 25000);
      assert.ok(result.maxAmount >= 25000);
    });
  });

  describe("3. Public EMI Plans & Calculation API", () => {
    test("GET /api/v1/emi/plans returns default active plans", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/emi/plans`);
        const body = await res.json();

        assert.strictEqual(res.status, 200);
        assert.strictEqual(body.success, true);
        assert.ok(Array.isArray(body.data.plans));
        assert.ok(body.data.plans.length >= 3);

        const firstPlan = body.data.plans[0];
        assert.ok(firstPlan.provider);
        assert.ok(Array.isArray(firstPlan.tenures));
        assert.ok(firstPlan.tenures.length > 0);
      } finally {
        server.close();
      }
    });

    test("GET /api/v1/emi/plans?amount=24000 returns plans with pre-calculated quotes", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/emi/plans?amount=24000`);
        const body = await res.json();

        assert.strictEqual(res.status, 200);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.eligibility.eligible, true);

        const plan = body.data.plans[0];
        const tenure = plan.tenures[0];
        assert.ok(tenure.quote);
        assert.ok(tenure.quote.monthlyInstallment > 0);
        assert.strictEqual(tenure.quote.principal, 24000);
      } finally {
        server.close();
      }
    });

    test("POST /api/v1/emi/calculate returns quote for chosen plan & tenure", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const plansRes = await fetch(`http://localhost:${port}/api/v1/emi/plans`);
        const plansBody = await plansRes.json();
        const plan = plansBody.data.plans[0];
        const tenureMonths = plan.tenures[0].months;

        const calcRes = await fetch(`http://localhost:${port}/api/v1/emi/calculate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: 15000,
            planId: plan.id,
            tenureMonths: tenureMonths,
          }),
        });

        const calcBody = await calcRes.json();
        assert.strictEqual(calcRes.status, 200);
        assert.strictEqual(calcBody.success, true);
        assert.strictEqual(calcBody.data.principal, 15000);
        assert.strictEqual(calcBody.data.tenureMonths, tenureMonths);
        assert.ok(calcBody.data.monthlyInstallment > 0);
      } finally {
        server.close();
      }
    });

    test("POST /api/v1/emi/calculate returns 400 for invalid tenure", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const plansRes = await fetch(`http://localhost:${port}/api/v1/emi/plans`);
        const plansBody = await plansRes.json();
        const plan = plansBody.data.plans[0];

        const calcRes = await fetch(`http://localhost:${port}/api/v1/emi/calculate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: 15000,
            planId: plan.id,
            tenureMonths: 999, // non-existent tenure
          }),
        });

        assert.strictEqual(calcRes.status, 400);
      } finally {
        server.close();
      }
    });
  });

  describe("4. Checkout Integration & Order Placement", () => {
    test("POST /api/v1/checkout/validate validates EMI option and provides quote", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const plansRes = await fetch(`http://localhost:${port}/api/v1/emi/plans`);
        const plansBody = await plansRes.json();
        const plan = plansBody.data.plans[0];
        const tenure = plan.tenures[0];

        const res = await fetch(`http://localhost:${port}/api/v1/checkout/validate`, {
          method: "POST",
          headers: customerHeaders,
          body: JSON.stringify({
            addressId: "addr_123",
            shippingMethod: "STANDARD",
            paymentMethod: "EMI",
            emiPlan: {
              planId: plan.id,
              tenureMonths: tenure.months,
            },
          }),
        });

        const body = await res.json();
        assert.strictEqual(res.status, 200);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.paymentMethod, "EMI");
        assert.ok(body.data.emiQuote);
        assert.strictEqual(body.data.emiQuote.provider, plan.provider);
        assert.strictEqual(body.data.emiQuote.tenureMonths, tenure.months);
        assert.ok(body.data.emiQuote.monthlyInstallment > 0);
      } finally {
        server.close();
      }
    });

    test("POST /api/v1/checkout/create creates EMI order with PENDING_PAYMENT status and emiDetails snapshot", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const plansRes = await fetch(`http://localhost:${port}/api/v1/emi/plans`);
        const plansBody = await plansRes.json();
        const plan = plansBody.data.plans[0];
        const tenure = plan.tenures[0];

        const res = await fetch(`http://localhost:${port}/api/v1/checkout/create`, {
          method: "POST",
          headers: {
            ...customerHeaders,
            "Idempotency-Key": "emi-test-idempotency-1001",
          },
          body: JSON.stringify({
            addressId: "addr_123",
            shippingMethod: "STANDARD",
            paymentMethod: "EMI",
            emiPlan: {
              planId: plan.id,
              tenureMonths: tenure.months,
            },
          }),
        });

        const body = await res.json();
        assert.strictEqual(res.status, 201);
        assert.strictEqual(body.success, true);

        const order = body.data.order;
        const payment = body.data.payment;
        assert.strictEqual(order.status, "PENDING_PAYMENT");
        assert.strictEqual(payment.paymentMethod, "EMI");
        assert.strictEqual(payment.status, "PENDING");

        assert.ok(order.emiDetails);
        assert.strictEqual(order.emiDetails.isEmi, true);
        assert.strictEqual(order.emiDetails.provider, plan.provider);
        assert.strictEqual(order.emiDetails.tenureMonths, tenure.months);
        assert.strictEqual(order.emiDetails.principal, order.grandTotal);
        assert.ok(order.emiDetails.monthlyInstallment > 0);
      } finally {
        server.close();
      }
    });

    test("POST /api/v1/checkout/create rejects EMI order without planId or tenureMonths", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/checkout/create`, {
          method: "POST",
          headers: customerHeaders,
          body: JSON.stringify({
            addressId: "addr_123",
            shippingMethod: "STANDARD",
            paymentMethod: "EMI",
            // missing emiPlan
          }),
        });

        assert.strictEqual(res.status, 400);
      } finally {
        server.close();
      }
    });
  });

  describe("5. Admin EMI Plan Management (RBAC & CRUD)", () => {
    test("GET /api/v1/admin/emi/plans rejects unauthenticated requests with 401", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/admin/emi/plans`);
        assert.strictEqual(res.status, 401);
      } finally {
        server.close();
      }
    });

    test("GET /api/v1/admin/emi/plans rejects non-admin users with 403", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/admin/emi/plans`, {
          headers: customerHeaders,
        });
        assert.strictEqual(res.status, 403);
      } finally {
        server.close();
      }
    });

    test("GET & POST /api/v1/admin/emi/plans allows admin to manage plans", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        // 1. Get plans
        const getRes = await fetch(`http://localhost:${port}/api/v1/admin/emi/plans`, {
          headers: adminHeaders,
        });
        const getBody = await getRes.json();
        assert.strictEqual(getRes.status, 200);
        assert.ok(Array.isArray(getBody.data.plans));

        // 2. Create new plan
        const newPlanPayload = {
          provider: "Federal Bank",
          providerCode: "FEDERAL",
          providerType: "BANK",
          minAmount: 5000,
          maxAmount: 200000,
          tenures: [
            { months: 3, interestRate: 0, processingFee: 0, isNoCost: true },
            { months: 6, interestRate: 13, processingFee: 199, isNoCost: false },
          ],
        };

        const createRes = await fetch(`http://localhost:${port}/api/v1/admin/emi/plans`, {
          method: "POST",
          headers: adminHeaders,
          body: JSON.stringify(newPlanPayload),
        });
        const createBody = await createRes.json();
        assert.strictEqual(createRes.status, 201);
        assert.strictEqual(createBody.data.plan.provider, "Federal Bank");
        const createdId = createBody.data.plan.id;

        // 3. Toggle status
        const toggleRes = await fetch(`http://localhost:${port}/api/v1/admin/emi/plans/${createdId}/status`, {
          method: "PATCH",
          headers: adminHeaders,
          body: JSON.stringify({ isActive: false }),
        });
        const toggleBody = await toggleRes.json();
        assert.strictEqual(toggleRes.status, 200);
        assert.strictEqual(toggleBody.data.plan.isActive, false);

        // 4. Delete plan
        const deleteRes = await fetch(`http://localhost:${port}/api/v1/admin/emi/plans/${createdId}`, {
          method: "DELETE",
          headers: adminHeaders,
        });
        assert.strictEqual(deleteRes.status, 200);
      } finally {
        server.close();
      }
    });
  });

  describe("6. Invoice Snapshot & HTML for EMI Orders", () => {
    test("InvoiceService builds invoice snapshot capturing EMI details", () => {
      const mockOrder = {
        _id: "64f1a2b3c4d5e6f7a8b9c999",
        orderNumber: "ORD-EMI-9999",
        status: "PENDING_PAYMENT",
        currency: "INR",
        items: [
          {
            product: "64f1a2b3c4d5e6f7a8b9c111",
            productName: "Laptop",
            sku: "LAP-001",
            hsn: "84713010",
            quantity: 1,
            mrp: 55000,
            sellingPrice: 50000,
            price: 50000,
            discount: 0,
            taxableValue: 42372.88,
            gstRate: 18,
            cgst: 3813.56,
            sgst: 3813.56,
            igst: 0,
            totalTax: 7627.12,
            lineTotal: 50000,
          },
        ],
        subtotal: 50000,
        discount: 0,
        taxableAmount: 42372.88,
        cgst: 3813.56,
        sgst: 3813.56,
        igst: 0,
        totalTax: 7627.12,
        shippingFee: 0,
        codFee: 0,
        grandTotal: 50000,
        shippingAddress: {
          fullName: "EMI Customer",
          phone: "9876543210",
          addressLine1: "123 MG Road",
          city: "Bengaluru",
          state: "Karnataka",
          stateCode: "29",
          pinCode: "560001",
          country: "IN",
        },
        billingAddress: {
          fullName: "EMI Customer",
          phone: "9876543210",
          addressLine1: "123 MG Road",
          city: "Bengaluru",
          state: "Karnataka",
          stateCode: "29",
          pinCode: "560001",
          country: "IN",
        },
        payment: {
          paymentMethod: "EMI",
          status: "PENDING",
          provider: "EMI",
          transactionId: "TXN_EMI_12345",
        },
        emiDetails: {
          isEmi: true,
          planId: "emi_hdfc_bank",
          provider: "HDFC Bank",
          providerCode: "HDFC",
          tenureMonths: 6,
          interestRate: 0,
          processingFee: 99,
          processingFeeType: "FIXED",
          principal: 50000,
          monthlyInstallment: 8333.33,
          totalInterest: 0,
          totalPayable: 50099,
          isNoCost: true,
        },
      };

      const snapshot = InvoiceService.buildInvoiceSnapshot(mockOrder);
      assert.strictEqual(snapshot.payment.method, "EMI");
      assert.ok(snapshot.emi);
      assert.strictEqual(snapshot.emi.isEmi, true);
      assert.strictEqual(snapshot.emi.provider, "HDFC Bank");
      assert.strictEqual(snapshot.emi.tenureMonths, 6);
      assert.strictEqual(snapshot.emi.isNoCost, true);

      const html = InvoiceService.generateInvoiceHtml(snapshot);
      assert.ok(html.includes("EMI Facility:"));
      assert.ok(html.includes("HDFC Bank"));
      assert.ok(html.includes("No Cost EMI"));
    });
  });
});

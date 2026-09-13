import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import { InvoiceService, formatINRInWords } from "../src/services/invoice.service.js";
import { _registerTestOrder, _clearTestOrders } from "../src/controllers/order.controller.js";

const secretKey =
  process.env.ACCESS_TOKEN_KEY ||
  "shoppy_access_token_secret_key_development_example";

const customerAlice = {
  _id: "64f1a2b3c4d5e6f7a8b9c111",
  email: "alice@example.com",
  fullname: "Alice Sharma",
  username: "alice_s",
  role: "CUSTOMER",
};

const customerBob = {
  _id: "64f1a2b3c4d5e6f7a8b9c222",
  email: "bob@example.com",
  fullname: "Bob Verma",
  username: "bob_v",
  role: "CUSTOMER",
};

const adminUser = {
  _id: "64f1a2b3c4d5e6f7a8b9c000",
  email: "admin_inv@example.com",
  fullname: "Admin User",
  username: "admin_inv",
  role: "ADMIN",
};

const aliceToken = jwt.sign(customerAlice, secretKey, { expiresIn: "1h" });
const bobToken = jwt.sign(customerBob, secretKey, { expiresIn: "1h" });
const adminToken = jwt.sign(adminUser, secretKey, { expiresIn: "1h" });

const aliceHeaders = {
  Authorization: `Bearer ${aliceToken}`,
  "Content-Type": "application/json",
};

const bobHeaders = {
  Authorization: `Bearer ${bobToken}`,
  "Content-Type": "application/json",
};

const adminHeaders = {
  Authorization: `Bearer ${adminToken}`,
  "Content-Type": "application/json",
};

describe("Feature 7: India-First GST-Compliant Invoice Generation", () => {
  beforeEach(() => {
    InvoiceService._resetMemorySequences();
    _clearTestOrders();
  });

  afterEach(() => {
    _clearTestOrders();
  });

  describe("1. Currency & Amount In Words Formatting", () => {
    test("Correctly formats Indian Rupee amounts in words", () => {
      assert.strictEqual(formatINRInWords(0), "Zero Rupees Only");
      assert.strictEqual(formatINRInWords(100), "One Hundred Rupees Only");
      assert.strictEqual(formatINRInWords(1268), "One Thousand Two Hundred and Sixty Eight Rupees Only");
      assert.strictEqual(formatINRInWords(15499.5), "Fifteen Thousand Four Hundred and Ninety Nine Rupees and Fifty Paise Only");
      assert.strictEqual(formatINRInWords(105000), "One Lakh Five Thousand Rupees Only");
    });
  });

  describe("2. Invoice Number Generation Strategy", () => {
    test("Generates unique, monotonic, sequential invoice numbers formatted as INV-YYYY-XXXXXX", async () => {
      const year = new Date().getFullYear();
      const inv1 = await InvoiceService.generateNextInvoiceNumber();
      const inv2 = await InvoiceService.generateNextInvoiceNumber();
      const inv3 = await InvoiceService.generateNextInvoiceNumber();

      assert.strictEqual(inv1, `INV-${year}-000001`);
      assert.strictEqual(inv2, `INV-${year}-000002`);
      assert.strictEqual(inv3, `INV-${year}-000003`);
    });
  });

  describe("3. Order Snapshot Based GST Invoice Building", () => {
    test("Builds intra-state invoice with CGST and SGST split (50/50, IGST: 0)", () => {
      const order = {
        _id: "ord_intra_001",
        orderNumber: "ORD-2026-KA01",
        createdAt: new Date("2026-09-13T10:00:00Z"),
        customer: customerAlice._id,
        status: "CONFIRMED",
        subtotal: 1000.0,
        discount: 0.0,
        shippingFee: 49.0,
        codFee: 0.0,
        tax: 152.54,
        totalAmount: 1049.0,
        currency: "INR",
        shippingAddress: {
          fullName: "Alice Sharma",
          phone: "9876543210",
          streetAddress: "123 MG Road",
          city: "Bengaluru",
          state: "KARNATAKA",
          pinCode: "560001",
          country: "IN",
        },
        taxBreakdown: {
          taxableAmount: 847.46,
          cgst: 76.27,
          sgst: 76.27,
          igst: 0,
          totalTax: 152.54,
          isInterState: false,
          originState: "KARNATAKA",
          customerState: "KARNATAKA",
        },
        orderItems: [
          {
            productId: "p1",
            productName: "Silk Scarf",
            sku: "SKU-SLK-01",
            hsnCode: "5007",
            quantity: 1,
            mrp: 1000.0,
            unitPrice: 1000.0,
            discountAmount: 0.0,
            gstRate: 18,
            isTaxInclusive: true,
            lineTotal: 1000.0,
          },
        ],
        payment: {
          paymentMethod: "CARD",
          status: "COMPLETED",
          transactionId: "txn_card_123",
          provider: "STRIPE",
        },
      };

      const sellerConfig = {
        legalName: "Shoppy Retail Private Limited",
        tradeName: "Shoppy Official",
        address: "Indiranagar",
        city: "Bengaluru",
        state: "Karnataka",
        stateCode: "KA",
        pinCode: "560038",
        country: "India",
        gstin: "29AABCU9603R1ZM",
        pan: "AABCU9603R",
        phone: "+91 80 4567 8900",
        email: "billing@shoppy.in",
        cin: "U72900KA2024PTC123456",
      };

      const invoice = InvoiceService.buildInvoiceSnapshot({
        order,
        sellerConfig,
        invoiceNumber: "INV-2026-000010",
        invoiceDate: new Date("2026-09-13T10:05:00Z"),
        payment: order.payment,
      });

      assert.strictEqual(invoice.invoiceNumber, "INV-2026-000010");
      assert.strictEqual(invoice.isInterState, false);
      assert.strictEqual(invoice.totals.grandTotal, 1049.0);
      assert.strictEqual(invoice.totals.totalTax, 152.54);
      assert.strictEqual(invoice.totals.cgst, 76.27);
      assert.strictEqual(invoice.totals.sgst, 76.27);
      assert.strictEqual(invoice.totals.igst, 0);

      // Item level check
      assert.strictEqual(invoice.items.length, 1);
      const item = invoice.items[0];
      assert.strictEqual(item.hsnCode, "5007");
      assert.strictEqual(item.sku, "SKU-SLK-01");
      assert.strictEqual(item.gstRate, 18);
      assert.strictEqual(item.cgstRate, 9);
      assert.strictEqual(item.sgstRate, 9);
      assert.strictEqual(item.igstRate, 0);
      assert.strictEqual(item.cgst, 76.27);
      assert.strictEqual(item.sgst, 76.27);
      assert.strictEqual(item.igst, 0);

      // Tax summary check
      assert.strictEqual(invoice.taxSummary.length, 1);
      assert.strictEqual(invoice.taxSummary[0].hsnCode, "5007");
      assert.strictEqual(invoice.taxSummary[0].totalTax, 152.54);
    });

    test("Builds inter-state invoice with IGST only (100%, CGST: 0, SGST: 0)", () => {
      const order = {
        _id: "ord_inter_002",
        orderNumber: "ORD-2026-MH01",
        createdAt: new Date(),
        customer: customerAlice._id,
        status: "CONFIRMED",
        subtotal: 2000.0,
        discount: 0.0,
        shippingFee: 0.0,
        codFee: 0.0,
        tax: 305.08,
        totalAmount: 2000.0,
        currency: "INR",
        shippingAddress: {
          fullName: "Alice Sharma",
          phone: "9876543210",
          streetAddress: "Bandra West",
          city: "Mumbai",
          state: "MAHARASHTRA",
          pinCode: "400050",
          country: "IN",
        },
        taxBreakdown: {
          taxableAmount: 1694.92,
          cgst: 0,
          sgst: 0,
          igst: 305.08,
          totalTax: 305.08,
          isInterState: true,
          originState: "KARNATAKA",
          customerState: "MAHARASHTRA",
        },
        orderItems: [
          {
            productId: "p2",
            productName: "Wireless Earbuds",
            sku: "SKU-EAR-02",
            hsnCode: "8518",
            quantity: 1,
            mrp: 2000.0,
            unitPrice: 2000.0,
            discountAmount: 0.0,
            gstRate: 18,
            isTaxInclusive: true,
            lineTotal: 2000.0,
          },
        ],
        payment: {
          paymentMethod: "CARD",
          status: "COMPLETED",
          transactionId: "txn_card_456",
        },
      };

      const sellerConfig = {
        legalName: "Shoppy Retail Private Limited",
        tradeName: "Shoppy Official",
        address: "Indiranagar",
        city: "Bengaluru",
        state: "Karnataka",
        stateCode: "KA",
        pinCode: "560038",
        country: "India",
        gstin: "29AABCU9603R1ZM",
        pan: "AABCU9603R",
        phone: "+91 80 4567 8900",
        email: "billing@shoppy.in",
        cin: "U72900KA2024PTC123456",
      };

      const invoice = InvoiceService.buildInvoiceSnapshot({
        order,
        sellerConfig,
        invoiceNumber: "INV-2026-000011",
        payment: order.payment,
      });

      assert.strictEqual(invoice.isInterState, true);
      assert.strictEqual(invoice.totals.cgst, 0);
      assert.strictEqual(invoice.totals.sgst, 0);
      assert.strictEqual(invoice.totals.igst, 305.08);

      const item = invoice.items[0];
      assert.strictEqual(item.cgst, 0);
      assert.strictEqual(item.sgst, 0);
      assert.strictEqual(item.igst, 305.08);
      assert.strictEqual(item.igstRate, 18);
    });

    test("Preserves COD fee in invoice totals and sets payment status as PENDING", () => {
      const order = {
        _id: "ord_cod_003",
        orderNumber: "ORD-2026-COD1",
        createdAt: new Date(),
        customer: customerAlice._id,
        status: "CONFIRMED",
        subtotal: 500.0,
        discount: 0.0,
        shippingFee: 49.0,
        codFee: 40.0,
        tax: 76.27,
        totalAmount: 589.0,
        currency: "INR",
        shippingAddress: {
          fullName: "Alice Sharma",
          phone: "9876543210",
          streetAddress: "Koramangala",
          city: "Bengaluru",
          state: "KARNATAKA",
          pinCode: "560034",
          country: "IN",
        },
        orderItems: [
          {
            productId: "p3",
            productName: "Cotton T-Shirt",
            sku: "SKU-TSH-03",
            hsnCode: "6109",
            quantity: 1,
            unitPrice: 500.0,
            discountAmount: 0.0,
            gstRate: 18,
            isTaxInclusive: true,
            lineTotal: 500.0,
          },
        ],
        codDetails: {
          isCod: true,
          fee: 40.0,
        },
        payment: {
          paymentMethod: "COD",
          status: "PENDING",
        },
      };

      const sellerConfig = {
        legalName: "Shoppy Retail",
        tradeName: "Shoppy",
        state: "Karnataka",
        country: "India",
      };

      const invoice = InvoiceService.buildInvoiceSnapshot({
        order,
        sellerConfig,
        invoiceNumber: "INV-2026-000012",
        payment: order.payment,
      });

      assert.strictEqual(invoice.cod.isCod, true);
      assert.strictEqual(invoice.cod.fee, 40.0);
      assert.strictEqual(invoice.totals.codFee, 40.0);
      assert.strictEqual(invoice.totals.grandTotal, 589.0);
      assert.strictEqual(invoice.payment.method, "COD");
      assert.strictEqual(invoice.payment.status, "PENDING");
    });

    test("Preserves coupon discount and allocates proportionally across line items", () => {
      const order = {
        _id: "ord_disc_004",
        orderNumber: "ORD-2026-DISC1",
        createdAt: new Date(),
        customer: customerAlice._id,
        status: "CONFIRMED",
        subtotal: 1000.0,
        discount: 200.0,
        shippingFee: 0.0,
        codFee: 0.0,
        tax: 122.03,
        totalAmount: 800.0,
        currency: "INR",
        shippingAddress: {
          fullName: "Alice Sharma",
          phone: "9876543210",
          streetAddress: "Jayanagar",
          city: "Bengaluru",
          state: "KARNATAKA",
          pinCode: "560041",
          country: "IN",
        },
        orderItems: [
          {
            productId: "p4",
            productName: "Leather Wallet",
            sku: "SKU-WLT-04",
            hsnCode: "4202",
            quantity: 1,
            mrp: 1000.0,
            unitPrice: 1000.0,
            discountAmount: 0.0,
            gstRate: 18,
            isTaxInclusive: true,
            lineTotal: 1000.0,
          },
        ],
        payment: { paymentMethod: "CARD", status: "COMPLETED" },
      };

      const sellerConfig = { legalName: "Shoppy Retail", state: "Karnataka" };
      const invoice = InvoiceService.buildInvoiceSnapshot({
        order,
        sellerConfig,
        invoiceNumber: "INV-2026-000013",
        payment: order.payment,
      });

      assert.strictEqual(invoice.totals.discount, 200.0);
      assert.strictEqual(invoice.totals.grandTotal, 800.0);
      assert.strictEqual(invoice.items[0].discount, 200.0);
      assert.strictEqual(invoice.items[0].effectiveAmount, 800.0);
      assert.strictEqual(invoice.items[0].lineTotal, 800.0);
    });
  });

  describe("4. API Security & IDOR Protection", () => {
    test("GET /api/v1/orders/:id/invoice returns 401 for unauthenticated request", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/orders/64f1b2c3d4e5f6a7b8c90001/invoice`);
        assert.strictEqual(res.status, 401);
      } finally {
        server.close();
      }
    });

    test("GET /api/v1/orders/:id/invoice returns 403 Forbidden when Alice attempts to access Bob's invoice (IDOR defense)", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        // Register Bob's order
        const bobOrderId = "64f1b2c3d4e5f6a7b8c90999";
        _registerTestOrder({
          _id: bobOrderId,
          orderNumber: "ORD-BOB-01",
          customer: customerBob._id,
          status: "CONFIRMED",
          subtotal: 500,
          shippingFee: 0,
          tax: 76.27,
          totalAmount: 500,
          shippingAddress: {
            fullName: "Bob Verma",
            phone: "9999999999",
            streetAddress: "Bob Street",
            city: "Delhi",
            state: "DELHI",
            pinCode: "110001",
          },
          orderItems: [
            {
              productId: "p1",
              productName: "Test Item",
              unitPrice: 500,
              quantity: 1,
              lineTotal: 500,
            },
          ],
        });

        // Alice attempts to access Bob's invoice
        const res = await fetch(`http://localhost:${port}/api/v1/orders/${bobOrderId}/invoice`, {
          headers: aliceHeaders,
        });

        assert.strictEqual(res.status, 403);
        const body = await res.json();
        assert.strictEqual(body.success, false);
        assert.match(body.message, /Access denied/i);
      } finally {
        server.close();
      }
    });

    test("GET /api/v1/orders/:id/invoice allows order owner (Alice) to retrieve her invoice", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const aliceOrderId = "64f1b2c3d4e5f6a7b8c90111";
        _registerTestOrder({
          _id: aliceOrderId,
          orderNumber: "ORD-ALICE-01",
          customer: customerAlice._id,
          status: "CONFIRMED",
          subtotal: 1000,
          shippingFee: 49,
          tax: 152.54,
          totalAmount: 1049,
          currency: "INR",
          shippingAddress: {
            fullName: "Alice Sharma",
            phone: "9876543210",
            streetAddress: "123 MG Road",
            city: "Bengaluru",
            state: "KARNATAKA",
            pinCode: "560001",
          },
          orderItems: [
            {
              productId: "p1",
              productName: "Casual Shirt",
              hsnCode: "6205",
              sku: "SKU-SHIRT-01",
              unitPrice: 1000,
              quantity: 1,
              lineTotal: 1000,
              gstRate: 18,
            },
          ],
        });

        const res = await fetch(`http://localhost:${port}/api/v1/orders/${aliceOrderId}/invoice`, {
          headers: aliceHeaders,
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.orderNumber, "ORD-ALICE-01");
        assert.match(body.data.invoiceNumber, /^INV-\d{4}-\d{6}$/);
        assert.strictEqual(body.data.totals.grandTotal, 1049);
      } finally {
        server.close();
      }
    });

    test("GET /api/v1/orders/:id/invoice allows Admin to access any customer's invoice", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const aliceOrderId = "64f1b2c3d4e5f6a7b8c90112";
        _registerTestOrder({
          _id: aliceOrderId,
          orderNumber: "ORD-ALICE-02",
          customer: customerAlice._id,
          status: "CONFIRMED",
          subtotal: 799,
          shippingFee: 0,
          tax: 121.88,
          totalAmount: 799,
          shippingAddress: {
            fullName: "Alice Sharma",
            phone: "9876543210",
            streetAddress: "123 MG Road",
            city: "Bengaluru",
            state: "KARNATAKA",
            pinCode: "560001",
          },
          orderItems: [
            {
              productId: "p1",
              productName: "Casual Shirt",
              unitPrice: 799,
              quantity: 1,
              lineTotal: 799,
            },
          ],
        });

        const res = await fetch(`http://localhost:${port}/api/v1/orders/${aliceOrderId}/invoice`, {
          headers: adminHeaders,
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.orderNumber, "ORD-ALICE-02");
      } finally {
        server.close();
      }
    });
  });

  describe("5. Historical Immutability Guarantee", () => {
    test("Once issued, subsequent invoice queries return the exact immutable snapshot", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const orderId = "64f1b2c3d4e5f6a7b8c90333";
        const initialOrder = {
          _id: orderId,
          orderNumber: "ORD-HIST-01",
          customer: customerAlice._id,
          status: "CONFIRMED",
          subtotal: 1500,
          shippingFee: 0,
          tax: 228.81,
          totalAmount: 1500,
          shippingAddress: {
            fullName: "Alice Sharma",
            phone: "9876543210",
            streetAddress: "Old Address",
            city: "Bengaluru",
            state: "KARNATAKA",
            pinCode: "560001",
          },
          orderItems: [
            {
              productId: "p10",
              productName: "Original Product",
              unitPrice: 1500,
              quantity: 1,
              lineTotal: 1500,
            },
          ],
        };
        _registerTestOrder(initialOrder);

        // 1st request issues invoice and saves snapshot
        const firstRes = await fetch(`http://localhost:${port}/api/v1/orders/${orderId}/invoice`, {
          headers: aliceHeaders,
        });
        const firstBody = await firstRes.json();
        const originalInvoiceNumber = firstBody.data.invoiceNumber;
        const originalInvoiceDate = firstBody.data.invoiceDate;

        // Simulate modifying order address or other parameters
        initialOrder.shippingAddress.streetAddress = "Tampered Address";
        initialOrder.subtotal = 99999;

        // 2nd request must return original immutable snapshot
        const secondRes = await fetch(`http://localhost:${port}/api/v1/orders/${orderId}/invoice`, {
          headers: aliceHeaders,
        });
        const secondBody = await secondRes.json();

        assert.strictEqual(secondBody.data.invoiceNumber, originalInvoiceNumber);
        assert.strictEqual(secondBody.data.invoiceDate, originalInvoiceDate);
        assert.strictEqual(secondBody.data.shippingAddress.addressLine1, "Old Address");
        assert.strictEqual(secondBody.data.totals.subtotal, 1500);
      } finally {
        server.close();
      }
    });
  });

  describe("6. Printable HTML Invoice Document", () => {
    test("GET /api/v1/orders/:id/invoice/html returns complete, styled HTML tax invoice", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const orderId = "64f1b2c3d4e5f6a7b8c90444";
        _registerTestOrder({
          _id: orderId,
          orderNumber: "ORD-HTML-01",
          customer: customerAlice._id,
          status: "CONFIRMED",
          subtotal: 1000,
          shippingFee: 0,
          tax: 152.54,
          totalAmount: 1000,
          shippingAddress: {
            fullName: "Alice Sharma",
            phone: "9876543210",
            streetAddress: "123 MG Road",
            city: "Bengaluru",
            state: "KARNATAKA",
            pinCode: "560001",
          },
          orderItems: [
            {
              productId: "p1",
              productName: "Casual Shirt",
              hsnCode: "6205",
              sku: "SKU-SHIRT-01",
              unitPrice: 1000,
              quantity: 1,
              lineTotal: 1000,
            },
          ],
        });

        const res = await fetch(`http://localhost:${port}/api/v1/orders/${orderId}/invoice/html`, {
          headers: aliceHeaders,
        });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.headers.get("content-type"), "text/html; charset=utf-8");
        const html = await res.text();

        assert.match(html, /TAX INVOICE/);
        assert.match(html, /SOLD BY \(SELLER\)/);
        assert.match(html, /BILL TO \(CUSTOMER\)/);
        assert.match(html, /HSN \/ SAC TAX SUMMARY/);
        assert.match(html, /Casual Shirt/);
        assert.match(html, /Amount in Words/);
      } finally {
        server.close();
      }
    });
  });

  describe("7. Order Cancellation Updates Invoice Status", () => {
    test("POST /api/v1/orders/:id/cancel marks invoiceStatus as CANCELLED", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const orderId = "64f1b2c3d4e5f6a7b8c90555";
        _registerTestOrder({
          _id: orderId,
          orderNumber: "ORD-CAN-01",
          customer: customerAlice._id,
          status: "CONFIRMED",
          invoiceStatus: "ISSUED",
          invoiceSnapshot: {
            invoiceNumber: "INV-2026-000999",
            invoiceStatus: "ISSUED",
          },
          subtotal: 500,
          totalAmount: 500,
          orderItems: [
            { productId: "p1", productName: "Item", unitPrice: 500, quantity: 1, lineTotal: 500 },
          ],
        });

        const cancelRes = await fetch(`http://localhost:${port}/api/v1/orders/${orderId}/cancel`, {
          method: "POST",
          headers: aliceHeaders,
          body: JSON.stringify({ reason: "Ordered by mistake" }),
        });

        assert.strictEqual(cancelRes.status, 200);

        // Fetch invoice to verify CANCELLED status
        const invRes = await fetch(`http://localhost:${port}/api/v1/orders/${orderId}/invoice`, {
          headers: aliceHeaders,
        });
        const invBody = await invRes.json();
        assert.strictEqual(invBody.data.invoiceStatus, "CANCELLED");
      } finally {
        server.close();
      }
    });
  });

  describe("8. Admin Invoice Listing Endpoint", () => {
    test("GET /api/v1/admin/invoices returns paginated invoice list for admin users", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/admin/invoices`, {
          headers: adminHeaders,
        });

        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert(Array.isArray(body.data.invoices));
        assert(body.data.totalInvoices !== undefined);
      } finally {
        server.close();
      }
    });

    test("GET /api/v1/admin/invoices rejects non-admin users with 403", async () => {
      const server = app.listen(0);
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/v1/admin/invoices`, {
          headers: aliceHeaders,
        });

        assert.strictEqual(res.status, 403);
      } finally {
        server.close();
      }
    });
  });
});

import mongoose from "mongoose";
import { Order } from "../models/order.model.js";
import { Payment } from "../models/payment.model.js";
import { AppConfig } from "../models/app_config.model.js";
import { InvoiceSequence } from "../models/invoice_sequence.model.js";
import { DEFAULT_APP_CONFIG } from "../controllers/app_config.controller.js";
import { round2, isInterStateTransaction } from "./tax.service.js";
import { ApiError } from "../utils/apiError.js";

// In-memory sequences for offline tests and non-MongoDB environments
const inMemorySequences = new Map();

/**
 * Format Indian Rupees in Words for GST compliance
 */
export const formatINRInWords = (amount) => {
  const num = Math.floor(Math.abs(amount));
  const paisa = Math.round((Math.abs(amount) - num) * 100);

  const units = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
  ];

  const convertTwoDigits = (n) => {
    if (n === 0) return "";
    if (n < 20) return units[n];
    const unit = n % 10;
    return `${tens[Math.floor(n / 10)]}${unit ? ` ${units[unit]}` : ""}`;
  };

  const convertThreeDigits = (n) => {
    const hundred = Math.floor(n / 100);
    const remainder = n % 100;
    let str = "";
    if (hundred > 0) {
      str += `${units[hundred]} Hundred`;
    }
    if (remainder > 0) {
      str += `${str ? " and " : ""}${convertTwoDigits(remainder)}`;
    }
    return str;
  };

  if (num === 0 && paisa === 0) return "Zero Rupees Only";

  let words = "";
  // Indian numbering: Crores, Lakhs, Thousands, Hundreds
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const remaining = num % 1000;

  if (crore > 0) words += `${convertTwoDigits(crore)} Crore `;
  if (lakh > 0) words += `${convertTwoDigits(lakh)} Lakh `;
  if (thousand > 0) words += `${convertTwoDigits(thousand)} Thousand `;
  if (remaining > 0) words += convertThreeDigits(remaining);

  words = words.trim() ? `${words.trim()} Rupees` : "";

  if (paisa > 0) {
    words += `${words ? " and " : ""}${convertTwoDigits(paisa)} Paise`;
  }

  return `${words} Only`;
};

export class InvoiceService {
  /**
   * Reset in-memory sequences (used by tests)
   */
  static _resetMemorySequences() {
    inMemorySequences.clear();
  }

  /**
   * Generate sequential, monotonic, collision-free invoice number: INV-YYYY-XXXXXX
   */
  static async generateNextInvoiceNumber(date = new Date()) {
    const year = date.getFullYear();

    if (mongoose.connection.readyState === 1) {
      const sequenceDoc = await InvoiceSequence.findOneAndUpdate(
        { year },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      const seqStr = String(sequenceDoc.seq).padStart(6, "0");
      return `INV-${year}-${seqStr}`;
    }

    // In-memory fallback
    const currentSeq = (inMemorySequences.get(year) || 0) + 1;
    inMemorySequences.set(year, currentSeq);
    const seqStr = String(currentSeq).padStart(6, "0");
    return `INV-${year}-${seqStr}`;
  }

  /**
   * Retrieve active seller business profile
   */
  static async getSellerDetails() {
    if (mongoose.connection.readyState === 1) {
      try {
        const config = await AppConfig.findOne({ configKey: "DEFAULT_CONFIG" }).lean();
        if (config?.commerce?.seller) {
          return config.commerce.seller;
        }
      } catch (err) {
        // Fallback to default
      }
    }
    return DEFAULT_APP_CONFIG.commerce.seller;
  }

  /**
   * Authoritatively build an immutable invoice object from an order snapshot.
   */
  static buildInvoiceSnapshot({
    order,
    sellerConfig,
    invoiceNumber,
    invoiceDate = new Date(),
    payment = null,
  }) {
    const originState = (sellerConfig.state || "KARNATAKA").trim().toUpperCase();
    const destinationState = (
      order.shippingAddress?.state ||
      order.taxBreakdown?.customerState ||
      originState
    )
      .trim()
      .toUpperCase();

    const isInterState =
      order.taxBreakdown?.isInterState !== undefined
        ? order.taxBreakdown.isInterState
        : isInterStateTransaction(destinationState);

    // 1. Process items preserving or calculating item-level GST breakdown
    const items = [];
    const taxSummaryMap = new Map();

    const orderDiscount = Number(order.discount || 0);
    const orderSubtotal = Number(order.subtotal || 0);

    for (const rawItem of order.orderItems || []) {
      const quantity = Number(rawItem.quantity || 1);
      const unitPrice = Number(rawItem.unitPrice || 0);
      const mrp = Number(rawItem.regularPrice || rawItem.mrp || unitPrice);
      const grossLineTotal = round2(unitPrice * quantity);

      // Flash sale or item-level discount
      let itemDiscount = Number(rawItem.discountAmount || 0);

      // If item-level discount is 0 but order has a coupon discount, allocate proportionally
      if (itemDiscount === 0 && orderDiscount > 0 && orderSubtotal > 0) {
        const itemShare = grossLineTotal / orderSubtotal;
        itemDiscount = round2(orderDiscount * itemShare);
      }

      const effectiveLineTotal = round2(Math.max(0, grossLineTotal - itemDiscount));
      const gstRate = Number(rawItem.gstRate !== undefined ? rawItem.gstRate : 18);
      const isTaxInclusive = rawItem.isTaxInclusive !== false;

      let taxableAmount = 0;
      let totalTax = 0;

      if (isTaxInclusive) {
        taxableAmount = round2(effectiveLineTotal / (1 + gstRate / 100));
        totalTax = round2(effectiveLineTotal - taxableAmount);
      } else {
        taxableAmount = effectiveLineTotal;
        totalTax = round2(taxableAmount * (gstRate / 100));
      }

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (isInterState) {
        cgst = 0;
        sgst = 0;
        igst = totalTax;
      } else {
        cgst = round2(totalTax / 2);
        sgst = round2(totalTax - cgst);
        igst = 0;
      }

      const hsnCode = rawItem.hsnCode || "8518";
      const sku = rawItem.sku || `SKU-${(rawItem.productId || rawItem._id || "").toString().slice(-6).toUpperCase() || "GEN"}`;

      const invoiceItem = {
        productId: (rawItem.productId || rawItem._id || "").toString(),
        productName: rawItem.productName || "Product",
        productImage: rawItem.productImage || "",
        sellerName: rawItem.sellerName || sellerConfig.tradeName,
        sku,
        hsnCode,
        quantity,
        mrp,
        unitPrice,
        discount: itemDiscount,
        effectiveAmount: effectiveLineTotal,
        taxableAmount,
        gstRate,
        isTaxInclusive,
        cgstRate: isInterState ? 0 : round2(gstRate / 2),
        cgst,
        sgstRate: isInterState ? 0 : round2(gstRate / 2),
        sgst,
        igstRate: isInterState ? gstRate : 0,
        igst,
        totalTax,
        lineTotal: isTaxInclusive ? effectiveLineTotal : round2(effectiveLineTotal + totalTax),
      };

      items.push(invoiceItem);

      // Aggregate for tax summary
      const taxKey = `${hsnCode}-${gstRate}`;
      if (!taxSummaryMap.has(taxKey)) {
        taxSummaryMap.set(taxKey, {
          hsnCode,
          gstRate,
          taxableAmount: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          totalTax: 0,
        });
      }
      const existing = taxSummaryMap.get(taxKey);
      existing.taxableAmount = round2(existing.taxableAmount + taxableAmount);
      existing.cgst = round2(existing.cgst + cgst);
      existing.sgst = round2(existing.sgst + sgst);
      existing.igst = round2(existing.igst + igst);
      existing.totalTax = round2(existing.totalTax + totalTax);
    }

    const taxSummary = Array.from(taxSummaryMap.values());

    // 2. Billing & Shipping Address extraction
    const rawBill = order.billingAddress || order.shippingAddress || {};
    const rawShip = order.shippingAddress || {};

    const billingAddress = {
      fullName: rawBill.fullName || "Customer",
      phone: rawBill.phone || "",
      addressLine1: rawBill.addressLine1 || rawBill.streetAddress || "",
      addressLine2: rawBill.addressLine2 || "",
      landmark: rawBill.landmark || "",
      city: rawBill.city || "",
      district: rawBill.district || "",
      state: rawBill.state || "",
      stateCode: rawBill.stateCode || "",
      pinCode: rawBill.pinCode || rawBill.postalCode || "",
      country: rawBill.country || "IN",
      gstin: rawBill.gstin || order.customerGstin || "",
    };

    const shippingAddress = {
      fullName: rawShip.fullName || "Customer",
      phone: rawShip.phone || "",
      addressLine1: rawShip.streetAddress || rawShip.addressLine1 || "",
      addressLine2: rawShip.addressLine2 || "",
      landmark: rawShip.landmark || "",
      city: rawShip.city || "",
      district: rawShip.district || "",
      state: rawShip.state || "",
      stateCode: rawShip.stateCode || "",
      pinCode: rawShip.pinCode || rawShip.postalCode || "",
      country: rawShip.country || "IN",
    };

    // 3. Totals
    const subtotal = Number(order.subtotal || 0);
    const discount = Number(order.discount || 0);
    const shippingFee = Number(order.shippingFee || 0);
    const codFee = Number(order.codFee || 0);
    const tax = Number(order.tax || 0);
    const grandTotal = Number(order.totalAmount || 0);

    const totals = {
      subtotal,
      discount,
      taxableAmount: Number(order.taxBreakdown?.taxableAmount || (subtotal - discount - tax)),
      cgst: Number(order.taxBreakdown?.cgst || 0),
      sgst: Number(order.taxBreakdown?.sgst || 0),
      igst: Number(order.taxBreakdown?.igst || 0),
      totalTax: tax,
      shippingFee,
      codFee,
      grandTotal,
      currency: order.currency || "INR",
      currencySymbol: "₹",
      amountInWords: formatINRInWords(grandTotal),
    };

    // 4. Payment metadata
    const paymentMethod = payment?.paymentMethod || order.payment?.paymentMethod || (order.codFee > 0 ? "COD" : "CARD");
    const paymentStatus = payment?.status || order.payment?.status || (paymentMethod === "COD" ? "PENDING" : "COMPLETED");

    return {
      invoiceNumber,
      invoiceDate: (invoiceDate instanceof Date ? invoiceDate : new Date(invoiceDate)).toISOString(),
      invoiceStatus: order.status === "CANCELLED" ? "CANCELLED" : "ISSUED",
      orderId: (order._id || "").toString(),
      orderNumber: order.orderNumber,
      orderDate: (order.createdAt ? new Date(order.createdAt) : new Date()).toISOString(),
      seller: {
        legalName: sellerConfig.legalName,
        tradeName: sellerConfig.tradeName,
        address: sellerConfig.address,
        city: sellerConfig.city,
        district: sellerConfig.district,
        state: sellerConfig.state,
        stateCode: sellerConfig.stateCode,
        pinCode: sellerConfig.pinCode,
        country: sellerConfig.country,
        gstin: sellerConfig.gstin,
        pan: sellerConfig.pan,
        phone: sellerConfig.phone,
        email: sellerConfig.email,
        cin: sellerConfig.cin,
      },
      billingAddress,
      shippingAddress,
      customerGstin: order.customerGstin || billingAddress.gstin || "",
      isInterState,
      items,
      taxSummary,
      shipping: {
        method: order.shippingMethod || "STANDARD",
        methodName: order.shippingDetails?.methodName || "Standard Delivery",
        shippingAmount: shippingFee,
        shippingZone: order.shippingDetails?.shippingZone || "NATIONAL",
        destinationPinCode: order.shippingDetails?.destinationPinCode || shippingAddress.pinCode,
        isFreeShipping: Boolean(order.shippingDetails?.isFreeShipping || shippingFee === 0),
      },
      cod: {
        isCod: paymentMethod === "COD",
        fee: codFee,
      },
      payment: {
        method: paymentMethod,
        status: paymentStatus,
        transactionId: payment?.transactionId || order.payment?.transactionId || "",
        provider: payment?.provider || order.payment?.provider || (paymentMethod === "COD" ? "COD" : "SIMULATED"),
      },
      totals,
    };
  }

  /**
   * Issue or retrieve the authoritative invoice for an order.
   * If already issued, returns the immutable stored snapshot.
   * If not issued, generates invoice number, builds snapshot, and persists.
   */
  static async issueOrGetInvoice(orderId) {
    let order = null;

    if (mongoose.connection.readyState === 1) {
      order = await Order.findById(orderId).populate("payment");
      if (!order) {
        throw new ApiError(404, "Order not found");
      }

      // If invoice is already issued and snapshot is stored, return immediately for historical immutability
      if (order.invoiceSnapshot && order.invoiceStatus === "ISSUED") {
        return order.invoiceSnapshot;
      }

      const sellerConfig = await InvoiceService.getSellerDetails();
      const invoiceNumber = order.invoiceNumber || (await InvoiceService.generateNextInvoiceNumber());
      const invoiceDate = order.invoiceDate || new Date();

      const snapshot = InvoiceService.buildInvoiceSnapshot({
        order,
        sellerConfig,
        invoiceNumber,
        invoiceDate,
        payment: order.payment,
      });

      order.invoiceNumber = invoiceNumber;
      order.invoiceDate = invoiceDate;
      order.invoiceStatus = order.status === "CANCELLED" ? "CANCELLED" : "ISSUED";
      order.invoiceSnapshot = snapshot;
      await order.save();

      return snapshot;
    }

    // In-memory / Offline fallback
    const { inMemoryOrders } = await import("../controllers/order.controller.js");
    order = inMemoryOrders.get(orderId);
    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    if (order.invoiceSnapshot && order.invoiceStatus === "ISSUED") {
      return order.invoiceSnapshot;
    }

    const sellerConfig = await InvoiceService.getSellerDetails();
    const invoiceNumber = order.invoiceNumber || (await InvoiceService.generateNextInvoiceNumber());
    const invoiceDate = order.invoiceDate || new Date();

    const snapshot = InvoiceService.buildInvoiceSnapshot({
      order,
      sellerConfig,
      invoiceNumber,
      invoiceDate,
      payment: order.payment,
    });

    order.invoiceNumber = invoiceNumber;
    order.invoiceDate = invoiceDate;
    order.invoiceStatus = order.status === "CANCELLED" ? "CANCELLED" : "ISSUED";
    order.invoiceSnapshot = snapshot;
    inMemoryOrders.set(orderId, order);

    return snapshot;
  }

  /**
   * Render GST compliant printable HTML invoice
   */
  static generateInvoiceHtml(invoice) {
    const formattedDate = new Date(invoice.invoiceDate).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });

    const itemRows = invoice.items
      .map(
        (item, idx) => `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td>
            <strong>${item.productName}</strong><br/>
            <small style="color: #666;">SKU: ${item.sku}</small>
          </td>
          <td style="text-align: center;">${item.hsnCode}</td>
          <td style="text-align: center;">${item.quantity}</td>
          <td style="text-align: right;">₹${item.unitPrice.toFixed(2)}</td>
          <td style="text-align: right;">₹${item.discount.toFixed(2)}</td>
          <td style="text-align: right;">₹${item.taxableAmount.toFixed(2)}</td>
          <td style="text-align: center;">${item.gstRate}%</td>
          <td style="text-align: right;">₹${(item.cgst + item.sgst + item.igst).toFixed(2)}</td>
          <td style="text-align: right;"><strong>₹${item.lineTotal.toFixed(2)}</strong></td>
        </tr>`
      )
      .join("");

    const taxSummaryRows = invoice.taxSummary
      .map(
        (tax) => `
        <tr>
          <td style="text-align: center;">${tax.hsnCode}</td>
          <td style="text-align: right;">₹${tax.taxableAmount.toFixed(2)}</td>
          <td style="text-align: center;">${tax.gstRate}%</td>
          <td style="text-align: right;">₹${tax.cgst.toFixed(2)}</td>
          <td style="text-align: right;">₹${tax.sgst.toFixed(2)}</td>
          <td style="text-align: right;">₹${tax.igst.toFixed(2)}</td>
          <td style="text-align: right;"><strong>₹${tax.totalTax.toFixed(2)}</strong></td>
        </tr>`
      )
      .join("");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice - ${invoice.invoiceNumber}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 24px;
      color: #1a1a1a;
      background: #fdfdfd;
      font-size: 13px;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 32px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.03);
    }
    .header {
      display: flex;
      justify-content: space-between;
      border-bottom: 2px solid #000;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
    }
    .badge-issued { background: #e6f4ea; color: #137333; }
    .badge-cancelled { background: #fce8e6; color: #c5221f; }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }
    .card {
      background: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 6px;
      padding: 14px;
    }
    .card h4 { margin: 0 0 8px 0; font-size: 13px; color: #333; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 12px;
    }
    th {
      background: #f1f3f4;
      color: #333;
      padding: 8px;
      border: 1px solid #e0e0e0;
      font-weight: 600;
    }
    td {
      padding: 8px;
      border: 1px solid #e0e0e0;
    }
    .totals-table {
      width: 320px;
      margin-left: auto;
      margin-bottom: 20px;
    }
    .totals-table td {
      border: none;
      padding: 4px 8px;
    }
    .totals-table tr.grand-total {
      font-size: 14px;
      font-weight: 700;
      border-top: 2px solid #333;
      border-bottom: 2px solid #333;
    }
    .footer {
      border-top: 1px solid #e0e0e0;
      padding-top: 16px;
      text-align: center;
      color: #777;
      font-size: 11px;
    }
    @media print {
      body { padding: 0; background: #fff; }
      .invoice-container { border: none; box-shadow: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div>
        <h2 style="margin: 0 0 4px 0; color: #1a73e8;">TAX INVOICE</h2>
        <span class="badge ${invoice.invoiceStatus === "CANCELLED" ? "badge-cancelled" : "badge-issued"}">${invoice.invoiceStatus}</span>
        <p style="margin: 8px 0 0 0; color: #555;">(Original for Recipient • GST Rules, 2017)</p>
      </div>
      <div style="text-align: right;">
        <p style="margin: 2px 0;"><strong>Invoice No:</strong> ${invoice.invoiceNumber}</p>
        <p style="margin: 2px 0;"><strong>Invoice Date:</strong> ${formattedDate}</p>
        <p style="margin: 2px 0;"><strong>Order No:</strong> ${invoice.orderNumber}</p>
        <p style="margin: 2px 0;"><strong>Payment Method:</strong> ${invoice.payment.method} (${invoice.payment.status})</p>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h4>SOLD BY (SELLER):</h4>
        <strong>${invoice.seller.legalName}</strong><br/>
        Trade Name: ${invoice.seller.tradeName}<br/>
        ${invoice.seller.address}, ${invoice.seller.city}<br/>
        ${invoice.seller.state} - ${invoice.seller.pinCode}, ${invoice.seller.country}<br/>
        <strong>GSTIN:</strong> ${invoice.seller.gstin}<br/>
        <strong>PAN:</strong> ${invoice.seller.pan}<br/>
        Email: ${invoice.seller.email} | Phone: ${invoice.seller.phone}
      </div>
      <div class="card">
        <h4>BILL TO (CUSTOMER):</h4>
        <strong>${invoice.billingAddress.fullName}</strong><br/>
        ${invoice.billingAddress.addressLine1} ${invoice.billingAddress.addressLine2}<br/>
        ${invoice.billingAddress.city}, ${invoice.billingAddress.state} - ${invoice.billingAddress.pinCode}<br/>
        Phone: ${invoice.billingAddress.phone}<br/>
        ${invoice.customerGstin ? `<strong>Customer GSTIN:</strong> ${invoice.customerGstin}<br/>` : "<strong>Customer Type:</strong> Unregistered Consumer<br/>"}
        <strong>Place of Supply:</strong> ${invoice.shippingAddress.state} (${invoice.isInterState ? "Inter-State / IGST" : "Intra-State / CGST + SGST"})
      </div>
    </div>

    <h4 style="margin-bottom: 8px;">ITEMS & TAX BREAKDOWN</h4>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Product & SKU</th>
          <th>HSN</th>
          <th>Qty</th>
          <th>Price</th>
          <th>Disc</th>
          <th>Taxable</th>
          <th>GST</th>
          <th>Tax Amount</th>
          <th>Line Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      <div style="width: 55%;">
        <h4 style="margin-bottom: 6px;">HSN / SAC TAX SUMMARY</h4>
        <table>
          <thead>
            <tr>
              <th>HSN</th>
              <th>Taxable</th>
              <th>Rate</th>
              <th>CGST</th>
              <th>SGST</th>
              <th>IGST</th>
              <th>Total Tax</th>
            </tr>
          </thead>
          <tbody>
            ${taxSummaryRows}
          </tbody>
        </table>
        <p style="font-size: 11px; color: #555; margin-top: 4px;">
          <strong>Amount in Words:</strong><br/>
          ${invoice.totals.amountInWords}
        </p>
      </div>

      <div style="width: 40%;">
        <table class="totals-table">
          <tr>
            <td>Items Subtotal:</td>
            <td style="text-align: right;">₹${invoice.totals.subtotal.toFixed(2)}</td>
          </tr>
          ${invoice.totals.discount > 0 ? `
          <tr>
            <td>Promotion / Coupon Discount:</td>
            <td style="text-align: right; color: #d93025;">-₹${invoice.totals.discount.toFixed(2)}</td>
          </tr>` : ""}
          <tr>
            <td>Net Taxable Value:</td>
            <td style="text-align: right;">₹${invoice.totals.taxableAmount.toFixed(2)}</td>
          </tr>
          ${!invoice.isInterState ? `
          <tr>
            <td>CGST:</td>
            <td style="text-align: right;">₹${invoice.totals.cgst.toFixed(2)}</td>
          </tr>
          <tr>
            <td>SGST:</td>
            <td style="text-align: right;">₹${invoice.totals.sgst.toFixed(2)}</td>
          </tr>` : `
          <tr>
            <td>IGST:</td>
            <td style="text-align: right;">₹${invoice.totals.igst.toFixed(2)}</td>
          </tr>`}
          <tr>
            <td>Shipping Fee (${invoice.shipping.methodName}):</td>
            <td style="text-align: right;">${invoice.totals.shippingFee === 0 ? '<span style="color:#137333;">FREE</span>' : `₹${invoice.totals.shippingFee.toFixed(2)}`}</td>
          </tr>
          ${invoice.totals.codFee > 0 ? `
          <tr>
            <td>Cash on Delivery (COD) Fee:</td>
            <td style="text-align: right;">₹${invoice.totals.codFee.toFixed(2)}</td>
          </tr>` : ""}
          <tr class="grand-total">
            <td>Invoice Grand Total:</td>
            <td style="text-align: right;">₹${invoice.totals.grandTotal.toFixed(2)}</td>
          </tr>
        </table>
      </div>
    </div>

    <div class="footer">
      <p>This is a computer-generated tax invoice and requires no physical signature under the Indian Information Technology Act, 2000.</p>
      <p>${invoice.seller.legalName} • CIN: ${invoice.seller.cin} • Registered Office: ${invoice.seller.address}, ${invoice.seller.city}, ${invoice.seller.state} - ${invoice.seller.pinCode}</p>
    </div>
  </div>
</body>
</html>`;
  }
}

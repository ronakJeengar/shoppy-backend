/**
 * Tax & GST Calculation Engine for Shoppy India
 * Authoritative backend calculation for GST, CGST, SGST, IGST, and taxable amounts.
 */

export const SUPPORTED_GST_RATES = [0, 5, 12, 18, 28];

export const getStoreOriginState = () => {
  return (process.env.STORE_ORIGIN_STATE || "KARNATAKA").trim().toUpperCase();
};

export const round2 = (num) => {
  return Math.round((Number(num || 0) + Number.EPSILON) * 100) / 100;
};

/**
 * Check if the customer shipping state is inter-state relative to store origin.
 */
export const isInterStateTransaction = (customerState) => {
  if (!customerState || typeof customerState !== "string") {
    return false; // Default to intra-state if unknown or local
  }
  const cleanCustomer = customerState.trim().toUpperCase();
  const cleanOrigin = getStoreOriginState();
  return cleanCustomer !== cleanOrigin;
};

/**
 * Calculate tax for a single line item.
 * Supports both tax-inclusive (consumer MRP) and tax-exclusive pricing.
 */
export const calculateLineItemTax = ({
  unitPrice = 0,
  quantity = 1,
  gstRate = 18,
  isTaxInclusive = true,
  discount = 0,
}) => {
  const cleanRate = SUPPORTED_GST_RATES.includes(Number(gstRate))
    ? Number(gstRate)
    : 18;

  const grossLineTotal = round2(Number(unitPrice) * Number(quantity));
  const effectiveAmount = round2(Math.max(0, grossLineTotal - Number(discount)));

  let taxableAmount = 0;
  let totalTax = 0;

  if (isTaxInclusive) {
    // Taxable Value = Inclusive Amount / (1 + rate / 100)
    taxableAmount = round2(effectiveAmount / (1 + cleanRate / 100));
    totalTax = round2(effectiveAmount - taxableAmount);
  } else {
    // Taxable Value = Base Amount, Tax added on top
    taxableAmount = effectiveAmount;
    totalTax = round2(taxableAmount * (cleanRate / 100));
  }

  return {
    grossLineTotal,
    effectiveAmount,
    taxableAmount,
    totalTax,
    gstRate: cleanRate,
    isTaxInclusive: Boolean(isTaxInclusive),
  };
};

/**
 * Authoritative Order & Cart Tax Calculation Pipeline
 * Follows strict order: Product Prices -> Discount -> Taxable Amount -> GST -> Shipping -> Grand Total
 */
export const calculateOrderTax = ({
  items = [],
  customerState = "KARNATAKA",
  shippingFee = 0,
  discount = 0,
}) => {
  const originState = getStoreOriginState();
  const isInterState = isInterStateTransaction(customerState);

  let subtotal = 0;
  let taxableAmount = 0;
  let totalTax = 0;
  let hasExclusiveItems = false;

  const itemBreakdowns = items.map((item) => {
    const unitPrice = Number(item.unitPrice || item.price || 0);
    const quantity = Number(item.quantity || 1);
    const gstRate = item.gstRate !== undefined ? Number(item.gstRate) : 18;
    const isTaxInclusive =
      item.isTaxInclusive !== undefined ? Boolean(item.isTaxInclusive) : true;

    if (!isTaxInclusive) {
      hasExclusiveItems = true;
    }

    const calc = calculateLineItemTax({
      unitPrice,
      quantity,
      gstRate,
      isTaxInclusive,
      discount: 0, // line-level discount if applicable
    });

    subtotal = round2(subtotal + calc.grossLineTotal);
    taxableAmount = round2(taxableAmount + calc.taxableAmount);
    totalTax = round2(totalTax + calc.totalTax);

    return {
      productId: item.productId || item._id,
      productName: item.productName || item.name || "Product",
      unitPrice,
      quantity,
      lineTotal: calc.grossLineTotal,
      hsnCode: item.hsnCode || "8518",
      gstRate: calc.gstRate,
      isTaxInclusive: calc.isTaxInclusive,
      taxableAmount: calc.taxableAmount,
      tax: calc.totalTax,
    };
  });

  // If order-level discount is present and was not itemized, adjust taxable value proportionally
  const totalDiscount = round2(discount);
  if (totalDiscount > 0 && subtotal > 0) {
    const discountRatio = Math.min(1, totalDiscount / subtotal);
    taxableAmount = round2(taxableAmount * (1 - discountRatio));
    totalTax = round2(totalTax * (1 - discountRatio));
  }

  // Split tax according to GST rules:
  // Intra-State: CGST (50%) + SGST (50%), IGST = 0
  // Inter-State: IGST (100%), CGST = 0, SGST = 0
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (isInterState) {
    cgst = 0;
    sgst = 0;
    igst = totalTax;
  } else {
    cgst = round2(totalTax / 2);
    sgst = round2(totalTax - cgst); // prevents 1-paisa discrepancies
    igst = 0;
  }

  const cleanShipping = round2(shippingFee);

  // Grand Total calculation
  // If items are inclusive: subtotal - discount + shipping
  // If items are exclusive: taxableAmount + totalTax + shipping
  let grandTotal = 0;
  if (hasExclusiveItems) {
    grandTotal = round2(taxableAmount + totalTax + cleanShipping);
  } else {
    grandTotal = round2(subtotal - totalDiscount + cleanShipping);
  }

  return {
    currency: "INR",
    currencySymbol: "₹",
    subtotal,
    discount: totalDiscount,
    taxableAmount,
    taxBreakdown: {
      taxableAmount,
      cgst,
      sgst,
      igst,
      totalTax,
      isInterState,
      originState,
      customerState: (customerState || "").trim().toUpperCase(),
    },
    tax: totalTax, // backward-compatible alias
    shippingFee: cleanShipping,
    grandTotal,
    itemBreakdowns,
  };
};

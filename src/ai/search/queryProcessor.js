/**
 * Rule-based natural language search query processor.
 * Extracts deterministic structured constraints (budget, price range, stock availability)
 * and isolates the semantic search text query without incurring LLM latency or cost.
 */

export class QueryProcessor {
  /**
   * Parses a raw customer search query.
   * @param {string} rawQuery
   * @returns {Object} processed query with extracted constraints
   */
  static process(rawQuery) {
    if (!rawQuery || typeof rawQuery !== "string") {
      return {
        rawQuery: "",
        cleanQuery: "",
        semanticQuery: "",
        extractedFilters: {},
        hasStructuredConstraints: false,
      };
    }

    const trimmed = rawQuery.trim();
    let working = trimmed;
    const extractedFilters = {};

    // 1. Detect In-Stock / Availability Intent
    const inStockPattern = /\b(?:in\s*stock|available(?:\s+now)?)\b/i;
    if (inStockPattern.test(working)) {
      extractedFilters.inStock = true;
      working = working.replace(inStockPattern, " ");
    }

    // 2. Detect Price Range: "between X and Y"
    const rangePattern = /\b(?:between|from)\s*(?:[₹$€£]|rs\.?|inr|usd)?\s*(\d+(?:\.\d{1,2})?)\s*(?:and|to|-)\s*(?:[₹$€£]|rs\.?|inr|usd)?\s*(\d+(?:\.\d{1,2})?)\b/i;
    const rangeMatch = working.match(rangePattern);
    if (rangeMatch) {
      const p1 = parseFloat(rangeMatch[1]);
      const p2 = parseFloat(rangeMatch[2]);
      if (!isNaN(p1) && !isNaN(p2)) {
        extractedFilters.minPrice = Math.min(p1, p2);
        extractedFilters.maxPrice = Math.max(p1, p2);
        working = working.replace(rangePattern, " ");
      }
    }

    // 3. Detect Upper Bound (maxPrice): "under 3000", "below $100", "less than 50", "upto 200", "budget 500"
    if (extractedFilters.maxPrice === undefined) {
      const maxPattern = /\b(?:under|below|less\s+than|upto|budget(?:\s+of)?|max)\s*(?:[₹$€£]|rs\.?|inr|usd)?\s*(\d+(?:\.\d{1,2})?)\b/i;
      const maxMatch = working.match(maxPattern);
      if (maxMatch) {
        const val = parseFloat(maxMatch[1]);
        if (!isNaN(val) && val > 0) {
          extractedFilters.maxPrice = val;
          working = working.replace(maxPattern, " ");
        }
      }
    }

    // 4. Detect Lower Bound (minPrice): "above 500", "over 100", "more than 20", "min 50"
    if (extractedFilters.minPrice === undefined) {
      const minPattern = /\b(?:above|over|more\s+than|min|starting\s+(?:at|from))\s*(?:[₹$€£]|rs\.?|inr|usd)?\s*(\d+(?:\.\d{1,2})?)\b/i;
      const minMatch = working.match(minPattern);
      if (minMatch) {
        const val = parseFloat(minMatch[1]);
        if (!isNaN(val) && val >= 0) {
          extractedFilters.minPrice = val;
          working = working.replace(minPattern, " ");
        }
      }
    }

    // 5. Clean up remaining query text for semantic retrieval
    const cleanQuery = working
      .replace(/[₹$€£]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const hasStructuredConstraints = Object.keys(extractedFilters).length > 0;

    return {
      rawQuery: trimmed,
      cleanQuery,
      semanticQuery: cleanQuery || trimmed,
      extractedFilters,
      hasStructuredConstraints,
    };
  }
}

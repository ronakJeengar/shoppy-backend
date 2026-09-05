/**
 * Generates a deterministic, privacy-safe text representation of a product
 * for vector embedding and semantic indexing.
 *
 * Explicitly EXCLUDES volatile commercial data (current price, stock, discounts)
 * and internal/private fields (costs, suppliers, margins).
 */

export const buildProductDocument = (product) => {
  if (!product || typeof product !== "object") {
    return "";
  }

  const name = (product.productName || product.name || "").trim();
  const description = (product.description || "").trim();
  const seller = (product.sellerName || product.brand || "").trim();

  let categoryName = "";
  if (product.category) {
    if (typeof product.category === "string") {
      categoryName = product.category.trim();
    } else if (typeof product.category === "object" && product.category.name) {
      categoryName = product.category.name.trim();
    }
  }

  const sections = [];
  if (name) sections.push(`Product: ${name}`);
  if (categoryName) sections.push(`Category: ${categoryName}`);
  if (seller) sections.push(`Brand: ${seller}`);
  if (description) sections.push(`Description: ${description}`);

  return sections.join("\n");
};

/**
 * Extracts searchable text tokens from a product for lexical matching.
 */
export const extractProductKeywords = (product) => {
  const doc = buildProductDocument(product).toLowerCase();
  // Remove non-alphanumeric characters except spaces
  const clean = doc.replace(/[^a-z0-9\s]/g, " ");
  const tokens = clean
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .filter((t) => !["product", "category", "brand", "description", "and", "the", "for", "with"].includes(t));
  return Array.from(new Set(tokens));
};

import { computeContentHash } from "./documentValidator.js";

/**
 * Splits raw document content into semantic, bounded chunks.
 * Recognizes markdown headings (##, ###), FAQ Q&A patterns, and paragraph breaks.
 */
export function chunkDocument({
  documentId,
  title,
  content,
  sourceType = "POLICY",
  visibility = "PUBLIC",
  version = 1,
  chunkSize = 500,
  chunkOverlap = 60,
  metadata = {},
} = {}) {
  if (!content || typeof content !== "string") return [];

  const rawSections = [];
  const lines = content.split("\n");

  let currentHeading = title;
  let currentLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(
      /^(?:#{1,4}\s+|(?:\*\*)?(?:Q(?:uestion)?:|Section\s+\d+:))(.+?)(?:\*\*)?$/i
    );

    if (headingMatch) {
      const sectionText = currentLines.join("\n").trim();
      if (sectionText) {
        rawSections.push({
          sectionTitle: currentHeading,
          text: sectionText,
        });
      }
      const rawTitle = headingMatch[1].trim().replace(/\*\*/g, "");
      currentHeading = rawTitle ? `${title} — ${rawTitle}` : title;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }


  if (currentLines.length > 0) {
    const sectionText = currentLines.join("\n").trim();
    if (sectionText) {
      rawSections.push({
        sectionTitle: currentHeading,
        text: sectionText,
      });
    }
  }

  // If no headings were found, treat entire content as single section
  if (rawSections.length === 0) {
    rawSections.push({
      sectionTitle: title,
      text: content.trim(),
    });
  }

  const chunks = [];
  let chunkIndex = 0;

  for (const sec of rawSections) {
    const text = sec.text;

    // If section fits comfortably within chunk size
    if (text.length <= chunkSize) {
      chunks.push({
        chunkId: `${documentId}_chunk_${chunkIndex}`,
        chunkIndex,
        title: sec.sectionTitle,
        content: text,
        contentHash: computeContentHash(text),
        metadata: {
          ...metadata,
          section: sec.sectionTitle,
          sourceType,
          visibility,
          version,
        },
      });
      chunkIndex++;
    } else {
      // Split section with overlap along sentence / paragraph boundaries
      let start = 0;
      while (start < text.length) {
        let end = start + chunkSize;

        // Try not to cut in middle of sentence or word
        if (end < text.length) {
          const lastPeriod = text.lastIndexOf(". ", end);
          const lastNewline = text.lastIndexOf("\n", end);
          const breakPoint = Math.max(lastPeriod + 1, lastNewline);

          if (breakPoint > start + Math.floor(chunkSize * 0.5)) {
            end = breakPoint;
          }
        } else {
          end = text.length;
        }

        const chunkSlice = text.slice(start, end).trim();
        if (chunkSlice.length > 20) {
          chunks.push({
            chunkId: `${documentId}_chunk_${chunkIndex}`,
            chunkIndex,
            title: sec.sectionTitle,
            content: chunkSlice,
            contentHash: computeContentHash(chunkSlice),
            metadata: {
              ...metadata,
              section: sec.sectionTitle,
              sourceType,
              visibility,
              version,
            },
          });
          chunkIndex++;
        }

        if (end >= text.length) break;
        start = end - chunkOverlap;
      }
    }
  }

  return chunks;
}

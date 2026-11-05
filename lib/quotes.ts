// Finding AI citations inside the source documents. Shared by the server (to verify
// every quote is real) and the browser (to highlight it and open the right document).
// Matching ignores case and whitespace differences, nothing else.

export type QuotableDocument = { id: string; title: string; text: string };

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findQuote(text: string, quote: string): { start: number; end: number } | null {
  const pattern = quote.trim().split(/\s+/).map(escapeRegex).join("\\s+");
  if (!pattern) return null;
  const m = new RegExp(pattern, "i").exec(text);
  return m ? { start: m.index, end: m.index + m[0].length } : null;
}

// Which document in the packet contains this quote, or null if none (unverified).
export function locateQuote<D extends QuotableDocument>(quote: string, docs: D[]): D | null {
  return docs.find((d) => findQuote(d.text, quote)) ?? null;
}

// How the packet is shown to the model: each document tagged with id and title.
export function packetForPrompt(docs: (QuotableDocument & { kind?: string; date?: string })[]): string {
  return docs
    .map(
      (d) =>
        `<document id="${d.id}" title="${d.title}"${d.kind ? ` kind="${d.kind}"` : ""}${d.date ? ` date="${d.date}"` : ""}>\n${d.text.trim()}\n</document>`
    )
    .join("\n\n");
}

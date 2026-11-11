export type ShareBook = { title: string; author: string; cover?: string | null; href: string };
export type ShareCard = { book: ShareBook; rating?: number | null; readerName?: string };

export function safeCoverUrl(value: string | null): string | null {
  if (!value || value.length > 2000) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const openLibrary = url.hostname === "covers.openlibrary.org" && /^\/b\/(id|isbn)\/[\w-]+\.(jpg|jpeg|png)$/.test(url.pathname);
    const google = ["books.google.com", "books.googleusercontent.com"].includes(url.hostname) && url.pathname === "/books/content";
    return openLibrary || google ? url.href : null;
  } catch { return null; }
}

export function shareFilename(title: string) {
  const name = title.normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 60);
  return `aepilog-${name || "book"}.png`;
}

function lines(context: CanvasRenderingContext2D, text: string, width: number, maxLines: number) {
  const result: string[] = []; let line = "";
  for (const word of text.replace(/\s+/g, " ").trim().split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width <= width) { line = next; continue; }
    if (line) result.push(line);
    line = "";
    // Long words and titles without spaces still wrap within the card.
    for (const character of Array.from(word)) {
      if (context.measureText(line + character).width > width && line) { result.push(line); line = character; }
      else line += character;
    }
  }
  if (line) result.push(line.trim());
  if (result.length > maxLines) {
    result.length = maxLines;
    let last = result[maxLines - 1];
    while (context.measureText(last + "…").width > width) last = Array.from(last).slice(0, -1).join("");
    result[maxLines - 1] = last.trimEnd() + "…";
  }
  return result;
}

export async function createShareCard({ book, rating, readerName }: ShareCard): Promise<Blob> {
  await document.fonts.ready;
  const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1920;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not create the card.");
  const serif = getComputedStyle(document.body).getPropertyValue("--font-serif").trim() || "Georgia";
  const sans = getComputedStyle(document.body).getPropertyValue("--font-sans").trim() || "Arial";
  context.fillStyle = "#faf6ef"; context.fillRect(0, 0, 1080, 1920);
  context.strokeStyle = "#e6d8d4"; context.lineWidth = 2; context.strokeRect(48, 48, 984, 1824);
  context.textAlign = "center"; context.textBaseline = "middle";
  context.fillStyle = "#8f2635"; context.font = `500 94px ${serif}`; context.fillText("aepilog", 540, 186);
  context.font = `400 24px ${sans}`; context.fillStyle = "#756866"; context.fillText("a little chapter of my reading life", 540, 266);
  context.fillStyle = "#f6e8e6"; context.beginPath(); context.ellipse(540, 730, 366, 400, 0, 0, Math.PI * 2); context.fill();

  let image: HTMLImageElement | null = null;
  const cover = safeCoverUrl(book.cover || null);
  if (cover) {
    let url: string | null = null;
    try {
      const response = await fetch(`/api/share-cover?${new URLSearchParams({ url: cover })}`, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        const blob = await response.blob(); url = URL.createObjectURL(blob);
        image = new Image(); image.src = url; await image.decode();
      }
    } catch { image = null; }
    finally { if (url) URL.revokeObjectURL(url); }
  }
  context.save(); context.shadowColor = "#2d262530"; context.shadowBlur = 35; context.shadowOffsetY = 22;
  if (image) {
    const scale = Math.min(420 / image.naturalWidth, 620 / image.naturalHeight);
    const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
    context.drawImage(image, (1080 - width) / 2, 730 - height / 2, width, height);
  } else {
    context.fillStyle = "#8f2635"; context.fillRect(330, 420, 420, 620);
    context.shadowColor = "transparent"; context.strokeStyle = "#ebcfd0"; context.strokeRect(350, 440, 380, 580);
    context.fillStyle = "#fffdf9"; context.font = `500 44px ${serif}`;
    const coverLines = lines(context, book.title.slice(0, 200), 310, 6);
    coverLines.forEach((line, index) => context.fillText(line, 540, 730 + (index - (coverLines.length - 1) / 2) * 54));
  }
  context.restore();
  context.fillStyle = "#2d2625"; context.font = `500 ${book.title.length > 65 ? 58 : 72}px ${serif}`;
  const titleLines = lines(context, book.title.slice(0, 240), 830, 3);
  titleLines.forEach((line, index) => context.fillText(line, 540, 1182 + index * 82));
  const authorY = 1182 + titleLines.length * 82 + 8;
  context.font = `400 32px ${sans}`; context.fillStyle = "#756866";
  lines(context, book.author.slice(0, 140), 820, 2).forEach((line, index) => context.fillText(line, 540, authorY + index * 42));

  if (typeof rating === "number" && Number.isFinite(rating) && rating >= 1 && rating <= 5) {
    context.fillStyle = "#8f2635"; context.font = `500 76px ${serif}`; context.fillText(`${rating.toFixed(1)} / 5`, 540, 1590);
    context.fillStyle = "#756866"; context.font = `400 28px ${sans}`;
    context.fillText("my rating" + (readerName ? ` · ${readerName.slice(0, 24)}` : ""), 540, 1660);
  } else {
    context.fillStyle = "#8f2635"; context.font = `500 46px ${serif}`; context.fillText("Between the covers", 540, 1610);
  }
  context.strokeStyle = "#e6d8d4"; context.beginPath(); context.moveTo(400, 1750); context.lineTo(680, 1750); context.stroke();
  context.fillStyle = "#8f2635"; context.font = `400 28px ${sans}`; context.fillText("aepilog.com", 540, 1808);
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not create the card.")), "image/png"));
}

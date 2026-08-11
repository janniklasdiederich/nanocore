import type { Editor, TLShapeId } from "tldraw";
import {
  renderPlaintextFromRichText,
  renderRichTextFromHTML,
} from "tldraw";

/** Detect common markdown that still appears as plain text. */
export function looksLikeMarkdown(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return (
    /^#{1,6}\s+\S/m.test(t) ||
    /^\s*[-*+]\s+\S/m.test(t) ||
    /^\s*\d+\.\s+\S/m.test(t) ||
    /\*\*[^*\n]+\*\*/.test(t) ||
    /__[^_\n]+__/.test(t) ||
    /(^|[^*])\*[^*\n]+\*(?!\*)/.test(t) ||
    /(^|[^_])_[^_\n]+_(?!_)/.test(t) ||
    /`[^`\n]+`/.test(t) ||
    /\[[^\]]+\]\([^)]+\)/.test(t) ||
    /^>\s+\S/m.test(t)
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Minimal markdown → HTML for common board-note syntax. */
export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      out.push("</ol>");
      inOl = false;
    }
  };

  const inline = (s: string): string => {
    let r = escapeHtml(s);
    r = r.replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2">$1</a>',
    );
    r = r.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    r = r.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    r = r.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
    r = r.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");
    r = r.replace(/`([^`]+)`/g, "<code>$1</code>");
    return r;
  };

  for (const line of lines) {
    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      closeLists();
      const level = Math.min(h[1]!.length, 3);
      out.push(`<h${level}>${inline(h[2]!)}</h${level}>`);
      continue;
    }

    const ul = line.match(/^\s*[-*+]\s+(.+)$/);
    if (ul) {
      if (inOl) {
        out.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${inline(ul[1]!)}</li>`);
      continue;
    }

    const ol = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ol) {
      if (inUl) {
        out.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        out.push("<ol>");
        inOl = true;
      }
      out.push(`<li>${inline(ol[1]!)}</li>`);
      continue;
    }

    if (line.trim() === "") {
      closeLists();
      continue;
    }

    closeLists();
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      out.push(`<blockquote><p>${inline(quote[1]!)}</p></blockquote>`);
      continue;
    }

    out.push(`<p>${inline(line)}</p>`);
  }

  closeLists();
  return out.join("") || "<p></p>";
}

/**
 * If a text/note shape still contains markdown as plain text, convert to rich text.
 */
export function applyMarkdownIfNeeded(editor: Editor, shapeId: TLShapeId): void {
  const shape = editor.getShape(shapeId);
  if (!shape) return;
  if (shape.type !== "text" && shape.type !== "note" && shape.type !== "geo") {
    return;
  }

  const props = shape.props as { richText?: unknown };
  if (!props.richText) return;

  const plain = renderPlaintextFromRichText(
    editor,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    props.richText as any,
  );
  if (!looksLikeMarkdown(plain)) return;

  const html = markdownToHtml(plain);
  const richText = renderRichTextFromHTML(editor, html);

  editor.updateShape({
    id: shapeId,
    type: shape.type,
    props: { richText },
  });
}

/** When the user leaves text edit, convert remaining markdown to rich formatting. */
export function registerMarkdownOnEditEnd(editor: Editor): () => void {
  let previousEditingId: TLShapeId | null = null;

  // Poll via store listen — works across tldraw versions without sideEffects shape API
  return editor.store.listen(() => {
    const current =
      (
        editor as unknown as {
          getEditingShapeId?: () => TLShapeId | null;
        }
      ).getEditingShapeId?.() ?? null;

    if (previousEditingId && previousEditingId !== current) {
      try {
        applyMarkdownIfNeeded(editor, previousEditingId);
      } catch (err) {
        console.warn("[nanocore] markdown convert failed", err);
      }
    }
    previousEditingId = current;
  });
}

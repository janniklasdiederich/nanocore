/**
 * Clipboard API is only available in secure contexts (HTTPS or localhost).
 * Docker/LAN deploys are often opened as http://192.168.x.x:port — there
 * navigator.clipboard is undefined.
 *
 * tldraw's copy path does:
 *   if (navigator.clipboard?.write) { ... }
 *   else if (navigator.clipboard.writeText) { ... }  // no optional chain
 * which throws "Cannot read properties of undefined (reading 'writeText')".
 * preventDefault on the real copy event then leaves the system clipboard alone,
 * so paste falls through to unrelated clipboard content (text, images → odd shapes).
 *
 * This polyfill installs navigator.clipboard.write / writeText that put
 * text/html + text/plain on the system clipboard via the legacy copy event
 * (works on plain HTTP). We deliberately do not polyfill read() so paste uses
 * the paste event's clipboardData (correct for both in-app and external paste).
 */

type ClipboardLike = {
  writeText(text: string): Promise<void>;
  write(items: ClipboardItem[]): Promise<void>;
};

function writeViaCopyEvent(html: string, plain: string): boolean {
  let written = false;
  const onCopy = (e: ClipboardEvent) => {
    try {
      e.clipboardData?.setData("text/html", html);
      e.clipboardData?.setData("text/plain", plain || " ");
      written = true;
    } catch {
      written = false;
    }
    e.preventDefault();
    // Capture phase: stop tldraw's bubble-phase handler from re-entering on this
    // synthetic copy (it would call handleNativeOrMenuCopy again).
    e.stopImmediatePropagation();
  };

  document.addEventListener("copy", onCopy, true);
  try {
    // Some browsers require a selection for execCommand('copy') to fire.
    const probe = document.createElement("span");
    probe.textContent = plain || "\u00a0";
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText =
      "position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;";
    document.body.appendChild(probe);
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(probe);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const ok = document.execCommand("copy");
    selection?.removeAllRanges();
    probe.remove();
    return ok && written;
  } catch {
    return false;
  } finally {
    document.removeEventListener("copy", onCopy, true);
  }
}

async function clipboardItemToStrings(
  items: ClipboardItem[],
): Promise<{ html: string; plain: string }> {
  let html = "";
  let plain = " ";
  for (const item of items) {
    for (const type of item.types) {
      try {
        const blob = await item.getType(type);
        const text = await blob.text();
        if (type === "text/html") html = text;
        if (type === "text/plain") plain = text || " ";
      } catch {
        // ignore unsupported type
      }
    }
  }
  if (!html && plain) {
    // writeText-style payloads often embed tldraw markup as plain text
    html = plain;
  }
  return { html, plain };
}

function installClipboardPolyfill(): void {
  if (typeof navigator === "undefined") return;
  // Real Clipboard API present — leave it alone (localhost / HTTPS).
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    return;
  }

  const writeText = async (text: string): Promise<void> => {
    writeViaCopyEvent(text, text);
  };

  const write = async (items: ClipboardItem[]): Promise<void> => {
    const { html, plain } = await clipboardItemToStrings(items);
    writeViaCopyEvent(html, plain);
  };

  const polyfill: ClipboardLike = { writeText, write };

  try {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      enumerable: true,
      get: () => polyfill,
    });
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).clipboard = polyfill;
    } catch {
      console.warn(
        "[nanocore] Could not install clipboard fallback. Copy/paste of board elements may fail over plain HTTP. Use HTTPS or http://localhost.",
      );
    }
  }
}

installClipboardPolyfill();

import type { KanbanCard } from "../api";

const DROP_ATTR = "data-nc-kb-drop";
const OVER_ATTR = "data-nc-kb-drop-over";
const CARD_ATTR = "data-nc-kb-card";
const DRAG_THRESHOLD = 8;

export type KanbanDragSource = {
  boardId: string;
  card: KanbanCard;
};

export type KanbanDropTarget = {
  boardId: string;
  columnId: string;
  index: number;
};

let source: KanbanDragSource | null = null;
let ghost: HTMLDivElement | null = null;
let overList: HTMLElement | null = null;

function clearOver() {
  if (!overList) return;
  overList.removeAttribute(OVER_ATTR);
  overList = null;
}

function setOver(el: HTMLElement | null) {
  if (overList === el) return;
  clearOver();
  if (!el) return;
  el.setAttribute(OVER_ATTR, "");
  overList = el;
}

function listAtPoint(x: number, y: number): HTMLElement | null {
  const el = document.elementFromPoint(x, y);
  if (!(el instanceof Element)) return null;
  const list = el.closest(`[${DROP_ATTR}]`);
  return list instanceof HTMLElement ? list : null;
}

function indexInList(list: HTMLElement, y: number, skipCardId: string): number {
  const cards = [...list.querySelectorAll(`[${CARD_ATTR}]`)].filter(
    (node): node is HTMLElement =>
      node instanceof HTMLElement && node.getAttribute(CARD_ATTR) !== skipCardId,
  );
  for (let i = 0; i < cards.length; i++) {
    const rect = cards[i]!.getBoundingClientRect();
    if (y < rect.top + rect.height / 2) return i;
  }
  return cards.length;
}

function placeGhost(x: number, y: number) {
  if (!ghost) return;
  ghost.style.left = `${x + 12}px`;
  ghost.style.top = `${y + 12}px`;
}

export function beginKanbanDrag(drag: KanbanDragSource, x: number, y: number) {
  cancelKanbanDrag();
  source = drag;
  ghost = document.createElement("div");
  ghost.className = "nc-kb-embed-ghost";
  ghost.innerHTML = `<div class="nc-kb-embed-card-title"></div>${
    drag.card.description
      ? `<div class="nc-kb-embed-card-desc"></div>`
      : ""
  }`;
  ghost.querySelector(".nc-kb-embed-card-title")!.textContent = drag.card.title;
  const desc = ghost.querySelector(".nc-kb-embed-card-desc");
  if (desc) desc.textContent = drag.card.description;
  document.body.appendChild(ghost);
  placeGhost(x, y);
}

export function moveKanbanDrag(x: number, y: number) {
  if (!source) return;
  placeGhost(x, y);
  const list = listAtPoint(x, y);
  if (list?.getAttribute("data-nc-kb-board") !== source.boardId) {
    setOver(null);
    return;
  }
  setOver(list);
}

export function endKanbanDrag(x: number, y: number): KanbanDropTarget | null {
  if (!source) return null;
  const list = listAtPoint(x, y);
  const boardId = source.boardId;
  const cardId = source.card.id;
  const ok =
    list &&
    list.getAttribute("data-nc-kb-board") === boardId
      ? {
          boardId,
          columnId: list.getAttribute("data-nc-kb-column") ?? "",
          index: indexInList(list, y, cardId),
        }
      : null;
  cancelKanbanDrag();
  if (!ok?.columnId) return null;
  return ok;
}

export function cancelKanbanDrag() {
  ghost?.remove();
  ghost = null;
  source = null;
  clearOver();
}

export function isKanbanDragging(): boolean {
  return source !== null;
}

export { DRAG_THRESHOLD };

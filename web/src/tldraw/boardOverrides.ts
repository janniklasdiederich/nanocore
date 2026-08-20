import type { TLAssetId, TLUiOverrides } from "tldraw";
import { GifPickerDialog } from "./GifPickerDialog";
import { GIF_TOOL_ICON_ID } from "./gifToolIcon";
import { KanbanPickerDialog } from "./KanbanPickerDialog";
import { KANBAN_TOOL_ICON_ID } from "./kanbanToolIcon";

/**
 * Open media originals in a new tab instead of navigating the board tab away
 * (tldraw's default <a download> often navigates when cross-origin).
 * Also adds tldraw UI strings for the page-color menu item and GIF tool.
 */
export const boardUiOverrides: TLUiOverrides = {
  translations: {
    en: {
      "page-menu.submenu.change-color": "Change color",
      "tool.gif": "GIF",
      "tool.kanban": "Kanban",
      "fill-style.fill": "True solid",
      "dash-style.none": "None",
      "owner-label.menu": "Owner labels",
      "owner-label.always": "Always show",
      "owner-label.hover": "Show on hover",
      "owner-label.never": "Never show",
    },
    de: {
      "page-menu.submenu.change-color": "Farbe ändern",
      "tool.gif": "GIF",
      "tool.kanban": "Kanban",
      "fill-style.fill": "Echt deckend",
      "dash-style.none": "Keine",
      "owner-label.menu": "Besitzer anzeigen",
      "owner-label.always": "Immer anzeigen",
      "owner-label.hover": "Nur bei Hover",
      "owner-label.never": "Nie anzeigen",
    },
  },
  tools(_editor, tools, { addDialog }) {
    return {
      ...tools,
      gif: {
        id: "gif",
        label: "tool.gif" as never,
        icon: GIF_TOOL_ICON_ID as never,
        kbd: "g",
        onSelect() {
          addDialog({ component: GifPickerDialog });
        },
      },
      kanban: {
        id: "kanban",
        label: "tool.kanban" as never,
        icon: KANBAN_TOOL_ICON_ID as never,
        onSelect() {
          addDialog({ component: KanbanPickerDialog });
        },
      },
    };
  },
  actions(editor, actions) {
    const original = actions["download-original"];
    if (!original) return actions;

    return {
      ...actions,
      "download-original": {
        ...original,
        onSelect: async () => {
          for (const shape of editor.getSelectedShapes()) {
            if (
              !editor.isShapeOfType(shape, "image") &&
              !editor.isShapeOfType(shape, "video")
            ) {
              continue;
            }

            // After isShapeOfType, props are image/video props with assetId
            const assetId = (shape.props as { assetId?: TLAssetId }).assetId;
            if (!assetId) continue;

            const asset = editor.getAsset(assetId);
            if (!asset?.props.src) continue;

            const url = await editor.resolveAssetUrl(asset.id, {
              shouldResolveToOriginal: true,
            });
            if (!url) continue;

            window.open(url, "_blank", "noopener,noreferrer");
          }
        },
      },
    };
  },
};

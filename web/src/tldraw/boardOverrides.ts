import type { TLAssetId, TLUiOverrides } from "tldraw";
import { GifPickerDialog } from "./GifPickerDialog";

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
    },
    de: {
      "page-menu.submenu.change-color": "Farbe ändern",
      "tool.gif": "GIF",
    },
  },
  tools(_editor, tools, { addDialog }) {
    return {
      ...tools,
      gif: {
        id: "gif",
        label: "tool.gif" as never,
        icon: "tool-media",
        kbd: "g",
        onSelect() {
          addDialog({ component: GifPickerDialog });
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

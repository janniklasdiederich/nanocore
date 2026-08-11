import type { TLAssetId, TLUiOverrides } from "tldraw";

/**
 * Open media originals in a new tab instead of navigating the board tab away
 * (tldraw's default <a download> often navigates when cross-origin).
 */
export const boardUiOverrides: TLUiOverrides = {
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

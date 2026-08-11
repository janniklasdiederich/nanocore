import type {
  Editor,
  TLAssetId,
  TLImageShape,
  TLUiOverrides,
  TLVideoShape,
} from "tldraw";

function isMediaWithAsset(
  editor: Editor,
  shape: ReturnType<Editor["getSelectedShapes"]>[number],
): shape is TLImageShape | TLVideoShape {
  return (
    (editor.isShapeOfType(shape, "image") ||
      editor.isShapeOfType(shape, "video")) &&
    !!shape.props.assetId
  );
}

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
          const mediaShapes = editor
            .getSelectedShapes()
            .filter((s) => isMediaWithAsset(editor, s));

          for (const shape of mediaShapes) {
            const assetId = shape.props.assetId as TLAssetId;
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

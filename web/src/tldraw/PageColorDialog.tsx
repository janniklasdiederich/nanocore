import { useState } from "react";
import {
  TldrawUiButton,
  TldrawUiButtonLabel,
  TldrawUiDialogBody,
  TldrawUiDialogCloseButton,
  TldrawUiDialogFooter,
  TldrawUiDialogHeader,
  TldrawUiDialogTitle,
  track,
  useEditor,
  type TLPageId,
  type TLUiDialogProps,
} from "tldraw";
import { useT } from "../i18n";
import {
  DEFAULT_PAGE_BACKGROUND,
  getPageBackgroundColor,
  normalizeHex6,
  PAGE_BACKGROUND_PRESETS,
  setPageBackgroundColor,
} from "./pageBackground";

export type PageColorDialogProps = TLUiDialogProps & {
  pageId: TLPageId;
};

/**
 * Modal to pick a page canvas background color.
 * Color is stored on page.meta and syncs with collaborators.
 */
export const PageColorDialog = track(function PageColorDialog({
  onClose,
  pageId,
}: PageColorDialogProps) {
  const editor = useEditor();
  const t = useT();
  const page = editor.getPage(pageId);
  const initial = getPageBackgroundColor(editor, page);
  const [color, setColor] = useState(() => normalizeHex6(initial));

  if (!page) {
    onClose();
    return null;
  }

  function apply(next: string) {
    const hex = normalizeHex6(next);
    setColor(hex);
    setPageBackgroundColor(editor, pageId, hex);
  }

  function resetDefault() {
    apply(DEFAULT_PAGE_BACKGROUND);
  }

  return (
    <>
      <TldrawUiDialogHeader>
        <TldrawUiDialogTitle>{t("board.pageColorTitle")}</TldrawUiDialogTitle>
        <TldrawUiDialogCloseButton />
      </TldrawUiDialogHeader>
      <TldrawUiDialogBody className="page-color-dialog-body">
        <p className="page-color-dialog-help">
          {t("board.pageColorHelp", { name: page.name })}
        </p>
        <div className="page-color-dialog-row">
          <label className="page-color-dialog-picker">
            <span>{t("board.background")}</span>
            <input
              type="color"
              className="board-bg-color-input"
              value={color}
              aria-label={t("board.background")}
              onChange={(e) => apply(e.target.value)}
            />
            <code className="page-color-dialog-hex">{color}</code>
          </label>
        </div>
        <div className="page-color-dialog-presets" role="list">
          {PAGE_BACKGROUND_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              role="listitem"
              className={
                "board-bg-swatch" +
                (color === normalizeHex6(preset) ? " is-active" : "")
              }
              style={{ backgroundColor: preset }}
              title={preset}
              aria-label={t("board.backgroundPreset", { color: preset })}
              onClick={() => apply(preset)}
            />
          ))}
        </div>
      </TldrawUiDialogBody>
      <TldrawUiDialogFooter className="tlui-dialog__footer__actions">
        <TldrawUiButton type="normal" onClick={resetDefault}>
          <TldrawUiButtonLabel>{t("board.pageColorReset")}</TldrawUiButtonLabel>
        </TldrawUiButton>
        <TldrawUiButton type="primary" onClick={onClose}>
          <TldrawUiButtonLabel>{t("common.done")}</TldrawUiButtonLabel>
        </TldrawUiButton>
      </TldrawUiDialogFooter>
    </>
  );
});

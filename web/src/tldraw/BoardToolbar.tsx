import {
  DefaultToolbar,
  DefaultToolbarContent,
  TldrawUiMenuToolItem,
} from "tldraw";

/** Stock tools plus GIF — last item typically lands in the More overflow. */
export function BoardToolbar() {
  return (
    <DefaultToolbar>
      <DefaultToolbarContent />
      <TldrawUiMenuToolItem toolId="gif" />
    </DefaultToolbar>
  );
}

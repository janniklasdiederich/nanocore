import { useCallback } from "react";
import {
  PageRecordType,
  TldrawUiButton,
  TldrawUiButtonIcon,
  TldrawUiDropdownMenuContent,
  TldrawUiDropdownMenuRoot,
  TldrawUiDropdownMenuTrigger,
  TldrawUiMenuContextProvider,
  TldrawUiMenuGroup,
  TldrawUiMenuItem,
  getIndexAbove,
  getIndexBelow,
  getIndexBetween,
  track,
  useDialogs,
  useEditor,
  useTranslation,
  useUiEvents,
  type IndexKey,
  type PageItemSubmenuProps,
  type TLPageId,
} from "tldraw";
import { PageColorDialog } from "./PageColorDialog";
import {
  getPageBackgroundColor,
  setPageBackgroundColor,
} from "./pageBackground";

/**
 * Page ⋮ menu with stock actions plus “Change color” for per-page background.
 */
export const BoardPageItemSubmenu = track(function BoardPageItemSubmenu({
  index,
  listSize,
  item,
  onRename,
}: PageItemSubmenuProps) {
  const editor = useEditor();
  const msg = useTranslation();
  const pages = editor.getPages();
  const trackEvent = useUiEvents();
  const { addDialog } = useDialogs();

  const onDuplicate = useCallback(() => {
    const sourceId = item.id as TLPageId;
    const color = getPageBackgroundColor(editor, sourceId);
    editor.markHistoryStoppingPoint("creating page");
    const newId = PageRecordType.createId();
    editor.duplicatePage(sourceId, newId);
    setPageBackgroundColor(editor, newId, color);
    trackEvent("duplicate-page", { source: "page-menu" });
  }, [editor, item, trackEvent]);

  const onMoveUp = useCallback(() => {
    movePage(editor, item.id as TLPageId, index, index - 1, trackEvent);
  }, [editor, item, index, trackEvent]);

  const onMoveDown = useCallback(() => {
    movePage(editor, item.id as TLPageId, index, index + 1, trackEvent);
  }, [editor, item, index, trackEvent]);

  const onDelete = useCallback(() => {
    editor.markHistoryStoppingPoint("deleting page");
    editor.deletePage(item.id as TLPageId);
    trackEvent("delete-page", { source: "page-menu" });
  }, [editor, item, trackEvent]);

  const onChangeColor = useCallback(() => {
    const pageId = item.id as TLPageId;
    addDialog({
      component: (props) => <PageColorDialog {...props} pageId={pageId} />,
    });
  }, [addDialog, item.id]);

  return (
    <TldrawUiDropdownMenuRoot id={`page item submenu ${index}`}>
      <TldrawUiDropdownMenuTrigger>
        <TldrawUiButton type="icon" title={msg("page-menu.submenu.title")}>
          <TldrawUiButtonIcon icon="dots-vertical" small />
        </TldrawUiButton>
      </TldrawUiDropdownMenuTrigger>
      <TldrawUiDropdownMenuContent alignOffset={0} side="right" sideOffset={-4}>
        <TldrawUiMenuContextProvider type="menu" sourceId="page-menu">
          <TldrawUiMenuGroup id="modify">
            {onRename && (
              <TldrawUiMenuItem
                id="rename"
                label="page-menu.submenu.rename"
                onSelect={onRename}
              />
            )}
            <TldrawUiMenuItem
              id="change-color"
              label="page-menu.submenu.change-color"
              onSelect={onChangeColor}
            />
            <TldrawUiMenuItem
              id="duplicate"
              label="page-menu.submenu.duplicate-page"
              onSelect={onDuplicate}
              disabled={pages.length >= editor.options.maxPages}
            />
            {index > 0 && (
              <TldrawUiMenuItem
                id="move-up"
                onSelect={onMoveUp}
                label="page-menu.submenu.move-up"
              />
            )}
            {index < listSize - 1 && (
              <TldrawUiMenuItem
                id="move-down"
                label="page-menu.submenu.move-down"
                onSelect={onMoveDown}
              />
            )}
          </TldrawUiMenuGroup>
          {listSize > 1 && (
            <TldrawUiMenuGroup id="delete">
              <TldrawUiMenuItem
                id="delete"
                onSelect={onDelete}
                label="page-menu.submenu.delete"
              />
            </TldrawUiMenuGroup>
          )}
        </TldrawUiMenuContextProvider>
      </TldrawUiDropdownMenuContent>
    </TldrawUiDropdownMenuRoot>
  );
});

/** Same logic as tldraw's internal onMovePage (not public). */
function movePage(
  editor: ReturnType<typeof useEditor>,
  id: TLPageId,
  from: number,
  to: number,
  trackEvent: ReturnType<typeof useUiEvents>,
) {
  const pages = editor.getPages();
  const below = from > to ? pages[to - 1] : pages[to];
  const above = from > to ? pages[to] : pages[to + 1];

  let index: IndexKey;
  if (below && !above) {
    index = getIndexAbove(below.index);
  } else if (!below && above) {
    index = getIndexBelow(pages[0]!.index);
  } else {
    index = getIndexBetween(below!.index, above!.index);
  }

  if (index !== pages[from]!.index) {
    editor.markHistoryStoppingPoint("moving page");
    editor.updatePage({ id, index });
    trackEvent("move-page", { source: "page-menu" });
  }
}

import {
  ColorSchemeMenu,
  DefaultMainMenu,
  EditSubmenu,
  ExportFileContentSubMenu,
  ExtrasGroup,
  KeyboardShortcutsMenuItem,
  LanguageMenu,
  TldrawUiMenuCheckboxItem,
  TldrawUiMenuGroup,
  TldrawUiMenuSubmenu,
  ToggleDebugModeItem,
  ToggleDynamicSizeModeItem,
  ToggleEdgeScrollingItem,
  ToggleFocusModeItem,
  ToggleGridItem,
  ToggleKeyboardShortcutsItem,
  TogglePasteAtCursorItem,
  ToggleReduceMotionItem,
  ToggleSnapModeItem,
  ToggleToolLockItem,
  ToggleWrapModeItem,
  ViewSubmenu,
} from "tldraw";
import {
  setOwnerLabelMode,
  useOwnerLabelMode,
  type OwnerLabelMode,
} from "./shapeOwner";

const OWNER_LABEL_OPTIONS: {
  mode: OwnerLabelMode;
  label: string;
}[] = [
  { mode: "always", label: "owner-label.always" },
  { mode: "hover", label: "owner-label.hover" },
  { mode: "never", label: "owner-label.never" },
];

function OwnerLabelPrefMenu() {
  const mode = useOwnerLabelMode();

  return (
    <TldrawUiMenuSubmenu id="owner-label" label={"owner-label.menu" as never}>
      <TldrawUiMenuGroup id="owner-label-mode">
        {OWNER_LABEL_OPTIONS.map((opt) => (
          <TldrawUiMenuCheckboxItem
            key={opt.mode}
            id={`owner-label-${opt.mode}`}
            label={opt.label as never}
            checked={mode === opt.mode}
            readonlyOk
            onSelect={() => setOwnerLabelMode(opt.mode)}
          />
        ))}
      </TldrawUiMenuGroup>
    </TldrawUiMenuSubmenu>
  );
}

function BoardPreferencesGroup() {
  return (
    <TldrawUiMenuGroup id="preferences">
      <TldrawUiMenuSubmenu id="preferences" label="menu.preferences">
        <TldrawUiMenuGroup id="preferences-actions">
          <ToggleSnapModeItem />
          <ToggleToolLockItem />
          <ToggleGridItem />
          <ToggleWrapModeItem />
          <ToggleFocusModeItem />
          <ToggleEdgeScrollingItem />
          <ToggleReduceMotionItem />
          <ToggleKeyboardShortcutsItem />
          <ToggleDynamicSizeModeItem />
          <TogglePasteAtCursorItem />
          <ToggleDebugModeItem />
        </TldrawUiMenuGroup>
        <TldrawUiMenuGroup id="owner-label">
          <OwnerLabelPrefMenu />
        </TldrawUiMenuGroup>
        <TldrawUiMenuGroup id="color-scheme">
          <ColorSchemeMenu />
        </TldrawUiMenuGroup>
      </TldrawUiMenuSubmenu>
      <LanguageMenu />
      <KeyboardShortcutsMenuItem />
    </TldrawUiMenuGroup>
  );
}

/** Default main menu with an Owner labels submenu inside Preferences. */
export function BoardMainMenu() {
  return (
    <DefaultMainMenu>
      <TldrawUiMenuGroup id="basic">
        <EditSubmenu />
        <ViewSubmenu />
        <ExportFileContentSubMenu />
        <ExtrasGroup />
      </TldrawUiMenuGroup>
      <BoardPreferencesGroup />
    </DefaultMainMenu>
  );
}

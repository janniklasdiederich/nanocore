import {
  ArrowShapeKindStyle,
  DefaultColorStyle,
  DefaultDashStyle,
  DefaultFillStyle,
  DefaultSizeStyle,
  DefaultStylePanel,
  DefaultStylePanelContent,
  OpacitySlider,
  TldrawUiButtonPicker,
  TldrawUiToolbar,
  TldrawUiToolbarButton,
  TldrawUiButtonIcon,
  getDefaultColorTheme,
  kickoutOccludedShapes,
  useEditor,
  useIsDarkMode,
  useRelevantStyles,
  useTranslation,
  useUiEvents,
  useValue,
  type StyleProp,
  type TLArrowShape,
  type TLUiStylePanelProps,
} from "tldraw";
import { useCallback, useMemo } from "react";
import { CustomColorsSection } from "./CustomColorsSection";
import {
  ROUNDED_ELBOW_META,
  getPreferRoundedElbow,
  isRoundedElbow,
  setPreferRoundedElbow,
} from "./roundedElbow";

const FILL_ITEMS = [
  { value: "none", icon: "fill-none" },
  { value: "semi", icon: "fill-semi" },
  { value: "solid", icon: "fill-solid" },
  { value: "pattern", icon: "fill-pattern" },
  { value: "fill", icon: "fill-fill" },
] as const;

const DASH_NONE_ICON = (
  <div className="nc-dash-none-icon" aria-hidden>
    <svg viewBox="0 0 16 16" width="18" height="18">
      <circle
        cx="8"
        cy="8"
        r="5.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <line
        x1="4.2"
        y1="11.8"
        x2="11.8"
        y2="4.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  </div>
);

const DASH_ITEMS = [
  { value: "draw", icon: "dash-draw" },
  { value: "dashed", icon: "dash-dashed" },
  { value: "dotted", icon: "dash-dotted" },
  { value: "solid", icon: "dash-solid" },
  { value: "none", icon: DASH_NONE_ICON },
];

const SIZE_ITEMS = [
  { value: "s", icon: "size-small" },
  { value: "m", icon: "size-medium" },
  { value: "l", icon: "size-large" },
  { value: "xl", icon: "size-extra-large" },
] as const;

const COLOR_ITEMS = [
  { value: "black", icon: "color" },
  { value: "grey", icon: "color" },
  { value: "light-violet", icon: "color" },
  { value: "violet", icon: "color" },
  { value: "blue", icon: "color" },
  { value: "light-blue", icon: "color" },
  { value: "yellow", icon: "color" },
  { value: "orange", icon: "color" },
  { value: "green", icon: "color" },
  { value: "light-green", icon: "color" },
  { value: "light-red", icon: "color" },
  { value: "red", icon: "color" },
] as const;

/**
 * Style panel with True solid fill + dash None in the real picker rows.
 * Stock DefaultStylePanelContent's first section is hidden (duplicate).
 */
export function BoardStylePanel(props: TLUiStylePanelProps) {
  const styles = useRelevantStyles();
  const isDarkMode = useIsDarkMode();
  const theme = getDefaultColorTheme({ isDarkMode });
  const showCustomColors =
    styles != null && styles.get(DefaultColorStyle) !== undefined;

  return (
    <DefaultStylePanel {...props}>
      <div className="nc-board-style-panel">
        {styles && <BoardCommonStylePickerSet styles={styles} theme={theme} />}
        <DefaultStylePanelContent styles={styles} />
        {styles && <BoardArrowKindPicker styles={styles} />}
        {showCustomColors && <CustomColorsSection />}
      </div>
    </DefaultStylePanel>
  );
}

function useStyleChangeCallback() {
  const editor = useEditor();
  const trackEvent = useUiEvents();

  return useMemo(
    () =>
      function handleStyleChange<T>(style: StyleProp<T>, value: T) {
        editor.run(() => {
          if (editor.isIn("select")) {
            editor.setStyleForSelectedShapes(style, value);
          }
          editor.setStyleForNextShapes(style, value);
          editor.updateInstanceState({ isChangingStyle: true });
        });
        trackEvent("set-style", {
          source: "style-panel",
          id: style.id,
          value: value as string,
        });
      },
    [editor, trackEvent],
  );
}

function BoardCommonStylePickerSet({
  styles,
  theme,
}: {
  styles: NonNullable<ReturnType<typeof useRelevantStyles>>;
  theme: ReturnType<typeof getDefaultColorTheme>;
}) {
  const msg = useTranslation();
  const editor = useEditor();
  const onHistoryMark = useCallback(
    (id: string) => editor.markHistoryStoppingPoint(id),
    [editor],
  );
  const handleValueChange = useStyleChangeCallback();

  const color = styles.get(DefaultColorStyle);
  const fill = styles.get(DefaultFillStyle);
  const dash = styles.get(DefaultDashStyle);
  const size = styles.get(DefaultSizeStyle);
  const showPickers =
    fill !== undefined || dash !== undefined || size !== undefined;

  return (
    <>
      <div className="tlui-style-panel__section__common" data-testid="style.panel">
        {color === undefined ? null : (
          <TldrawUiToolbar label={msg("style-panel.color")}>
            <TldrawUiButtonPicker
              title={msg("style-panel.color")}
              uiType="color"
              style={DefaultColorStyle}
              items={COLOR_ITEMS}
              value={color}
              onValueChange={handleValueChange}
              theme={theme}
              onHistoryMark={onHistoryMark}
            />
          </TldrawUiToolbar>
        )}
        <OpacitySlider />
      </div>
      {showPickers && (
        <div className="tlui-style-panel__section">
          {fill === undefined ? null : (
            <TldrawUiToolbar label={msg("style-panel.fill")}>
              <TldrawUiButtonPicker
                title={msg("style-panel.fill")}
                uiType="fill"
                style={DefaultFillStyle}
                items={FILL_ITEMS}
                value={fill}
                onValueChange={handleValueChange}
                theme={theme}
                onHistoryMark={onHistoryMark}
              />
            </TldrawUiToolbar>
          )}
          {dash === undefined ? null : (
            <TldrawUiToolbar label={msg("style-panel.dash")}>
              <TldrawUiButtonPicker
                title={msg("style-panel.dash")}
                uiType="dash"
                style={DefaultDashStyle}
                items={DASH_ITEMS}
                value={dash}
                onValueChange={handleValueChange}
                theme={theme}
                onHistoryMark={onHistoryMark}
              />
            </TldrawUiToolbar>
          )}
          {size === undefined ? null : (
            <TldrawUiToolbar label={msg("style-panel.size")}>
              <TldrawUiButtonPicker
                title={msg("style-panel.size")}
                uiType="size"
                style={DefaultSizeStyle}
                items={SIZE_ITEMS}
                value={size}
                onValueChange={(style, value) => {
                  handleValueChange(style, value);
                  const selectedShapeIds = editor.getSelectedShapeIds();
                  if (selectedShapeIds.length > 0) {
                    kickoutOccludedShapes(editor, selectedShapeIds);
                  }
                }}
                theme={theme}
                onHistoryMark={onHistoryMark}
              />
            </TldrawUiToolbar>
          )}
        </div>
      )}
    </>
  );
}

const ROUNDED_ELBOW_ICON = (
  <div className="nc-dash-none-icon" aria-hidden>
    <svg viewBox="0 0 16 16" width="18" height="18">
      <path
        d="M3 3h5a5 5 0 0 1 5 5v5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  </div>
);

function BoardArrowKindPicker({
  styles,
}: {
  styles: NonNullable<ReturnType<typeof useRelevantStyles>>;
}) {
  const editor = useEditor();
  const kind = styles.get(ArrowShapeKindStyle);
  const selectedRounded = useValue(
    "roundedElbowSelection",
    () => {
      const shapes = editor.getSelectedShapes();
      const arrows = shapes.filter((s): s is TLArrowShape => s.type === "arrow");
      if (arrows.length === 0) return getPreferRoundedElbow();
      return arrows.every((a) => isRoundedElbow(a));
    },
    [editor],
  );

  if (kind === undefined) return null;

  const current: "arc" | "elbow" | "rounded" | "mixed" =
    kind.type !== "shared"
      ? "mixed"
      : kind.value === "arc"
        ? "arc"
        : selectedRounded
          ? "rounded"
          : "elbow";

  function apply(mode: "arc" | "elbow" | "rounded") {
    editor.run(() => {
      setPreferRoundedElbow(mode === "rounded");
      if (mode === "arc") {
        editor.setStyleForSelectedShapes(ArrowShapeKindStyle, "arc");
        editor.setStyleForNextShapes(ArrowShapeKindStyle, "arc");
      } else {
        editor.setStyleForSelectedShapes(ArrowShapeKindStyle, "elbow");
        editor.setStyleForNextShapes(ArrowShapeKindStyle, "elbow");
      }
      for (const shape of editor.getSelectedShapes()) {
        if (shape.type !== "arrow") continue;
        editor.updateShape({
          id: shape.id,
          type: "arrow",
          meta: {
            ...shape.meta,
            [ROUNDED_ELBOW_META]: mode === "rounded",
          },
        });
      }
    });
  }

  return (
    <div className="tlui-style-panel__section nc-arrow-kind">
      <TldrawUiToolbar label="Line">
        <TldrawUiToolbarButton
          type="icon"
          title="Line — Arc"
          isActive={current === "arc"}
          onClick={() => apply("arc")}
        >
          <TldrawUiButtonIcon icon="arrow-arc" />
        </TldrawUiToolbarButton>
        <TldrawUiToolbarButton
          type="icon"
          title="Line — Elbow"
          isActive={current === "elbow"}
          onClick={() => apply("elbow")}
        >
          <TldrawUiButtonIcon icon="arrow-elbow" />
        </TldrawUiToolbarButton>
        <TldrawUiToolbarButton
          type="icon"
          title="Line — Rounded elbow"
          isActive={current === "rounded"}
          onClick={() => apply("rounded")}
        >
          <TldrawUiButtonIcon icon={ROUNDED_ELBOW_ICON} />
        </TldrawUiToolbarButton>
      </TldrawUiToolbar>
    </div>
  );
}

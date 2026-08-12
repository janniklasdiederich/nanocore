import {
  DefaultColorStyle,
  DefaultStylePanel,
  DefaultStylePanelContent,
  useRelevantStyles,
  type TLUiStylePanelProps,
} from "tldraw";
import { CustomColorsSection } from "./CustomColorsSection";

/**
 * Style panel with stock controls + custom color picker / saved swatches.
 */
export function BoardStylePanel(props: TLUiStylePanelProps) {
  const styles = useRelevantStyles();
  const showCustomColors = styles != null && styles.get(DefaultColorStyle) !== undefined;

  return (
    <DefaultStylePanel {...props}>
      <DefaultStylePanelContent styles={styles} />
      {showCustomColors && <CustomColorsSection />}
    </DefaultStylePanel>
  );
}

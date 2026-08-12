import type { TLComponents } from "tldraw";
import { boardUiComponents as peopleComponents } from "../components/LockedPeopleMenu";
import { BoardBackground } from "./boardBackground";
import { BoardPageMenu } from "./BoardPageMenu";
import { BoardStylePanel } from "./BoardStylePanel";
import { BoardToolbar } from "./BoardToolbar";
import { RichTextToolbarWithSize } from "./RichTextToolbarWithSize";

export const boardUiComponents: TLComponents = {
  ...peopleComponents,
  RichTextToolbar: RichTextToolbarWithSize,
  /** Canvas fill — per-page color in page.meta (synced). */
  Background: BoardBackground,
  /** Page list with ⋮ menu including “Change color”. */
  PageMenu: BoardPageMenu,
  /** Style panel with custom color picker + saved swatches. */
  StylePanel: BoardStylePanel,
  Toolbar: BoardToolbar,
};

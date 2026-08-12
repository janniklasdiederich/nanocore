import type { TLComponents } from "tldraw";
import { boardUiComponents as peopleComponents } from "../components/LockedPeopleMenu";
import { BoardBackground } from "./boardBackground";
import { RichTextToolbarWithSize } from "./RichTextToolbarWithSize";

export const boardUiComponents: TLComponents = {
  ...peopleComponents,
  RichTextToolbar: RichTextToolbarWithSize,
  /** Canvas fill — color stored in document.meta (synced). */
  Background: BoardBackground,
};

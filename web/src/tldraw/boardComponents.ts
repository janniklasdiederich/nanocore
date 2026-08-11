import type { TLComponents } from "tldraw";
import { boardUiComponents as peopleComponents } from "../components/LockedPeopleMenu";
import { RichTextToolbarWithSize } from "./RichTextToolbarWithSize";

export const boardUiComponents: TLComponents = {
  ...peopleComponents,
  RichTextToolbar: RichTextToolbarWithSize,
};

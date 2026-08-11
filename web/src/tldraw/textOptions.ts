import { TextStyle } from "@tiptap/extension-text-style";
import {
  tipTapDefaultExtensions,
  type TLTextOptions,
} from "tldraw";
import { FontSize } from "./FontSizeExtension";

/** TipTap stack: defaults + text style marks for per-selection font size. */
export const boardTextOptions: Partial<TLTextOptions> = {
  tipTapConfig: {
    extensions: [...tipTapDefaultExtensions, TextStyle, FontSize],
  },
};

/**
 * Extra fill + dash options on stock tldraw styles.
 *
 * Fill: tldraw already has a `fill` value that paints theme[color].fill (the
 * true hue). The style panel hid it; "solid" uses the lighter `.semi` wash.
 *
 * Dash: `none` is not in the 3.15 enum. We accept it in the validator, show it
 * in the picker, and skip PathBuilder strokes (geo / line / arrow).
 */
import {
  DefaultDashStyle,
  DrawShapeUtil,
  PathBuilder,
  type TLDrawShape,
} from "tldraw";

function wrapDashNone(): void {
  const style = DefaultDashStyle as unknown as {
    validate: (value: unknown) => unknown;
    validateUsingKnownGoodVersion?: (prev: unknown, next: unknown) => unknown;
    type: {
      validationFn?: (value: unknown) => unknown;
      validate?: (value: unknown) => unknown;
      validateUsingKnownGoodVersionFn?: (prev: unknown, next: unknown) => unknown;
    };
  };

  const allow = (value: unknown) => (value === "none" ? "none" : undefined);

  const type = style.type;
  if (type && typeof type.validationFn === "function") {
    const orig = type.validationFn.bind(type);
    type.validationFn = (value: unknown) => {
      const extra = allow(value);
      if (extra !== undefined) return extra;
      return orig(value);
    };
  }
  if (type && typeof type.validate === "function") {
    const orig = type.validate.bind(type);
    type.validate = (value: unknown) => {
      const extra = allow(value);
      if (extra !== undefined) return extra;
      return orig(value);
    };
  }
  if (typeof style.validate === "function") {
    const orig = style.validate.bind(style);
    style.validate = (value: unknown) => {
      const extra = allow(value);
      if (extra !== undefined) return extra;
      return orig(value);
    };
  }
  if (style.validateUsingKnownGoodVersion) {
    const orig = style.validateUsingKnownGoodVersion.bind(style);
    style.validateUsingKnownGoodVersion = (prev, next) => {
      const extra = allow(next);
      if (extra !== undefined) return extra;
      return orig(prev, next);
    };
  }
}

wrapDashNone();

const origToSvg = PathBuilder.prototype.toSvg;
PathBuilder.prototype.toSvg = function patchedToSvg(
  this: InstanceType<typeof PathBuilder>,
  opts: { style?: string; forceSolid?: boolean },
) {
  if (opts?.style === "none") return <g />;
  return origToSvg.call(this, opts as never);
};

/** Draw shapes don't use PathBuilder — hide the stroke when dash is none. */
export class NanocoreDrawShapeUtil extends DrawShapeUtil {
  override component(shape: TLDrawShape) {
    const inner = super.component(shape);
    if ((shape.props.dash as string) !== "none") return inner;
    return <div className="nc-no-dash">{inner}</div>;
  }

  override toSvg(shape: TLDrawShape, ctx: Parameters<DrawShapeUtil["toSvg"]>[1]) {
    const inner = super.toSvg(shape, ctx);
    if ((shape.props.dash as string) !== "none") return inner;
    return <g stroke="none">{inner}</g>;
  }
}

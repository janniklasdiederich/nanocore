/**
 * Accept custom color style values (custom-1 … custom-N) used by the web client.
 *
 * Must patch the internal T.Validator.validationFn — StyleProp.validate alone is
 * not enough because Validator.validate always calls validationFn.
 */
import {
  DefaultColorStyle,
  DefaultDashStyle,
  frameShapeProps,
} from "@tldraw/tlschema";

function isCustomColorKey(value: unknown): boolean {
  return typeof value === "string" && /^custom-\d+$/.test(value);
}

let done = false;

/** Call once before any TLSocketRoom is created. */
export function patchColorStylesForSync(): void {
  if (done) return;
  done = true;

  const style = DefaultColorStyle as unknown as {
    validate: (value: unknown) => unknown;
    validateUsingKnownGoodVersion?: (prev: unknown, next: unknown) => unknown;
    type: {
      validationFn: (value: unknown) => unknown;
      validateUsingKnownGoodVersionFn?: (prev: unknown, next: unknown) => unknown;
    };
  };

  const allow = (value: unknown) =>
    isCustomColorKey(value) ? value : undefined;

  // Schema path: props.color → StyleProp → type.validationFn
  const type = style.type;
  if (type && typeof type.validationFn === "function") {
    const origFn = type.validationFn.bind(type);
    type.validationFn = (value: unknown) => {
      const custom = allow(value);
      if (custom !== undefined) return custom;
      return origFn(value);
    };
  }
  if (type?.validateUsingKnownGoodVersionFn) {
    const origKnown = type.validateUsingKnownGoodVersionFn.bind(type);
    type.validateUsingKnownGoodVersionFn = (prev: unknown, next: unknown) => {
      const custom = allow(next);
      if (custom !== undefined) return custom;
      return origKnown(prev, next);
    };
  }

  const origValidate = style.validate.bind(style);
  style.validate = (value: unknown) => {
    const custom = allow(value);
    if (custom !== undefined) return custom;
    return origValidate(value);
  };
  if (style.validateUsingKnownGoodVersion) {
    const origKnown = style.validateUsingKnownGoodVersion.bind(style);
    style.validateUsingKnownGoodVersion = (prev: unknown, next: unknown) => {
      const custom = allow(next);
      if (custom !== undefined) return custom;
      return origKnown(prev, next);
    };
  }

  wrapValidator(
    DefaultDashStyle as unknown as {
      validate?: (value: unknown) => unknown;
      validationFn?: (value: unknown) => unknown;
      validateUsingKnownGoodVersion?: (prev: unknown, next: unknown) => unknown;
      validateUsingKnownGoodVersionFn?: (
        prev: unknown,
        next: unknown,
      ) => unknown;
    },
    (value) => (value === "none" ? "none" : undefined),
  );
  const dashType = (
    DefaultDashStyle as unknown as {
      type?: {
        validationFn?: (value: unknown) => unknown;
        validate?: (value: unknown) => unknown;
        validateUsingKnownGoodVersionFn?: (
          prev: unknown,
          next: unknown,
        ) => unknown;
      };
    }
  ).type;
  if (dashType) {
    wrapValidator(dashType, (value) => (value === "none" ? "none" : undefined));
  }

  // Frames store color as T.literalEnum(stock values), not DefaultColorStyle.
  wrapValidator(
    frameShapeProps.color as {
      validate?: (value: unknown) => unknown;
      validationFn?: (value: unknown) => unknown;
      validateUsingKnownGoodVersion?: (prev: unknown, next: unknown) => unknown;
      validateUsingKnownGoodVersionFn?: (
        prev: unknown,
        next: unknown,
      ) => unknown;
    },
    allow,
  );
}

function wrapValidator(
  validator: {
    validate?: (value: unknown) => unknown;
    validationFn?: (value: unknown) => unknown;
    validateUsingKnownGoodVersion?: (prev: unknown, next: unknown) => unknown;
    validateUsingKnownGoodVersionFn?: (prev: unknown, next: unknown) => unknown;
  },
  allow: (value: unknown) => unknown,
): void {
  if (typeof validator.validationFn === "function") {
    const origFn = validator.validationFn.bind(validator);
    validator.validationFn = (value: unknown) => {
      const custom = allow(value);
      if (custom !== undefined) return custom;
      return origFn(value);
    };
  }
  if (typeof validator.validateUsingKnownGoodVersionFn === "function") {
    const origKnown = validator.validateUsingKnownGoodVersionFn.bind(validator);
    validator.validateUsingKnownGoodVersionFn = (
      prev: unknown,
      next: unknown,
    ) => {
      const custom = allow(next);
      if (custom !== undefined) return custom;
      return origKnown(prev, next);
    };
  }
  if (typeof validator.validate === "function") {
    const origValidate = validator.validate.bind(validator);
    validator.validate = (value: unknown) => {
      const custom = allow(value);
      if (custom !== undefined) return custom;
      return origValidate(value);
    };
  }
  if (typeof validator.validateUsingKnownGoodVersion === "function") {
    const origKnown = validator.validateUsingKnownGoodVersion.bind(validator);
    validator.validateUsingKnownGoodVersion = (
      prev: unknown,
      next: unknown,
    ) => {
      const custom = allow(next);
      if (custom !== undefined) return custom;
      return origKnown(prev, next);
    };
  }
}

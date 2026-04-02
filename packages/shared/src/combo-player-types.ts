export const ComboPlayerVariant = {
  Default: "default",
  Background: "background",
} as const;

export type ComboPlayerVariant = (typeof ComboPlayerVariant)[keyof typeof ComboPlayerVariant];

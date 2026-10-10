// Vendored from https://github.com/plens-win/Card
// packages/core/src/registry.ts @ 39734839 (2026-09-28).
// See compass-track-card.ts's doc comment for vendoring rationale.

/** A registered card kind: a discriminant string plus the pure render
 * function that turns its own input shape into an HTML string. */
export interface CardVariant<T> {
  /** The `kind` discriminant this variant renders (e.g. `"aircraft"`). */
  kind: string;
  /** Renders `input` (of this variant's own input shape) to an HTML string. */
  render(input: T): string;
}

const registry = new Map<string, CardVariant<unknown>>();

/** Registers `variant` under its `kind`, so a later `renderCard({kind:
 * variant.kind, ...})` call delegates to `variant.render`. Registering a
 * `kind` again replaces the previous registration for that `kind` only —
 * every other registered kind is unaffected. */
export function registerCardVariant<T>(variant: CardVariant<T>): void {
  registry.set(variant.kind, variant as CardVariant<unknown>);
}

/** Renders `input` by dispatching to the variant registered for
 * `input.kind`. Throws an `Error` (containing the literal text `Unknown card
 * kind` and the offending `kind` value) when no variant is registered for
 * `input.kind`, rather than silently returning empty output or rendering the
 * wrong variant's markup. Generic over `T` (rather than an intersection with
 * `Record<string, unknown>`) so a concrete, closed input interface like
 * `AircraftCardInput` — which has no index signature — remains directly
 * assignable here. */
export function renderCard<T extends { kind: string }>(input: T): string {
  const variant = registry.get(input.kind);
  if (!variant) {
    throw new Error(`Unknown card kind: "${input.kind}"`);
  }
  return variant.render(input);
}

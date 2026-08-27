/**
 * The vendored AircraftShapesSVG library (`aircraftShapes.ts`,
 * `aircraftIcons.ts`) declares a `viewBox`/physical size per file, but that
 * canvas isn't tightly cropped to each drawing's actual content — confirmed
 * by measuring a few files' real geometry: B738's drawing fills roughly
 * half of its declared 80×80 unit canvas, while C172's fills barely a
 * fourteenth of it (an ~11×8 unit drawing in the same nominal 80×80 space).
 * Every consumer that scales "the shape" to fit an icon box using the
 * file's own `viewBox` inherits that inconsistency — some aircraft render
 * at a sensible size, others (like the Cessna 172, one of the more common
 * types) render as a barely-visible speck regardless of how big the icon
 * box itself is.
 *
 * This computes a tight, padded, square `viewBox` around a shape's actual
 * drawn geometry instead, so every shape fills its icon box consistently.
 * Must run client-side (uses `document`/SVG geometry methods) — mounts the
 * markup into a detached, off-screen `<svg>` just long enough to call
 * `getBBox()`, which requires the element to be part of a laid-out
 * document.
 */
export function computeTightViewBox(
  markup: string,
  fallbackViewBox: string,
  paddingRatio = 0.12,
): string {
  if (typeof document === "undefined") return fallbackViewBox;

  const svgNS = "http://www.w3.org/2000/svg";
  const host = document.createElementNS(svgNS, "svg");
  host.style.position = "absolute";
  host.style.left = "-99999px";
  host.style.top = "-99999px";
  host.style.width = "0";
  host.style.height = "0";
  host.style.overflow = "hidden";
  host.innerHTML = markup;
  document.body.appendChild(host);

  let box: DOMRect | null = null;
  try {
    box = host.getBBox();
  } catch {
    box = null;
  }
  document.body.removeChild(host);

  if (!box || !box.width || !box.height) return fallbackViewBox;

  const size = Math.max(box.width, box.height) * (1 + paddingRatio * 2);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const half = size / 2;
  return `${(cx - half).toFixed(3)} ${(cy - half).toFixed(3)} ${size.toFixed(3)} ${size.toFixed(3)}`;
}

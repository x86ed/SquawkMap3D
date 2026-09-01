/**
 * readsb's `desc` field (this app's `manufacturerModel`) is one combined
 * free-text string — e.g. "AIRBUS A-321neo", "BOEING 737-800" — with no
 * separate manufacturer field anywhere upstream (confirmed against this
 * app's live feed and `aircraft.ts`'s own doc comment). Splits on the
 * first space as a best effort: correct for every single-word manufacturer
 * observed in practice (Airbus, Boeing, Cessna, ...), but known to
 * mis-split multi-word manufacturers (e.g. "MCDONNELL DOUGLAS MD-11" would
 * read as manufacturer "MCDONNELL", model "DOUGLAS MD-11") — there's no
 * structured data available to do better than this.
 */
export function splitManufacturerModel(desc: string | undefined): { manufacturer?: string; model?: string } {
  if (!desc) return {};
  const spaceIndex = desc.indexOf(" ");
  if (spaceIndex === -1) return { manufacturer: desc };
  return { manufacturer: desc.slice(0, spaceIndex), model: desc.slice(spaceIndex + 1) };
}

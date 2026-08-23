## MODIFIED Requirements

### Requirement: Airports use a contrasting color
Airport markers SHALL be rendered as an SVG-derived icon (based on `atc.svg`) whose negative space is filled solid white and whose foreground color matches the airport accent color used in the currently active map view (light or dark), remaining visually distinguishable from the map surface in both the light and dark base styles.

#### Scenario: Airports visible against light style
- **WHEN** the map is showing its light style with the airports layer enabled
- **THEN** airport markers render as the icon with a foreground color matching the light view's airport accent color, clearly distinguishable from the light basemap surface

#### Scenario: Airports visible against dark style
- **WHEN** the map is showing its dark style with the airports layer enabled
- **THEN** airport markers render as the icon with a foreground color matching the dark view's airport accent color, clearly distinguishable from the dark basemap surface

#### Scenario: Icon negative space is not transparent
- **WHEN** the airport icon is rendered on the map, in either theme
- **THEN** the icon's negative space (any area within the glyph not covered by its foreground shape) is filled solid white rather than left transparent

## ADDED Requirements

### Requirement: Airport layer is toggleable
The user SHALL be able to show or hide the airports layer independently of any other map mode (light/dark theme, pilot mode) or other toggleable layer (e.g. military bases), the same way the military-bases layer is already toggleable.

#### Scenario: Hiding the airports layer
- **WHEN** the user turns the airports layer off
- **THEN** airport icons are no longer rendered, while other layers (military bases, base map) remain visible per their own state

#### Scenario: Toggle persists across mode switches
- **WHEN** the user hides the airports layer and then switches theme (light/dark) or toggles pilot mode
- **THEN** the airports layer remains hidden until the user explicitly turns it back on

### Requirement: Clicking an airport opens a details popup
Clicking an airport icon on the map SHALL open a popup showing that airport's IATA code, ICAO code, name, an image of the airport, country flag, city, and country.

#### Scenario: Clicking an airport with both codes present
- **WHEN** the user clicks an airport icon whose feature has a non-null `iata_code` and `icao_code`
- **THEN** a popup opens anchored to that airport showing its IATA code, ICAO code, name, a flag derived from its country code, its city (municipality), and its full country name

#### Scenario: Clicking an airport missing a code
- **WHEN** the user clicks an airport icon whose feature has a `null` `iata_code` or `icao_code`
- **THEN** the popup opens without showing the literal string "null" for that field (e.g. omits the row or shows a placeholder)

#### Scenario: Airport image found
- **WHEN** the user clicks an airport icon and a matching Wikipedia page with a thumbnail image is found for that airport's name
- **THEN** the popup's image row shows that thumbnail image once the lookup resolves

#### Scenario: Airport image not found
- **WHEN** the user clicks an airport icon and no matching Wikipedia page or thumbnail is found (or the lookup fails)
- **THEN** the popup's image row shows a fallback (e.g. the airport icon) instead of a broken image or an indefinite loading state

#### Scenario: Popup closes on request
- **WHEN** the user closes an open airport popup (close control or clicking elsewhere per default MapLibre popup behavior)
- **THEN** the popup is removed from the map

#### Scenario: Popup unavailable while airports layer is hidden
- **WHEN** the airports layer is toggled off
- **THEN** no airport popup can be opened, since there are no airport icons to click

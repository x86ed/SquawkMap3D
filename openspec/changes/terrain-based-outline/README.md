# terrain-based-outline

Add a toggleable terrain-based range outline layer that reads the running adsb.im (`dirkhh/adsb-feeder-image`) instance's own server-generated `upintheair.json` (produced by its existing HeyWhatsThat panorama integration, proxied same-origin the same way `outline.json`/`receiver.json` already are) and renders per-altitude line-of-sight range profiles, the same way tar1090's own `drawUpintheair()` consumes that same file.

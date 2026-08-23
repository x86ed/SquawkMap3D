## ADDED Requirements

### Requirement: Deploy script ships a production build, not a dev server
Running the deploy script SHALL produce and ship a production build of the app (compiled ahead of time via `next build`) to the feeder box, and SHALL NOT start or rely on `next dev` or any file-watching/hot-reload server, on either the local machine or the feeder box.

#### Scenario: Successful deploy
- **WHEN** the deploy script is run from a developer machine with the feeder reachable over SSH at `root@adsb-feeder.local` using the key at `~/.ssh/adsb_feeder`, and the feeder box's required file-server runtime is already present
- **THEN** the script builds the app locally with `next build`, ships the compiled static output to the feeder box, and the feeder box ends up serving that precompiled build with no on-box compilation, no dev-server process, and no application runtime process beyond a static file server

#### Scenario: Redeploy picks up new code
- **WHEN** the deploy script is run again after the local working tree has changed since the previous deploy
- **THEN** the running service on the feeder box is replaced with a build reflecting the new local working tree, not the previous deploy's code

### Requirement: Service listens on port 7500 and survives crashes and reboots
The deployed app SHALL run as a system service bound to port 7500 on the feeder box, SHALL restart automatically if the process exits unexpectedly, and SHALL start automatically after the feeder box reboots, without requiring the deploy script to be re-run.

#### Scenario: Service reachable after deploy
- **WHEN** a deploy completes successfully
- **THEN** the app responds to HTTP requests on `adsb-feeder.local:7500`

#### Scenario: Service recovers from a crash
- **WHEN** the deployed app process exits unexpectedly while the feeder box stays running
- **THEN** the service supervisor restarts the app process without manual intervention

#### Scenario: Service survives a reboot
- **WHEN** the feeder box is rebooted after a successful deploy
- **THEN** the app is running again on port 7500 once the box finishes booting, without the deploy script being re-run

### Requirement: Deploy verifies the deployed service is healthy before succeeding
The deploy script SHALL confirm the deployed service is actually serving requests on port 7500 before reporting success, and SHALL exit with a non-zero status and a clear error message if the service does not become healthy within a bounded time after deploy.

#### Scenario: Health check passes
- **WHEN** the deploy script has shipped a build and restarted the remote service
- **THEN** it polls the deployed app's health endpoint over the network on port 7500 and reports success only once that endpoint responds successfully

#### Scenario: Health check fails
- **WHEN** the deployed service does not respond successfully on port 7500 within the script's retry/timeout window after a deploy
- **THEN** the deploy script exits with a non-zero status and an error message identifying that the health check failed, rather than silently reporting success

### Requirement: Deploy script fails fast on missing prerequisites
The deploy script SHALL check its required local and remote prerequisites before making any destructive or partial change on the feeder box, and SHALL abort with a specific, actionable error message when a prerequisite is missing, rather than leaving the feeder box in a half-deployed state.

#### Scenario: Missing local SSH key
- **WHEN** the deploy script is run and the SSH key at `~/.ssh/adsb_feeder` does not exist or is not usable
- **THEN** the script aborts before attempting any remote connection, with an error identifying the missing key

#### Scenario: Feeder unreachable over SSH
- **WHEN** the deploy script is run and `root@adsb-feeder.local` cannot be reached over SSH with the configured key
- **THEN** the script aborts before building or shipping anything, with an error identifying the connection failure

#### Scenario: Remote file-server runtime missing
- **WHEN** the deploy script is run and the feeder box does not have the runtime required to serve the deployed static build installed
- **THEN** the script aborts before shipping a build, with an error identifying the missing runtime and instructions to install it manually

### Requirement: Deploy wires the app to the feeder's own live decoder feed, same-origin, without modifying the decoder or web server that provides it
When deploying to a feeder box that already has a recognizable ADS-B decoder output (an `aircraft.json` file at one of the well-known decoder locations), the deploy script SHALL make that live feed available to the deployed app from the same origin it is served from (no cross-origin request required), without reading, writing, or otherwise modifying any configuration or service belonging to software already running on the feeder box.

#### Scenario: Decoder feed found and wired up
- **WHEN** the deploy script runs against a feeder box with a recognizable decoder `aircraft.json` output present
- **THEN** after the deploy, the deployed app can fetch that live feed from its own origin (the same host and port the app itself is served from), without a cross-origin request and without any CORS configuration having been added anywhere

#### Scenario: No decoder feed found
- **WHEN** the deploy script runs against a feeder box where no recognizable decoder `aircraft.json` output can be located
- **THEN** the deploy still completes successfully; the script logs a clear, visible warning that no feed was found, rather than failing the deploy or silently succeeding with no indication

#### Scenario: Existing decoder/web-server configuration is untouched
- **WHEN** a deploy runs, whether or not a decoder feed is found
- **THEN** no file, configuration, or service belonging to the feeder's existing ADS-B decoder or web server is created, modified, or removed by the deploy script — only files under the deployed app's own directory and its own service definition are written

### Requirement: Deploy does not interfere with the feeder's existing tar1090 install
The deployed app is a sideloaded viewer running alongside the feeder's existing tar1090 install, not a replacement for it. Deploying, redeploying, or removing the deployed app SHALL NOT stop, restart, reconfigure, degrade, or otherwise affect tar1090's own availability or behavior on the feeder box.

#### Scenario: tar1090 remains available through a deploy
- **WHEN** a deploy (or redeploy) completes on a feeder box where tar1090 was already running and reachable
- **THEN** tar1090 remains reachable and functioning exactly as before the deploy, on whatever port/path it was already using

#### Scenario: Removing the deployed app leaves tar1090 unaffected
- **WHEN** the deployed app's service and files are removed from the feeder box (per the documented uninstall steps)
- **THEN** tar1090's own service, configuration, and availability are unaffected

## ADDED Requirements

### Requirement: Deploy script ships a production build, not a dev server
Running the deploy script SHALL produce and ship a production build of the app (compiled ahead of time via `next build`) to the feeder box, and SHALL NOT start or rely on `next dev` or any file-watching/hot-reload server, on either the local machine or the feeder box.

#### Scenario: Successful deploy
- **WHEN** the deploy script is run from a developer machine with the feeder reachable over SSH at `root@adsb-feeder.local` using the key at `~/.ssh/adsb_feeder`, and the feeder box's required runtime is already present
- **THEN** the script builds the app locally with `next build`, ships the compiled output to the feeder box, and the feeder box ends up running that precompiled build with no on-box compilation and no dev-server process

#### Scenario: Redeploy picks up new code
- **WHEN** the deploy script is run again after the local working tree has changed since the previous deploy
- **THEN** the running service on the feeder box is replaced with a build reflecting the new local working tree, not the previous deploy's code

### Requirement: Service listens on port 7500 and survives crashes and reboots
The deployed app SHALL run as a system service bound to port 7500 on the feeder box, SHALL restart automatically if the process exits unexpectedly, and SHALL start automatically after the feeder box reboots, without requiring the deploy script to be re-run.

#### Scenario: Service reachable after deploy
- **WHEN** a deploy completes successfully
- **THEN** the app responds to HTTP requests on `adsb-feeder.local:7500`

#### Scenario: Service recovers from a crash
- **WHEN** the web server process serving the deployed app exits unexpectedly while the feeder box stays running
- **THEN** its service supervisor restarts it without manual intervention, and the deployed app becomes reachable again

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

#### Scenario: Remote Docker missing
- **WHEN** the deploy script is run and the feeder box does not have Docker installed and running
- **THEN** the script aborts before shipping a build, with an error identifying that Docker is missing and instructions to resolve it manually

### Requirement: Deploy points the app at the feeder's own live decoder feed, without modifying any existing decoder or web server
The deployed app SHALL be configured to fetch live aircraft data from the feeder's own existing decoder output, without reading, writing, or otherwise modifying any configuration or service belonging to software already running on the feeder box.

#### Scenario: Feed reachable after deploy
- **WHEN** the deploy script runs and completes successfully
- **THEN** the deployed app can fetch live aircraft data from the feeder's existing decoder output over a plain HTTP request, without any CORS configuration having been added by the deploy script

#### Scenario: Existing decoder/container configuration is untouched
- **WHEN** a deploy runs
- **THEN** no file, configuration, or container belonging to the feeder's existing ADS-B decoder software is created, modified, or removed by the deploy script — only the deployed app's own container and files are written

### Requirement: Deploy does not interfere with the feeder's existing tar1090 install
The deployed app is a sideloaded viewer running alongside the feeder's existing tar1090 install, not a replacement for it. Deploying, redeploying, or removing the deployed app SHALL NOT stop, restart, reconfigure, degrade, or otherwise affect tar1090's own availability or behavior on the feeder box.

#### Scenario: tar1090 remains available through a deploy
- **WHEN** a deploy (or redeploy) completes on a feeder box where tar1090 was already running and reachable
- **THEN** tar1090 remains reachable and functioning exactly as before the deploy, on whatever port/path it was already using

#### Scenario: Removing the deployed app leaves tar1090 unaffected
- **WHEN** the deployed app's service and files are removed from the feeder box (per the documented uninstall steps)
- **THEN** tar1090's own service, configuration, and availability are unaffected

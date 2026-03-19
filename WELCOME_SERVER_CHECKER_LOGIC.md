# Welcome Page Server Checker Logic

## Purpose
The Welcome screen performs a startup connectivity check to decide whether the app should:
- continue in online mode, or
- continue in offline mode (if cached pathfinding data exists).

It also drives the startup progress UI and labels while checking the backend.

## Main Files Involved
- `screens/WelcomeScreen.js`
- `services/ApiService.js`
- `services/OfflineService.js`
- `config.js` (`API_BASE_URL`, `API_ENDPOINTS.PING`)

## High-Level Flow
1. Welcome screen mounts.
2. After a 1700 ms intro delay, `checkServerConnection()` starts.
3. Screen sends a lightweight ping request to `/api/mobile/ping/`.
4. If ping returns `{ isOnline: true }`, app marks connection as success and enables buttons.
5. If ping fails, times out, or returns unexpected shape, app switches to offline decision flow.
6. Offline decision checks cached pathfinding availability and updates message accordingly.
7. User can continue either way once check is finished.

## Startup Trigger
On mount, Welcome screen runs `startupCheck()` in `useEffect`.

Behavior:
- Reads `OfflineService.isPathfindingAvailable()`.
- Reads `HAS_INITIAL_DOWNLOAD` from AsyncStorage.
- Waits 1700 ms (for intro animation).
- Calls `checkServerConnection()`.

Note:
- `hasData` and `initialDownloadDone` are read but not currently used to branch before ping.

## Server Check Implementation
`checkServerConnection()` does the following:

1. Set initial checking state:
   - `checking: true`
   - `connected: false`
   - `canContinue: false`
   - message: `Checking server connection...`

2. Update loading UI:
   - Label -> `Checking Internet Connection`
   - Progress animation to 30%

3. Start wake-up label timer:
   - After 5000 ms, label changes to `Waking Up Server...`
   - Intended for Render cold starts.

4. Perform ping with hard timeout guard:
   - Uses `Promise.race` between:
     - `ApiService.ping()`
     - manual timeout reject at 65000 ms (`Connection timeout`)

5. On success (`response?.isOnline === true`):
   - Label/progress sequence:
     - `Server Connected` -> 65%
     - `Preparing App` -> 90%
     - `Ready` -> 100%
   - Set status:
     - `checking: false`
     - `connected: true`
     - `canContinue: true`
     - `offlineAvailable: false`
   - Show action buttons.

6. On non-true ping result or error:
   - Label -> `Server Unavailable` or `Connection Failed`
   - Progress -> 100%
   - Call `handleOfflineMode()`.

7. Cleanup:
   - Clears wake-up timer in both success and error paths.

## Ping Request Details (`ApiService.ping`)
- Endpoint: `API_ENDPOINTS.PING` => `/api/mobile/ping/`
- Base URL: `API_BASE_URL`
- Axios timeout override: 60000 ms
- Returns:
  - `{ isOnline: true }` when response shape is valid
  - `{ isOnline: false }` when response shape is unexpected
- Throws on network/transport errors so Welcome screen catch block handles fallback.

## Offline Decision Logic
`handleOfflineMode()`:
1. Calls `OfflineService.isPathfindingAvailable()`.
2. Sets status:
   - `checking: false`
   - `connected: false`
   - `canContinue: true`
   - `offlineAvailable: <boolean>`
   - message:
     - `Server unavailable - Offline mode available`, or
     - `Server unavailable - No offline data`
3. Shows action buttons.

## Retry Flow
`handleRetry()` resets checker UI state and re-runs `checkServerConnection()`:
- hides buttons
- resets progress to 0
- resets loading label to `Initializing...`
- resets dot/animation state
- starts check again

## UI States Summary
`connectionStatus` fields:
- `checking`: currently verifying connection
- `connected`: online ping succeeded
- `message`: user-facing status message
- `canContinue`: allows navigation to next screen
- `offlineAvailable`: cached offline data exists

## Timeout and Cold-Start Strategy
- Ping request timeout: 60000 ms (Axios level)
- Outer guard timeout: 65000 ms (`Promise.race`)
- Wake-up label appears at 5000 ms to communicate likely server cold start

This avoids false offline fallback during slow Render wake-up periods.

## Backend Contract Expected
Ping endpoint should return quickly and consistently:

```json
{ "isOnline": true }
```

## Practical Diagnostic Notes
- The Welcome checker issues only one ping call per check attempt.
- Per-install limiter can block burst traffic, but is less likely to block this single-ping startup path.
- If startup still fails intermittently, inspect transport errors (DNS/TLS/network), 429 responses, and Render cold-start behavior.

## Pseudocode
```text
onWelcomeMount:
  wait 1700 ms
  checkServerConnection()

checkServerConnection:
  set checking state
  show progress 30%
  after 5s show "Waking Up Server..."

  response = race(
    ApiService.ping(timeout=60s),
    reject after 65s
  )

  if response.isOnline == true:
    animate to 100%
    set connected=true, canContinue=true
    show buttons
  else:
    handleOfflineMode()

catch any error:
  handleOfflineMode()

handleOfflineMode:
  offlineAvailable = OfflineService.isPathfindingAvailable()
  set canContinue=true
  show offline message
  show buttons
```

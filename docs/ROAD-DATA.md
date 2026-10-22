# Real-road matrices: optional, operator-provided

RouteRescue's default Northbank map uses fictional coordinates and Manhattan travel estimates. **Those coordinates have no connection to real street addresses.** No external routing requests are made when running the included demo.

The optional directed road matrix adapter supports time and distance values produced by a user-authorised OSRM-compatible routing server. Road data can be asymmetric; the required `A>B` and `B>A` legs are separate. Service time, stop windows and all existing constraints continue to be checked independently.

Prepare a separate manifest JSON with `depot:{id:"depot",lat:<number>,lon:<number>}` and `stops:[{id:"s1",lat:<number>,lon:<number>},...]`. Obtain and use these coordinates only with appropriate consent and privacy safeguards. Set `OSRM_BASE_URL` to a routing service you operate or are authorised to use, then run:

```powershell
$env:OSRM_BASE_URL = "https://your-authorised-routing-service.example"
node scripts/build-road-matrix.js my-geocoded-manifest.json my-road-matrix.json
```

The script writes a validated `travelMatrix` object. Add that object to the manifest used by the planner. The app does not geocode names or addresses and never falls back silently to fake travel times when a directed matrix leg is missing. The OSRM adapter was implemented and synthetically tested; it has **not** been exercised against a live externally hosted road service in this delivery.

Optional engine providers, map data licensing, traffic profile freshness, time-dependent traffic and driver-specific restrictions must be assessed before deployment. The resulting matrix is only as trustworthy as its source.

# RouteRescue Incident Lab — Windows 10/11 setup

## 1. Install Node.js

Install Node.js **22.12.0 or newer**, with npm, from its official site: https://nodejs.org/en/download . No Python, Git, compiler, Docker, database or cloud login is required to run the ZIP. Use the Windows installer and keep **Add to PATH** enabled.

Open a new Command Prompt and confirm:

```powershell
node --version
npm --version
```

## 2. Extract the entire archive

Extract the ZIP to a short local path such as `C:\Projects\routerescue`. Avoid running scripts from inside the ZIP, and avoid OneDrive sync or extremely deep folder names where possible.

## 3. One-click start

Double-click **`setup.bat`** to run all local unit tests. Then double-click **`start.bat`** and keep the resulting Command Prompt open. Your default browser opens at **http://127.0.0.1:4173**.

There are **no external package dependencies** and **no required API keys**. The program works without internet access after extraction.

## 4. Manual PowerShell path

Open PowerShell inside the folder:

```powershell
node --version
npm test
npm run smoke
node server/index.js
```

Go to `http://127.0.0.1:4173` in a browser.

## 5. Keys and configuration

Nothing to configure for the demo. `.env.example` lists optional values but is not automatically loaded. If port 4173 is occupied, start manually with:

```powershell
$env:PORT='4181'
node server/index.js
```

Then open `http://127.0.0.1:4181`.

## 6. Reproduce the strongest demo

1. Choose **Enter Incident Lab** → **Resilience Lab**.
2. Select **Load cascade + capacity failure**. Four fictional volunteers are unavailable, leaving 32 stop slots for 40 deliveries.
3. Click **Find minimum intervention**. Observe the independently checked eight-slot lower bound and a real 40/40 feasible recovery.
4. Change the available drivers or policy and recalculate; hypothetical plans never silently commit.
5. Return to Dispatch and open **Evidence Centre** from the sidebar. Its 128-case external SciPy HiGHS reference report, 82-case curated agent challenge report, and live MCP challenge form all use actual project data.
6. To check an exported route certificate: `node scripts/verify-certificate.js path\to\routerescue-recovery-certificate.json`.

The external reference research optionally needs Python/SciPy, but the interactive demonstration does not.

## 7. Fix common Windows issues

| Problem | Fix |
|---|---|
| `node` or `npm` not recognised | Reinstall Node.js with PATH enabled; close/reopen the terminal. |
| PowerShell blocks running local scripts | Use `setup.bat` / `start.bat`; they do not require changes to your PowerShell execution policy. |
| Port 4173 already used | Override with `$env:PORT='4181'` in PowerShell before launching. |
| SmartScreen or antivirus warns about unknown scripts | Inspect the plain-text `.bat` scripts first. Run only if you trust the extracted files. Never disable your antivirus globally. |
| Path too long or OneDrive lock | Re-extract to `C:\Projects\routerescue` and close sync tools accessing the folder. |
| Missing native build tools | None should be needed; the app uses Node built-ins and no third-party packages. Ensure Node is at least 22.12. |
| Browser says it cannot connect | Keep the Command Prompt server window open; check its local URL and allow 127.0.0.1. |
| Unexpected old demo data | Use **Reset 40-stop lab** in the Incident Lab sidebar, or enter it again from the overview. |
| Commit is disabled | Partial plans cannot be committed; choose a feasible scenario with more drivers, e.g. Cascading failure. |

## 8. Stop

Press **Ctrl+C** in the server console, or close its window. Your on-disk fictional state persists in `data/state.json` until reset. No background cloud service is left running.

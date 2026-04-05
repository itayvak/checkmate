# Check Mate

אפליקציה לבדיקה שוטפת של תר"צים ומבחנים בקוד.
לאחר העלאת הסורסים של חניכים, ניתן להריץ אותם בצורה אוטומטית ולקבל תוצאות על ההרצה, וניתן לג'נרט הערות על הקוד בצורה אוטומטית.

יצירת סקריפט בדיקה אוטומטית וג'ינרוט הערות נעשה בעזרת AI.

## Windows deployment (fresh VM)

Prerequisites: PowerShell and network access. **Run PowerShell as Administrator** so `winget` can install Python, Node.js, and Git reliably, and so the installer can open Windows Firewall for TCP **3000** (Vite preview) and **5000** (Flask).

**Bootstrap (paste into PowerShell).** Do not nest another `powershell -Command` unless the **whole** download + run sequence stays inside **one** pair of quotes—otherwise `-OutFile` is not part of `Invoke-WebRequest` and you get errors like `Cannot find drive. A drive with the name '\C' does not exist`.

```powershell
Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/itayvak/checkmate/main/scripts/windows/install.ps1' -OutFile "$env:TEMP\checkmate-install.ps1" -UseBasicParsing
& "$env:TEMP\checkmate-install.ps1" -RepoUrl 'https://github.com/itayvak/checkmate.git'
```

VPN / winget issues: use direct installers only:

```powershell
& "$env:TEMP\checkmate-install.ps1" -RepoUrl 'https://github.com/itayvak/checkmate.git' -DirectOnly
```

One line (same thing):

```powershell
Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/itayvak/checkmate/main/scripts/windows/install.ps1' -OutFile "$env:TEMP\checkmate-install.ps1" -UseBasicParsing; & "$env:TEMP\checkmate-install.ps1" -RepoUrl 'https://github.com/itayvak/checkmate.git'
```

If you must invoke from **cmd.exe** (single nested `powershell` call), keep download and execute inside one `-Command "..."` string, for example:

```bat
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/itayvak/checkmate/main/scripts/windows/install.ps1' -OutFile \"$env:TEMP\checkmate-install.ps1\" -UseBasicParsing; & \"$env:TEMP\checkmate-install.ps1\" -RepoUrl 'https://github.com/itayvak/checkmate.git'"
```

Only run one-liners from sources you trust; confirm the `raw.githubusercontent.com` URL matches your repository.

The script installs dependencies via **winget** (with automatic **fallback** to direct downloads from python.org, nodejs.org, and git-scm if winget fails). The direct Node.js step uses the official **Windows x64 zip** unpacked under `%LOCALAPPDATA%\checkmate-node` (not an MSI), so it does not rely on `msiexec`. It then clones the repo (or updates an existing clone), runs `npm ci` and `npm run build` in `front/`, creates a Python venv in `back/` and installs `requirements.txt`, and writes **`RunCheckmate.cmd`** in the install folder (default `%USERPROFILE%\checkmate`). To **skip winget entirely** (recommended on locked-down VPNs), run the script with **`-DirectOnly`**.

Double-click **`RunCheckmate.cmd`** to start the backend and frontend in two windows. Open **`http://<VM_IP>:3000`** in a browser (the UI proxies `/api` to Flask on the same machine). Health check: `http://<VM_IP>:5000/healthz`.

If the installer was not run as Administrator, add inbound firewall rules for TCP 3000 and 5000 manually, or re-run [scripts/windows/install.ps1](scripts/windows/install.ps1) elevated. To skip firewall rules even when elevated: `-SkipFirewall`.

### winget / VPN / certificate errors (`msstore`, `0x8a15005e`)

That usually means TLS to the **Microsoft Store** endpoint failed (VPN, SSL inspection, or certificate pinning). The installer **removes** the `msstore` source (`winget source remove -n msstore`) when possible, uses **`--source winget`** for packages, and can enable **`BypassCertificatePinningForMicrosoftStore`** when run **as Administrator**.

If the error **persists**, use **`-DirectOnly`** so the script never calls `winget` for Python/Node/Git (it downloads the official installers instead). You can also run **`winget source remove -n msstore`** yourself in an elevated PowerShell, then re-run the script.
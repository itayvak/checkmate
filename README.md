# Check Mate

אפליקציה לבדיקה שוטפת של תר"צים ומבחנים בקוד.
לאחר העלאת הסורסים של חניכים, ניתן להריץ אותם בצורה אוטומטית ולקבל תוצאות על ההרצה, וניתן לג'נרט הערות על הקוד בצורה אוטומטית.

יצירת סקריפט בדיקה אוטומטית וג'ינרוט הערות נעשה בעזרת AI.

## Windows deployment (fresh VM)

Prerequisites: PowerShell and network access. **Run PowerShell as Administrator** so `winget` can install Python, Node.js, and Git reliably, and so the installer can open Windows Firewall for TCP **3000** (Vite preview) and **5000** (Flask).

**One-liner** (downloads the install script from GitHub without needing Git installed first). Replace `<OWNER>`, `<REPO>`, and optionally `<BRANCH>`; set `-RepoUrl` to your repo’s HTTPS clone URL:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/itaypoo/checkmate/main/scripts/windows/install.ps1' -OutFile \"$env:TEMP\checkmate-install.ps1\"; & \"$env:TEMP\checkmate-install.ps1\" -RepoUrl 'https://github.com/<OWNER>/<REPO>.git'"
```

Only run one-liners from sources you trust; confirm the `raw.githubusercontent.com` URL matches your repository.

The script installs dependencies via **winget**, clones the repo (or updates an existing clone), runs `npm ci` and `npm run build` in `front/`, creates a Python venv in `back/` and installs `requirements.txt`, and writes **`RunCheckmate.cmd`** in the install folder (default `%USERPROFILE%\checkmate`).

Double-click **`RunCheckmate.cmd`** to start the backend and frontend in two windows. Open **`http://<VM_IP>:3000`** in a browser (the UI proxies `/api` to Flask on the same machine). Health check: `http://<VM_IP>:5000/healthz`.

If the installer was not run as Administrator, add inbound firewall rules for TCP 3000 and 5000 manually, or re-run [scripts/windows/install.ps1](scripts/windows/install.ps1) elevated. To skip firewall rules even when elevated: `-SkipFirewall`.
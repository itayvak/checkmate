#Requires -Version 5.1
<#
.SYNOPSIS
  Installs prerequisites (winget or direct downloads), clones the repo, builds the frontend, sets up the Python venv, and writes RunCheckmate.cmd.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string] $RepoUrl,
  [string] $InstallDir = (Join-Path $env:USERPROFILE "checkmate"),
  [string] $Branch = "main",
  [switch] $SkipFirewall,
  # Skip winget entirely: download official Python / Node / Git installers (use when VPN breaks winget + msstore).
  [switch] $DirectOnly
)

$ErrorActionPreference = "Stop"

# Pinned URLs for -DirectOnly (update occasionally).
$script:PythonInstallerUrl = "https://www.python.org/ftp/python/3.12.8/python-3.12.8-amd64.exe"
$script:NodeMsiUrl = "https://nodejs.org/dist/v20.18.1/node-v20.18.1-x64.msi"
$script:GitInstallerUrl = "https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.1/Git-2.47.1-64-bit.exe"

function Refresh-Path {
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
    [System.Environment]::GetEnvironmentVariable("Path", "User")
}

function Test-CommandAvailable {
  param([string] $Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Test-Administrator {
  return ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
  )
}

function Disable-WingetMsStoreSource {
  Write-Host "winget: removing 'msstore' source so WinGet does not contact the Microsoft Store (VPN / cert pinning) ..."
  # WinGet 1.2+ uses `source remove` (there is no `source disable` on current builds).
  & winget source remove -n msstore --disable-interactivity 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "Could not remove msstore source (exit $LASTEXITCODE). Run this script as Administrator, or use -DirectOnly."
  }
}

function Enable-WingetStoreCertBypassIfPossible {
  if (-not (Test-Administrator)) {
    return
  }
  Write-Host "winget: enabling BypassCertificatePinningForMicrosoftStore (helps some SSL inspection / VPN setups) ..."
  & winget settings --enable BypassCertificatePinningForMicrosoftStore --disable-interactivity 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "Could not enable certificate-pinning bypass (exit $LASTEXITCODE)."
  }
}

function Install-WingetPackage {
  param([string] $Id)
  Write-Host "winget: installing or upgrading $Id (source: winget) ..."
  & winget install --id $Id -e --source winget --accept-package-agreements --accept-source-agreements --disable-interactivity
  if ($LASTEXITCODE -ne 0) {
    throw "winget install failed for $Id (exit $LASTEXITCODE)."
  }
}

function Install-Download {
  param([string] $Uri, [string] $OutFile)
  Write-Host "Downloading: $Uri -> $OutFile"
  Invoke-WebRequest -Uri $Uri -OutFile $OutFile -UseBasicParsing
}

function Install-PrerequisitesDirect {
  Write-Host "Direct install mode: downloading official installers (no winget) ..."
  $tmp = $env:TEMP
  $py = Join-Path $tmp "checkmate-python-3.12-amd64.exe"
  $nodeMsi = Join-Path $tmp "checkmate-node-lts-x64.msi"
  $git = Join-Path $tmp "checkmate-git-64-bit.exe"

  Install-Download -Uri $script:PythonInstallerUrl -OutFile $py
  Write-Host "Installing Python (user scope, add to PATH) ..."
  $pyArgs = @(
    "/quiet", "InstallAllUsers=0", "PrependPath=1", "Include_pip=1", "Include_launcher=1",
    "Include_test=0"
  )
  Start-Process -FilePath $py -ArgumentList $pyArgs -Wait -NoNewWindow

  Install-Download -Uri $script:NodeMsiUrl -OutFile $nodeMsi
  Write-Host "Installing Node.js LTS (per-user MSI when possible) ..."
  & msiexec.exe /i $nodeMsi ALLUSERS=2 MSIINSTALLPERUSER=1 /qn /norestart
  if ($LASTEXITCODE -ne 0) {
    throw "msiexec failed for Node (exit $LASTEXITCODE). Try running the script as Administrator."
  }

  Install-Download -Uri $script:GitInstallerUrl -OutFile $git
  Write-Host "Installing Git for Windows ..."
  $gitArgs = @(
    "/VERYSILENT", "/NORESTART", "/NOCANCEL", "/SP-", "/CLOSEAPPLICATIONS", "/RESTARTAPPLICATIONS",
    "/COMPONENTS=icons,ext\reg\shellhere,assoc,assoc_sh"
  )
  Start-Process -FilePath $git -ArgumentList $gitArgs -Wait -NoNewWindow
}

function Install-Prerequisites {
  if ($DirectOnly) {
    Install-PrerequisitesDirect
    Refresh-Path
    return
  }

  if (-not (Test-CommandAvailable "winget")) {
    Write-Error "winget is not available. Install 'App Installer', or re-run with -DirectOnly."
  }

  if (-not (Test-Administrator)) {
    Write-Host "Note: Removing the winget 'msstore' source usually requires Administrator. On VPN, if winget fails with msstore/certificate errors, stop and re-run with -DirectOnly."
  }

  Disable-WingetMsStoreSource
  Enable-WingetStoreCertBypassIfPossible

  $wingetFailed = $false
  try {
    Install-WingetPackage "Python.Python.3.12"
    Install-WingetPackage "OpenJS.NodeJS.LTS"
    Install-WingetPackage "Git.Git"
  } catch {
    Write-Warning $_.Exception.Message
    $wingetFailed = $true
  }

  Refresh-Path

  if (-not $wingetFailed) {
    if ((Test-CommandAvailable "git") -and (Test-CommandAvailable "python") -and (Test-CommandAvailable "npm")) {
      return
    }
    Write-Warning "winget reported success but git/python/npm not on PATH; trying direct installers ..."
    $wingetFailed = $true
  }

  if ($wingetFailed) {
    Write-Host "Falling back to direct downloads (-DirectOnly style) ..."
    Install-PrerequisitesDirect
    Refresh-Path
  }
}

Install-Prerequisites

if (-not (Test-CommandAvailable "git")) {
  Write-Error "git was not found on PATH after install. Open a new PowerShell window and re-run this script."
}
if (-not (Test-CommandAvailable "python")) {
  Write-Error "python was not found on PATH after install. Open a new PowerShell window and re-run this script."
}
if (-not (Test-CommandAvailable "npm")) {
  Write-Error "npm was not found on PATH after install. Open a new PowerShell window and run this script again."
}

$resolvedInstall = [System.IO.Path]::GetFullPath($InstallDir)
if (Test-Path $resolvedInstall) {
  $gitDir = Join-Path $resolvedInstall ".git"
  if (Test-Path $gitDir) {
    Write-Host "Updating existing clone at $resolvedInstall ..."
    Push-Location $resolvedInstall
    try {
      git fetch origin
      git checkout $Branch
      git pull origin $Branch
    } finally {
      Pop-Location
    }
  } else {
    Write-Error "InstallDir exists and is not a git repository: $resolvedInstall"
  }
} else {
  Write-Host "Cloning $RepoUrl (branch $Branch) -> $resolvedInstall ..."
  git clone -b $Branch $RepoUrl $resolvedInstall
}
$front = Join-Path $resolvedInstall "front"
$back = Join-Path $resolvedInstall "back"
if (-not (Test-Path $front) -or -not (Test-Path $back)) {
  Write-Error "Repository layout missing 'front' or 'back' under $resolvedInstall"
}
Write-Host "npm ci + build (front) ..."
Push-Location $front
try {
  npm ci
  npm run build
} finally {
  Pop-Location
}
Write-Host "Python venv + pip (back) ..."
Push-Location $back
try {
  if (-not (Test-Path ".venv")) {
    python -m venv .venv
  }
  & .\.venv\Scripts\python.exe -m pip install --upgrade pip
  & .\.venv\Scripts\pip.exe install -r requirements.txt
} finally {
  Pop-Location
}
$launcherPath = Join-Path $resolvedInstall "RunCheckmate.cmd"
$backSlash = $back.Replace("/", "\")
$frontSlash = $front.Replace("/", "\")
$cmdContent = @"
@echo off
REM Checkmate: backend (Flask) + frontend (Vite preview), bound to all interfaces.
start "Checkmate Backend" cmd /k "cd /d ""$backSlash"" && call .venv\Scripts\activate.bat && python main.py"
start "Checkmate Frontend" cmd /k "cd /d ""$frontSlash"" && npm run preview -- --host 0.0.0.0 --port 3000"
"@
Set-Content -Path $launcherPath -Value $cmdContent -Encoding ASCII
Write-Host "Wrote launcher: $launcherPath"
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator
)
if ($isAdmin -and -not $SkipFirewall) {
  Write-Host "Adding Windows Firewall rules for TCP 3000 and 5000 ..."
  $existing = Get-NetFirewallRule -DisplayName "Checkmate HTTP 3000" -ErrorAction SilentlyContinue
  if (-not $existing) {
    New-NetFirewallRule -DisplayName "Checkmate HTTP 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow | Out-Null
  }
  $existing2 = Get-NetFirewallRule -DisplayName "Checkmate HTTP 5000" -ErrorAction SilentlyContinue
  if (-not $existing2) {
    New-NetFirewallRule -DisplayName "Checkmate HTTP 5000" -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow | Out-Null
  }
} elseif (-not $isAdmin) {
  Write-Host "Not running as Administrator: skip firewall rules. Allow TCP 3000 and 5000 inbound manually if needed."
}
Write-Host ""
Write-Host "Done. Double-click RunCheckmate.cmd in:"
Write-Host "  $resolvedInstall"
Write-Host "Then open http://<this-machine-ip>:3000 in a browser."

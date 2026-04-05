#Requires -Version 5.1
<#
.SYNOPSIS
  Installs prerequisites (winget), clones the repo, builds the frontend, sets up the Python venv, and writes RunCheckmate.cmd.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string] $RepoUrl,
  [string] $InstallDir = (Join-Path $env:USERPROFILE "checkmate"),
  [string] $Branch = "main",
  [switch] $SkipFirewall
)
$ErrorActionPreference = "Stop"
function Refresh-Path {
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
    [System.Environment]::GetEnvironmentVariable("Path", "User")
}
function Test-CommandAvailable {
  param([string] $Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}
function Install-WingetPackage {
  param([string] $Id)
  Write-Host "winget: installing or upgrading $Id (source: winget only, not Microsoft Store) ..."
  # --source winget avoids the msstore source, which often fails behind VPN / SSL inspection
  # with certificate errors (e.g. 0x8a15005e).
  winget install --id $Id -e --source winget --accept-package-agreements --accept-source-agreements
}
if (-not (Test-CommandAvailable "winget")) {
  Write-Error "winget is not available. Install 'App Installer' from the Microsoft Store, then re-run this script."
}
Install-WingetPackage "Python.Python.3.12"
Install-WingetPackage "OpenJS.NodeJS.LTS"
Install-WingetPackage "Git.Git"
Refresh-Path
if (-not (Test-CommandAvailable "git")) {
  Write-Error "git was not found on PATH after install. Open a new PowerShell window and run this script again, or add Git to PATH."
}
if (-not (Test-CommandAvailable "python")) {
  Write-Error "python was not found on PATH after install. Open a new PowerShell window and run this script again."
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

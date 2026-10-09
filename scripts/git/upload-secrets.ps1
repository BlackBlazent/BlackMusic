```powershell
# upload-secrets.ps1
# Run from the BlackMusic repository root.
# Loads populated variables from .env and uploads them to GitHub Actions.

$ErrorActionPreference = "Stop"

$repo = "BlackBlazent/BlackMusic"
$envPath = Join-Path (Get-Location) ".env"

# Verify GitHub CLI authentication.
gh auth status
if ($LASTEXITCODE -ne 0) {
    throw "Run 'gh auth login' first."
}

if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) {
    throw ".env not found: $envPath"
}

# Read .env without printing any credential values.
# If a variable occurs more than once, the last value wins.
$envValues = @{}

foreach ($line in Get-Content -LiteralPath $envPath) {
    $trimmed = $line.Trim()

    if (-not $trimmed -or $trimmed.StartsWith("#")) {
        continue
    }

    if ($trimmed -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        $name = $Matches[1]
        $value = $Matches[2].Trim()

        # Remove matching surrounding quotes.
        if (
            ($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))
        ) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        $envValues[$name] = $value
    }
}

# These are the names found in your supplied environment configuration.
# Empty values and obvious placeholders are skipped.
$secretNames = @(
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "VITE_YOUTUBE_API_KEY",
    "VITE_GENIUS_ACCESS_TOKEN",
    "VITE_SPOTIFY_CLIENT_ID",
    "VITE_SPOTIFY_CLIENT_SECRET",
    "VITE_YANDEX_MUSIC_TOKEN",
    "VITE_TIDAL_ACCESS_TOKEN",
    "VITE_TIDAL_CLIENT_ID",
    "VITE_TIDAL_CLIENT_SECRET",
    "VITE_TIDAL_COUNTRY",
    "AMAZON_MUSIC_TOKEN",
    "VITE_SOUNDCLOUD_CLIENT_ID",
    "VITE_SOUNDCLOUD_CLIENT_SECRET",
    "VITE_DEEZER_APP_ID",
    "VITE_DEEZER_SECRET_KEY",
    "VITE_PANDORA_API_URL",
    "VITE_PANDORA_API_KEY",
    "VITE_LASTFM_API_KEY",
    "VITE_LASTFM_SECRET",
    "VITE_PROMOTIONS_API_URL",
    "VITE_APP_BASE_URL"
)

$uploaded = 0
$skipped = 0
$failed = @()

foreach ($name in $secretNames) {
    if (-not $envValues.ContainsKey($name)) {
        Write-Host "Skipped missing variable: $name"
        $skipped++
        continue
    }

    $value = $envValues[$name]

    if (
        [string]::IsNullOrWhiteSpace($value) -or
        $value -match '^<[^>]+>$'
    ) {
        Write-Host "Skipped empty or placeholder variable: $name"
        $skipped++
        continue
    }

    # Pipe the value to GitHub CLI without displaying it.
    $value | gh secret set $name --repo $repo

    if ($LASTEXITCODE -ne 0) {
        $failed += $name
        Write-Warning "Failed to upload: $name"
        continue
    }

    Write-Host "Uploaded: $name"
    $uploaded++
}

# Upload the existing Tauri signing key.
$keyPath = Read-Host "Enter the path to your EXISTING Tauri private key file"

if (-not (Test-Path -LiteralPath $keyPath -PathType Leaf)) {
    throw "Signing key file not found: $keyPath"
}

$keyValue = [System.IO.File]::ReadAllText($keyPath).Trim()

if ([string]::IsNullOrWhiteSpace($keyValue)) {
    throw "Signing key file is empty."
}

$keyValue | gh secret set TAURI_SIGNING_PRIVATE_KEY --repo $repo

if ($LASTEXITCODE -ne 0) {
    $failed += "TAURI_SIGNING_PRIVATE_KEY"
} else {
    Write-Host "Uploaded: TAURI_SIGNING_PRIVATE_KEY"
    $uploaded++
}

# Use an existing process environment variable if configured;
# otherwise, securely prompt for the signing password.
$password = $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD

if ([string]::IsNullOrEmpty($password)) {
    $securePassword = Read-Host `
        "Enter your Tauri signing key password" -AsSecureString

    $ptr = [IntPtr]::Zero

    try {
        $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR(
            $securePassword
        )
        $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    }
    finally {
        if ($ptr -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
        }
    }
}

if (-not [string]::IsNullOrEmpty($password)) {
    $password | gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD `
        --repo $repo

    if ($LASTEXITCODE -ne 0) {
        $failed += "TAURI_SIGNING_PRIVATE_KEY_PASSWORD"
    } else {
        Write-Host "Uploaded: TAURI_SIGNING_PRIVATE_KEY_PASSWORD"
        $uploaded++
    }
} else {
    Write-Host "Skipped empty signing password."
    $skipped++
}

# Clear local references where practical.
$keyValue = $null
$password = $null
$securePassword = $null
$envValues.Clear()

Write-Host ""
Write-Host "Upload summary"
Write-Host "Uploaded: $uploaded"
Write-Host "Skipped:  $skipped"
Write-Host "Failed:   $($failed.Count)"

if ($failed.Count -gt 0) {
    Write-Host "Failed secret names:"
    $failed | ForEach-Object { Write-Host " - $_" }
    throw "Some GitHub secrets could not be uploaded."
}

Write-Host "Finished uploading supplied secrets."
```

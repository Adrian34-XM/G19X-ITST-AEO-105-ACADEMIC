# Arranque de Windows en segundo plano; no modifica claves ni datos de Supabase.
param(
    [ValidateRange(1024, 65535)][int]$Port = 3000,
    [switch]$NoAI
)
$ErrorActionPreference = 'Stop'
$nexoRoot = Split-Path -Parent $PSScriptRoot
$nexoLogs = Join-Path $nexoRoot '.local/start-system'
New-Item -ItemType Directory -Path $nexoLogs -Force | Out-Null

function Test-NexoPort([int]$Number) {
    $connection = New-Object System.Net.Sockets.TcpClient
    try {
        $pending = $connection.ConnectAsync('127.0.0.1', $Number)
        return ($pending.Wait(800) -and $connection.Connected)
    } catch { return $false } finally { $connection.Dispose() }
}
function Get-NexoSetting([string]$Name, [string]$Default) {
    $value = [Environment]::GetEnvironmentVariable($Name)
    if ($value) { return $value }
    $file = Join-Path $nexoRoot '.env.local'
    $setting = $null
    if (Test-Path -LiteralPath $file) {
        foreach ($line in [IO.File]::ReadLines($file)) {
            if ($line -match ('^\s*(?:export\s+)?' + [regex]::Escape($Name) + '\s*=\s*(.*?)\s*$')) {
                $setting = ($Matches[1] -replace '\s+#.*$', '').Trim().Trim('"').Trim("'")
            }
        }
    }
    # Como el lector de Node, la ultima declaracion del archivo prevalece.
    if ($null -ne $setting) { return $setting }
    return $Default
}

if (-not $NoAI -and (Get-NexoSetting 'AI_PROVIDER' 'ollama') -eq 'ollama') {
    $aiUrl = [uri](Get-NexoSetting 'OLLAMA_URL' 'http://127.0.0.1:11434')
    if ($aiUrl.Host -in @('localhost', '127.0.0.1') -and $aiUrl.Port -eq 11434) {
        if (-not (Test-NexoPort 11434)) {
            $ollama = Get-Command ollama -ErrorAction SilentlyContinue
            if ($ollama) {
                $service = Start-Process -FilePath $ollama.Source -ArgumentList 'serve' -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $nexoLogs 'ollama.stdout.log') -RedirectStandardError (Join-Path $nexoLogs 'ollama.stderr.log')
                $service.Id | Set-Content -LiteralPath (Join-Path $nexoLogs 'ollama.pid')
                for ($attempt = 0; $attempt -lt 15 -and -not (Test-NexoPort 11434); $attempt++) { Start-Sleep -Seconds 1 }
            } else { Write-Warning 'Ollama no esta instalado. Nexo arrancara; la IA requiere un proveedor disponible.' }
        }
        try {
            $null = Invoke-RestMethod -Uri ("$($aiUrl.AbsoluteUri.TrimEnd('/'))/api/tags") -TimeoutSec 5
            Write-Output 'Ollama responde. Los modelos configurados deben estar descargados.'
        } catch { Write-Warning 'Ollama no responde. Revisa los registros y los modelos antes de usar la IA.' }
    } else { Write-Output 'La direccion de Ollama es externa o usa otro puerto; no se inicia una instancia local.' }
}

if (Test-NexoPort $Port) {
    Write-Output "El puerto $Port ya esta ocupado; se conserva el proceso existente."
} else {
    $node = (Get-Command node -ErrorAction Stop).Source
    if (-not (Test-Path -LiteralPath (Join-Path $nexoRoot 'node_modules/next/dist/bin/next'))) {
        throw 'Faltan dependencias. Ejecuta npm ci en el proyecto antes de arrancar.'
    }
    $app = Start-Process -FilePath $node -ArgumentList @('node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', "$Port") -WorkingDirectory $nexoRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $nexoLogs 'next.stdout.log') -RedirectStandardError (Join-Path $nexoLogs 'next.stderr.log')
    $app.Id | Set-Content -LiteralPath (Join-Path $nexoLogs 'next.pid')
}
$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/login" -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200 -and $response.Content -match 'Nexo') { $ready = $true; break }
    } catch { }
    Start-Sleep -Seconds 1
}
if (-not $ready) { throw "No se pudo confirmar el acceso a Nexo. Revisa $nexoLogs; no se detuvo el proceso del puerto $Port." }
Write-Output "Nexo disponible: http://127.0.0.1:$Port/login"
Write-Output "Registros y PID: $nexoLogs"
Write-Output 'Los procesos continuan en segundo plano al cerrar esta terminal. No se configuro un inicio automatico al encender Windows.'

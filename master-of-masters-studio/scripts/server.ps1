# Native Windows Zero-Dependency High-Performance Static Web Server
param(
    [int]$Port = 7777,
    [string]$RootFolder = ""
)

$projectRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($RootFolder)) {
    $RootFolder = Join-Path $projectRoot "dist"
}

if (-not (Test-Path $RootFolder)) {
    $RootFolder = $projectRoot
}

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
    Write-Output "HTTP Server running on $prefix (Root: $RootFolder)"
} catch {
    Write-Warning "Failed to start listener on $prefix : $_"
    exit 1
}

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8";
    ".htm"  = "text/html; charset=utf-8";
    ".css"  = "text/css; charset=utf-8";
    ".js"   = "application/javascript; charset=utf-8";
    ".mjs"  = "application/javascript; charset=utf-8";
    ".json" = "application/json; charset=utf-8";
    ".wav"  = "audio/wav";
    ".mp3"  = "audio/mpeg";
    ".png"  = "image/png";
    ".jpg"  = "image/jpeg";
    ".svg"  = "image/svg+xml";
    ".ico"  = "image/x-icon";
    ".woff2"= "font/woff2";
    ".woff" = "font/woff";
    ".ttf"  = "font/ttf"
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($urlPath) -or $urlPath -eq "/") {
            $urlPath = "index.html"
        }

        $filePath = Join-Path $RootFolder $urlPath

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
            
            $response.ContentType = $contentType
            $response.AddHeader("Cache-Control", "no-cache")
            $response.AddHeader("Access-Control-Allow-Origin", "*")

            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            # Fallback to index.html for SPA routing
            $indexPath = Join-Path $RootFolder "index.html"
            if (Test-Path $indexPath -PathType Leaf) {
                $response.ContentType = "text/html; charset=utf-8"
                $bytes = [System.IO.File]::ReadAllBytes($indexPath)
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $response.StatusCode = 404
                $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
                $response.OutputStream.Write($msg, 0, $msg.Length)
            }
        }
        $response.OutputStream.Close()
    } catch {
        # Continue listening
    }
}

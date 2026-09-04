# Master of Masters Studio Pro — Colab Autopilot Launcher
# Executado simultaneamente na abertura do software pelo icone no desktop

$colabNotebookUrl = "https://colab.research.google.com/github/Patriarchabraham/OLYMPUS-PATRIARCH/blob/main/master-of-masters-studio/scripts/google_colab_free_music_generator.ipynb"
$notebookPath = Join-Path $PSScriptRoot "google_colab_free_music_generator.ipynb"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  MASTER OF MASTERS STUDIO PRO - COLAB AUTOPILOT SIMULTANEO" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Copia o caminho do notebook para a area de transferencia caso necessario
try {
    if (Test-Path $notebookPath) {
        Set-Clipboard -Value $notebookPath
    }
} catch {}

# 2. Abre o Google Colab DIRETAMENTE no notebook do estudio
Write-Host "1. Abrindo Notebook do Gerador no Google Colab (GPU T4)..." -ForegroundColor White
Start-Process $colabNotebookUrl

# 3. Dispara a execucao automatica na GPU T4 com tentativas progressivas
Write-Host "2. Sincronizando com a GPU T4 do Colab (Autopilot Ativo)..." -ForegroundColor Yellow
$wshell = New-Object -ComObject wscript.shell

function Try-ActivateAndRunColab {
    $colabTitles = @("google_colab", "Colab", "Google Colaboratory", "colab.research.google.com")
    $found = $false
    foreach ($title in $colabTitles) {
        if ($wshell.AppActivate($title)) {
            $found = $true
            break
        }
    }
    if ($found) {
        Start-Sleep -Milliseconds 600
        # Send Ctrl+F9 (Run all / Executar tudo)
        $wshell.SendKeys("^{F9}")
        Start-Sleep -Milliseconds 600
        # Confirm potential "Run anyway" warning dialogs
        $wshell.SendKeys("{ENTER}")
        Start-Sleep -Milliseconds 400
        $wshell.SendKeys("{ENTER}")
        return $true
    }
    return $false
}

# Tentativa 1 (aos 6 segundos)
Start-Sleep -Seconds 6
$ok1 = Try-ActivateAndRunColab

# Tentativa 2 (aos 10 segundos)
Start-Sleep -Seconds 4
$ok2 = Try-ActivateAndRunColab

# Tentativa 3 (aos 14 segundos)
Start-Sleep -Seconds 4
$ok3 = Try-ActivateAndRunColab

if ($ok1 -or $ok2 -or $ok3) {
    Write-Host "Comando de execucao enviado com sucesso ao Colab!" -ForegroundColor Green
} else {
    Write-Host "Aviso: Pressione Ctrl+F9 no Colab se a aba nao recebeu o foco." -ForegroundColor Yellow
}

# 4. Devolve o foco imediato para a janela do Master of Masters Studio Pro
Start-Sleep -Milliseconds 800
try {
    $studioActivated = $wshell.AppActivate("Master of Masters")
    if (-not $studioActivated) { $wshell.AppActivate("MASTER OF MASTERS") }
    if (-not $studioActivated) { $wshell.AppActivate("http://127.0.0.1:7777") }
} catch {}

Write-Host ""
Write-Host "Tudo pronto! O Colab e o Studio foram iniciados juntos." -ForegroundColor Cyan
Write-Host "O Colab conectara ao Estudio automaticamente via nuvem sem copiar URLs." -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan

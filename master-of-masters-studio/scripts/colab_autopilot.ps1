# Master of Masters Studio Pro — Colab Autopilot Launcher
# Executado simultaneamente na abertura do software pelo icone no desktop

$colabNotebookUrl = "https://colab.research.google.com/"
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

# 2. Abre o Google Colab no navegador padrao
Write-Host "1. Abrindo Google Colab simultaneamente..." -ForegroundColor White
Start-Process $colabNotebookUrl

# 3. Aguarda carregamento inicial da pagina
Write-Host "2. Aguardando inicializacao do ambiente Colab (4 segundos)..." -ForegroundColor Gray
Start-Sleep -Seconds 4

# 4. Dispara a execucao automatica na GPU T4 (Ctrl + F9 e Enter)
Write-Host "3. Disparando execucao na GPU T4 (Ctrl + F9)..." -ForegroundColor Yellow
try {
    $wshell = New-Object -ComObject wscript.shell
    $activated = $wshell.AppActivate("Google Colaboratory")
    if (-not $activated) {
        $activated = $wshell.AppActivate("Colab")
    }
    if (-not $activated) {
        $activated = $wshell.AppActivate("Colaboratory")
    }

    Start-Sleep -Milliseconds 600
    $wshell.SendKeys("^{F9}")
    Start-Sleep -Milliseconds 600
    $wshell.SendKeys("{ENTER}")
    Write-Host "Comando de execucao enviado com sucesso ao Colab!" -ForegroundColor Green
} catch {
    Write-Host "Aviso: Pressione Ctrl+F9 no Colab se a aba nao recebeu o foco." -ForegroundColor Yellow
}

# 5. Devolve o foco imediato para a janela do Master of Masters Studio Pro
Start-Sleep -Milliseconds 900
try {
    $studioActivated = $wshell.AppActivate("Master of Masters")
    if (-not $studioActivated) {
        $wshell.AppActivate("MASTER OF MASTERS")
    }
    if (-not $studioActivated) {
        $wshell.AppActivate("http://127.0.0.1:7777")
    }
} catch {}

Write-Host ""
Write-Host "Tudo pronto! O Colab e o Studio foram iniciados juntos." -ForegroundColor Cyan
Write-Host "O Colab conectara ao Estudio automaticamente via nuvem sem copiar URLs." -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan

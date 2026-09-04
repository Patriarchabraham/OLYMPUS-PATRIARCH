# Master of Masters Studio Pro — Colab Autopilot Launcher
$colabNotebookUrl = "https://colab.research.google.com/"
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  MASTER OF MASTERS STUDIO PRO - COLAB AUTOPILOT" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "1. Abrindo Google Colab no navegador padrao..." -ForegroundColor White
Start-Process $colabNotebookUrl

Write-Host "2. Aguardando inicializacao da pagina (5 segundos)..." -ForegroundColor Gray
Start-Sleep -Seconds 5

Write-Host "3. Enviando comando automatico de execucao (Ctrl + F9)..." -ForegroundColor Yellow
try {
    $wshell = New-Object -ComObject wscript.shell
    $activated = $wshell.AppActivate("Google Colaboratory")
    if (-not $activated) {
        $activated = $wshell.AppActivate("Colab")
    }
    Start-Sleep -Milliseconds 600
    $wshell.SendKeys("^{F9}")
    Start-Sleep -Milliseconds 500
    $wshell.SendKeys("{ENTER}")
    Write-Host "Atalho de execucao enviado com sucesso!" -ForegroundColor Green
} catch {
    Write-Host "Pressione Ctrl+F9 na janela do Colab para executar tudo de uma vez." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "O Colab agora transmitira o link automaticamente ao seu Estudio!" -ForegroundColor Cyan
Write-Host "Nao e necessario copiar nem colar nenhum link. Pode voltar ao Master of Masters Studio!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan

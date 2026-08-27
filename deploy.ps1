# blog.ps1 - Valaxy 博客一键部署

$msg = Read-Host "输入 commit 信息"
if ([string]::IsNullOrWhiteSpace($msg)) {
    $msg = "update: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
}

git add .
git commit -m "$msg"
git push origin main

Write-Host "推送完成，正在自动部署..." -ForegroundColor Green
Write-Host "查看进度: https://github.com/Ha2eS1onn/Ha2eS1onn.github.io/actions" -ForegroundColor Cyan
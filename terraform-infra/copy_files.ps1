$downloads = "$env:USERPROFILE\Downloads"
$backend   = "D:\AWS_Terraform_automation\terraform-infra\backend"
$frontend  = "D:\AWS_Terraform_automation\terraform-infra\frontend"

$files = @(
    @{ src="$downloads\vpc_router.py";         dst="$backend\routers\vpc.py" },
    @{ src="$downloads\iam_router.py";         dst="$backend\routers\iam.py" },
    @{ src="$downloads\requests_final.py";     dst="$backend\routers\requests.py" },
    @{ src="$downloads\terraform_service.py";  dst="$backend\services\terraform_service.py" },
    @{ src="$downloads\EKS.jsx";               dst="$frontend\src\pages\EKS.jsx" },
    @{ src="$downloads\Approvals.jsx";         dst="$frontend\src\pages\Approvals.jsx" },
    @{ src="$downloads\Resources_v3.jsx";      dst="$frontend\src\pages\Resources.jsx" },
    @{ src="$downloads\CreateVMModal.jsx";     dst="$frontend\src\components\CreateVMModal.jsx" },
    @{ src="$downloads\VPCModal.jsx";          dst="$frontend\src\components\VPCModal.jsx" },
    @{ src="$downloads\SGModal.jsx";           dst="$frontend\src\components\SGModal.jsx" },
    @{ src="$downloads\TagsStep.jsx";          dst="$frontend\src\components\TagsStep.jsx" },
    @{ src="$downloads\NotificationBell.jsx";  dst="$frontend\src\components\NotificationBell.jsx" },
    @{ src="$downloads\EC2ConnectionInfo.jsx"; dst="$frontend\src\components\EC2ConnectionInfo.jsx" },
)

$copied=0; $skipped=0
Write-Host "`nAIonOS Platform - File Copy" -ForegroundColor Cyan
Write-Host "===========================" -ForegroundColor Cyan

foreach ($f in $files) {
    if (Test-Path $f.src) {
        Copy-Item $f.src $f.dst -Force
        Write-Host "  COPIED  $($f.src | Split-Path -Leaf)" -ForegroundColor Green
        $copied++
    } else {
        Write-Host "  SKIP    $($f.src | Split-Path -Leaf)" -ForegroundColor Yellow
        $skipped++
    }
}

Write-Host "`nDone: $copied copied, $skipped skipped" -ForegroundColor Cyan
Write-Host "`nStart backend:"   -ForegroundColor White
Write-Host "  cd D:\AWS_Terraform_automation\terraform-infra\backend" -ForegroundColor Gray
Write-Host "  venv\Scripts\Activate.ps1" -ForegroundColor Gray
Write-Host "  uvicorn main:app --port 8000" -ForegroundColor Gray
Write-Host "`nStart frontend:" -ForegroundColor White
Write-Host "  cd D:\AWS_Terraform_automation\terraform-infra\frontend" -ForegroundColor Gray
Write-Host "  npm run dev" -ForegroundColor Gray

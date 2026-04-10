$src  = "C:\Users\Akram.Khan\Documents\platform"
$dest = "D:\AWS_Terraform_automation\terraform-infra"

Write-Host "Moving backend..." -ForegroundColor Cyan
Copy-Item "$src\backend" "$dest\backend" -Recurse -Force

Write-Host "Moving frontend..." -ForegroundColor Cyan  
Copy-Item "$src\frontend" "$dest\frontend" -Recurse -Force

Write-Host "Copying scripts..." -ForegroundColor Cyan
Copy-Item "$src\copy_files.ps1" "$dest\copy_files.ps1" -Force
Copy-Item "$src\ec2.ps1"        "$dest\ec2.ps1"        -Force

Write-Host ""
Write-Host "Done! New structure:" -ForegroundColor Green
Write-Host "  D:\AWS_Terraform_automation\terraform-infra\backend\"
Write-Host "  D:\AWS_Terraform_automation\terraform-infra\frontend\"

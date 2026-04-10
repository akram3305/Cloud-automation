# AIonOS EC2 Quick Control
# Usage: .\ec2.ps1 list
#        .\ec2.ps1 start i-0abc123
#        .\ec2.ps1 stop i-0abc123
#        .\ec2.ps1 status i-0abc123

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("list","start","stop","restart","status","start-all","stop-all")]
    [string]$Action,
    [string]$InstanceId = "",
    [string]$Region = "ap-south-1"
)

$backendPath = "C:\Users\Akram.Khan\Documents\platform\backend"
Set-Location $backendPath

if ($InstanceId) {
    & "$backendPath\venv\Scripts\python.exe" "$backendPath\ec2_control.py" $Action $InstanceId --region $Region
} else {
    & "$backendPath\venv\Scripts\python.exe" "$backendPath\ec2_control.py" $Action --region $Region
}

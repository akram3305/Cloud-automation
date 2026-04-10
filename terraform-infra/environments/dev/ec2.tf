
# EC2: Test-ec2-ak (req_26)
module "ec2_test_ec2_ak" {
  source      = "../../modules/compute/ec2"
  environment = "dev"
  instances = {
    "Test-ec2-ak" = {
      ami                               = "ami-0f58b397bc5c1f2e8"
      instance_type                     = "t3.medium"
      subnet_id                         = ""
      vpc_security_group_ids            = ["sg-08ec59ba0a2481703"]
      key_name                          = ""
      associate_public_ip_address       = true
      monitoring                        = false
      disable_api_termination           = false
      root_volume_type                  = "gp3"
      root_volume_size                  = 20
      root_volume_delete_on_termination = true
      root_volume_encrypted             = false
      metadata_http_endpoint            = "enabled"
      metadata_http_tokens              = "optional"
      metadata_http_hop_limit           = 1
      metadata_instance_tags            = "enabled"
      tags = {
        Name        = "Test-ec2-ak"
        Project     = "AIonOS-Platform"
        Owner       = "admin"
        Environment = "dev"
        CreatedBy   = "AIonOS-Platform"
        ManagedBy   = "admin"
        RequestID   = "26"
      }
    }
  }
}
output "ec2_test_ec2_ak_instance_id" { value = try(values(module.ec2_test_ec2_ak.instance_ids)[0],"") }
output "ec2_test_ec2_ak_public_ip"   { value = try(values(module.ec2_test_ec2_ak.public_ips)[0],"") }
output "ec2_test_ec2_ak_private_ip"  { value = try(values(module.ec2_test_ec2_ak.private_ips)[0],"") }

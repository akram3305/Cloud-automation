terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "ap-south-1"
}

module "ec2" {
  source = "D:/AWS_Terraform_automation/terraform-infra/modules/compute/ec2"

  environment = "dev"

  instances = {
    "terra-testing" = {
      ami                    = "ami-0f58b397bc5c1f2e8"
      instance_type          = "t3.medium"
      subnet_id              = "subnet-087913ecfda58afae"
      vpc_security_group_ids = []
      key_name               = "Test-Key-Pair"

      associate_public_ip_address = true
      monitoring                  = false
      disable_api_termination     = false

      root_volume_type                  = "gp3"
      root_volume_size                  = 20
      root_volume_delete_on_termination = true
      root_volume_encrypted             = false

      metadata_http_endpoint  = "enabled"
      metadata_http_tokens    = "optional"
      metadata_http_hop_limit = 1
      metadata_instance_tags  = "enabled"

      tags = {
        Project     = ""
        Owner       = ""
        Environment = "dev"
        CreatedBy   = "AIonOS-Platform"
        ManagedBy   = "admin"
        RequestID   = "26"
      }
    }
  }
}

output "instance_id" {
  value = try(values(module.ec2.instance_ids)[0], "")
}

output "public_ip" {
  value = try(values(module.ec2.public_ips)[0], "")
}

output "private_ip" {
  value = try(values(module.ec2.private_ips)[0], "")
}

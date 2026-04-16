# VPC (Network) Terraform Module

## 📌 Overview

This module provisions a **production-ready AWS VPC** using the official
`terraform-aws-modules/vpc/aws` module.

It supports:

* VPC creation with CIDR
* Public & Private Subnets
* Multi-AZ deployment
* Internet Gateway
* Optional NAT Gateway
* Optional VPC Flow Logs
* DNS support
* Tagging standards

---

## 📂 Module Structure

```hcl
modules/
  network/
    main.tf
    variables.tf
    outputs.tf
    README.md
```

---

## 🚀 Usage

### 1️⃣ Call the Module from Environment

```hcl
module "network" {
  source = "../../modules/network"

  vpc_name           = var.vpc_name
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones

  public_subnets  = var.public_subnets
  private_subnets = var.private_subnets

  enable_nat_gateway     = var.enable_nat_gateway
  single_nat_gateway     = var.single_nat_gateway
  one_nat_gateway_per_az = var.one_nat_gateway_per_az

  enable_flow_logs          = var.enable_flow_logs
  flow_log_destination_type = var.flow_log_destination_type

  tags        = var.tags
  environment = var.environment
}
```

---

### 2️⃣ Define Variables

Example in `variables.tf` (environment level):

```hcl
variable "vpc_name" { type = string }
variable "vpc_cidr" { type = string }
variable "availability_zones" { type = list(string) }

variable "public_subnets" { type = list(string) }
variable "private_subnets" { type = list(string) }

variable "enable_nat_gateway" { type = bool }
variable "single_nat_gateway" { type = bool }
variable "one_nat_gateway_per_az" { type = bool }

variable "enable_flow_logs" { type = bool }
variable "flow_log_destination_type" { type = string }

variable "tags" { type = map(string) }
variable "environment" { type = string }
```

---

### 3️⃣ Provide Values in terraform.tfvars

```hcl
vpc_name           = "dev-vpc"
vpc_cidr           = "10.0.0.0/16"
availability_zones = ["ap-south-1a", "ap-south-1b"]

public_subnets  = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnets = ["10.0.11.0/24", "10.0.12.0/24"]

enable_nat_gateway     = false
single_nat_gateway     = true
one_nat_gateway_per_az = false

enable_flow_logs          = false
flow_log_destination_type = "cloud-watch-logs"

tags = {
  Project = "MyApp"
}

environment = "dev"
```

---

## 📤 Outputs

| Output Name               | Description                     |
| ------------------------- | ------------------------------- |
| vpc_id                    | VPC ID                          |
| public_subnet_ids         | List of public subnet IDs       |
| private_subnet_ids        | List of private subnet IDs      |
| internet_gateway_id       | IGW ID                          |
| default_security_group_id | Default SG ID                   |
| nat_eip_ids               | NAT Elastic IP IDs (if enabled) |

---

## 🧪 Example Usage (with EC2)

```hcl
resource "aws_instance" "example" {
  ami           = "ami-xxxxxxxx"
  instance_type = "t2.micro"

  subnet_id = module.network.public_subnet_ids[0]

  tags = {
    Name = "example-instance"
  }
}
```

---

## ⚙️ Features

✅ Multi-AZ architecture
✅ Public & Private subnet isolation
✅ Optional NAT Gateway
✅ Optional Flow Logs
✅ DNS support enabled
✅ Reusable module design

---

## ⚠️ Important Notes

* If IAM permissions are limited:

  * Set `enable_nat_gateway = false`
  * Set `enable_flow_logs = false`

* Flow log destination must be:

```hcl
cloud-watch-logs
s3
kinesis-data-firehose
```

---

## 🧹 Destroy Resources

```bash
terraform destroy
```

---

## 🧠 Best Practices

* Use different CIDR blocks for each environment
* Use private subnets for backend services
* Enable NAT only when needed (cost optimization)
* Restrict access using Security Groups
* Use tagging for cost tracking

---

## 📌 Architecture

```
VPC
├── Public Subnets (ALB / Bastion / EC2)
├── Private Subnets (App / DB)
├── Internet Gateway
└── (Optional) NAT Gateway
```

---

## 👨‍💻 Author

Reusable Terraform module for AWS VPC (Network Layer)

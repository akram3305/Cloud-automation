# Security Group Terraform Module

## 📌 Overview

This module creates **AWS Security Groups** with dynamic **ingress and egress rules** using Terraform.
It supports:

* Multiple security groups using `for_each`
* Dynamic ingress/egress rules
* Custom additional rules
* Environment-based tagging

---

## 📂 Module Structure

```
modules/
  security_group/
    main.tf
    variables.tf
    outputs.tf
```

---

## 🚀 Usage

### 1️⃣ Call the Module in Environment

```hcl
module "security_groups" {
  source = "../../modules/security_group"

  environment     = var.environment
  security_groups = var.security_groups
  custom_rules    = var.custom_rules
}
```

---

### 2️⃣ Define Variables

Add variables in your `variables.tf`:

```hcl
variable "security_groups" {
  description = "Map of security groups"
  type        = any
}

variable "custom_rules" {
  description = "Additional SG rules"
  type        = any
  default     = {}
}
```

---

### 3️⃣ Provide Values in terraform.tfvars

```hcl
security_groups = {
  web_sg = {
    name        = "web-sg"
    description = "Web security group"
    vpc_id      = "vpc-xxxxxxxx"

    ingress_rules = [
      {
        description = "Allow HTTP"
        from_port   = 80
        to_port     = 80
        protocol    = "tcp"
        cidr_blocks = ["0.0.0.0/0"]
      },
      {
        description = "Allow SSH"
        from_port   = 22
        to_port     = 22
        protocol    = "tcp"
        cidr_blocks = ["YOUR_IP/32"]
      }
    ]

    egress_rules = [
      {
        description = "Allow all"
        from_port   = 0
        to_port     = 0
        protocol    = "-1"
        cidr_blocks = ["0.0.0.0/0"]
      }
    ]

    tags = {
      Project = "MyApp"
    }
  }
}

custom_rules = {}
```

---

### 4️⃣ Use Security Group in EC2

```hcl
resource "aws_instance" "example" {
  ami                    = "ami-xxxxxxxx"
  instance_type          = "t2.micro"
  subnet_id              = "subnet-xxxxxxxx"

  vpc_security_group_ids = [
    module.security_groups.security_group_ids["web_sg"]
  ]
}
```

---

## 📤 Outputs

| Output Name          | Description                 |
| -------------------- | --------------------------- |
| security_group_ids   | Map of security group IDs   |
| security_group_names | Map of security group names |

Example:

```hcl
module.security_groups.security_group_ids["web_sg"]
```

---

## ⚙️ Features

✅ Dynamic ingress/egress rules
✅ Multiple security groups using map
✅ Custom rule support
✅ Environment-based tagging
✅ Reusable across environments

---

## ⚠️ Best Practices

* Restrict SSH (`22`) to your IP only
* Avoid using `0.0.0.0/0` unless required
* Use separate SGs for web, app, and DB layers
* Use module outputs instead of hardcoding IDs

---

## 🧪 Commands

```bash
terraform init
terraform validate
terraform plan
terraform apply
```

---

## 🧹 Destroy Resources

```bash
terraform destroy
```

---

## 📌 Example Architecture

* VPC Module → Creates VPC & Subnets
* Security Group Module → Creates SGs
* EC2 Module → Uses SG + Subnets

---

## 👨‍💻 Author

Terraform reusable module for AWS Security Groups.

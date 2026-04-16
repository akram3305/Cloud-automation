# 🚀 EC2 Terraform Module

This module is used to create and manage **EC2 instances** in a reusable and scalable way using Terraform.

It supports:

* Multiple EC2 instances (using `for_each`)
* Dynamic user data scripts (templates)
* EBS volumes (root + additional)
* Elastic IP allocation
* CloudWatch CPU alarms
* Metadata and security configuration

---

# 📁 Module Structure

```
modules/compute/ec2/
├── main.tf
├── variables.tf
├── outputs.tf
├── user_data/
│   └── templates/
│       ├── web_server.sh.tpl
│       ├── app_server.sh.tpl
│       └── bastion_host.sh.tpl
└── README.md
```

---

# 🧠 How This Module Works

This module uses a **map of instances** as input:

* Each key = EC2 name
* Each value = configuration

Example:

```
instances = {
  web1 = { ... }
  app1 = { ... }
}
```

Terraform will create multiple EC2 instances dynamically.

---

# ⚙️ Inputs

## Required Variables

| Name          | Description                        |
| ------------- | ---------------------------------- |
| `environment` | Environment name (dev/prod)        |
| `instances`   | Map of EC2 instance configurations |

---

## Example Input (terraform.tfvars)

```
instances = {
  web1 = {
    ami           = "ami-0a91cd140a1fc148a"
    instance_type = "t2.micro"
    key_name      = "my-keypair"

    subnet_id              = "subnet-xxxx"
    vpc_security_group_ids = ["sg-xxxx"]

    user_data = "web_server.sh.tpl"

    root_volume_type  = "gp3"
    root_volume_size  = 10
    root_volume_delete_on_termination = true
    root_volume_encrypted = false

    ebs_volumes = []

    associate_public_ip_address = true
    allocate_eip               = false

    monitoring              = false
    disable_api_termination = false

    metadata_http_endpoint  = "enabled"
    metadata_http_tokens    = "required"
    metadata_http_hop_limit = 1
    metadata_instance_tags  = "enabled"

    enable_cpu_alarm = false

    tags = {
      Project = "MyApp"
    }
  }
}
```

---

# 📜 User Data Templates

These scripts run automatically when EC2 starts.

## 🔹 web_server.sh.tpl

* Installs Nginx
* Creates a simple web page

## 🔹 app_server.sh.tpl

* Installs Docker
* Prepares backend server

## 🔹 bastion_host.sh.tpl

* Installs tools (htop, git)
* Used as jump server

---

# 🧩 How Templates Work

Inside `main.tf`:

```
user_data = templatefile("template_path", {
  environment = var.environment
  hostname    = instance_name
})
```

You only need to pass:

```
user_data = "web_server.sh.tpl"
```

Terraform will:

* Load the file
* Replace variables (`${environment}`, `${hostname}`)
* Execute it on EC2 startup

---

# 🔗 How to Use This Module

In your environment (`environments/dev/main.tf`):

```
module "ec2" {
  source = "../../modules/compute/ec2"

  environment = var.environment
  instances   = var.instances
}
```

---

# 📤 Outputs

| Output           | Description          |
| ---------------- | -------------------- |
| `instance_ids`   | EC2 instance IDs     |
| `public_ips`     | Public IP addresses  |
| `private_ips`    | Private IP addresses |
| `eip_public_ips` | Elastic IPs          |

---

# ▶️ Run Terraform

```
terraform init
terraform validate
terraform plan
terraform apply
```

---

# ⚠️ Important Notes

* Do NOT hardcode subnet or security group in module
* Pass dynamic values from environment
* Ensure IAM permissions for:

  * EC2
  * EIP
  * CloudWatch (if using alarms)

---

# 🎯 Best Practices

✅ Use separate modules for:

* VPC
* Security Groups
* EC2

✅ Keep environment-specific values in `terraform.tfvars`

✅ Use templates for automation

---

# 🚀 Future Enhancements

* Add Auto Scaling Group
* Attach Load Balancer (ALB)
* Add CI/CD pipeline
* Add monitoring (CloudWatch + SNS)

---

# 💡 Summary

This module helps you:

✔ Create EC2 instances dynamically
✔ Automate setup using scripts
✔ Follow real-world DevOps practices
✔ Build scalable infrastructure

---

**Author:** Your Terraform Project 🚀

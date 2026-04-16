# 🔐 Terraform Key Pair Module

This module is used to **create or use an AWS EC2 Key Pair** for secure SSH access to instances.

It supports:

* ✅ Creating a new key pair
* ✅ Using an existing key pair
* ✅ Saving private/public keys locally
* ✅ Dynamic key naming
* ✅ Secure tagging

---

# 📁 Module Structure

```bash
modules/keypair/
├── main.tf
├── variables.tf
├── outputs.tf
└── README.md
```

---

# 🚀 Features

| Feature          | Description                           |
| ---------------- | ------------------------------------- |
| Create Key Pair  | Generates SSH key using TLS           |
| Use Existing Key | References already created key in AWS |
| Local Storage    | Saves `.pem` and `.pub` locally       |
| Dynamic Naming   | Auto-generates unique key name        |
| Secure           | Private key permissions handled       |

---

# ⚙️ Usage

## 🔹 Basic Example (Create New Key)

```hcl
module "key_pair" {
  source = "../../modules/keypair"

  generate_new_key = true
  key_name         = "dev-key"

  save_locally   = true
  local_key_path = "./keys"

  environment = "dev"

  tags = {
    Project = "MyApp"
  }
}
```

---

## 🔹 Use Existing Key

```hcl
module "key_pair" {
  source = "../../modules/keypair"

  generate_new_key = false
  key_name         = "existing-key"

  environment = "dev"
}
```

---

# 🔗 Outputs

| Output             | Description               |
| ------------------ | ------------------------- |
| `key_name`         | Name of the key pair      |
| `private_key_path` | Local path of `.pem` file |
| `public_key`       | Public key content        |

---

# 🔐 Connecting to EC2

After Terraform apply:

```bash
ssh -i ./keys/dev-key.pem ubuntu@<public-ip>
```

---

# 🖥️ Windows Users

Run in PowerShell:

```powershell
ssh -i .\keys\dev-key.pem ubuntu@<public-ip>
```

---

# ⚠️ Important Notes

## ❗ Do NOT commit private key

Add to `.gitignore`:

```bash
keys/
*.pem
```

---

## ❗ File Permissions (Windows)

Run:

```powershell
icacls .\keys\dev-key.pem /inheritance:r
icacls .\keys\dev-key.pem /grant:r "$($env:USERNAME):(R)"
```

---

# 🧠 How It Works

```text
1. Generate private key (TLS)
2. Create AWS key pair (public key)
3. Save key locally (optional)
4. Output key_name for EC2 usage
```

---

# 🔄 Integration with EC2 Module

Example:

```hcl
module "ec2" {
  source = "../../modules/compute/ec2"

  instances = {
    web1 = {
      ...
      key_name = module.key_pair.key_name
    }
  }
}
```

---

# 🎯 Best Practices

* ✅ Use `generate_new_key = true` for automation
* ✅ Store keys outside Git repository
* ✅ Use different keys per environment
* ❌ Never hardcode private keys
* ❌ Never share `.pem` files

---

# 🚀 Summary

This module enables:

✔ Secure SSH access
✔ Automated key management
✔ Reusable infrastructure
✔ Clean DevOps workflow

---

# 📌 Environment Usage

In `environments/dev/main.tf`:

```hcl
module "key_pair" {
  source = "../../modules/keypair"

  generate_new_key = true
  key_name         = "dev-key"

  save_locally   = true
  local_key_path = "./keys"

  environment = var.environment
  tags        = var.tags
}
```

**Module:** Key Pair
**Purpose:** Secure EC2 access
**Environment:** Dev / Prod ready

🔐 Secure • Modular • Production Ready

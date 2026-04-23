# ============================================================
# Azure VM Static Template — AIonOS Platform
# Values injected via terraform.tfvars — do not hardcode here
# State stored in AWS S3 (same backend as AWS resources)
# ============================================================

terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">= 3.90.0"
    }
  }

  backend "s3" {}
}

provider "azurerm" {
  subscription_id = var.subscription_id
  client_id       = var.client_id
  client_secret   = var.client_secret
  tenant_id       = var.tenant_id
  features {}
}

# ── Subscription / Auth ──────────────────────────────────────
variable "subscription_id" { type = string }
variable "client_id"       { type = string }
variable "client_secret"   { type = string; sensitive = true }
variable "tenant_id"       { type = string }
variable "subscription"    { type = string; default = "nonprod" }

# ── Resource Group ───────────────────────────────────────────
variable "resource_group_name" { type = string }
variable "create_resource_group" { type = bool; default = true }
variable "location"            { type = string; default = "eastus" }

# ── VM Core ──────────────────────────────────────────────────
variable "resource_name"  { type = string }
variable "environment"    { type = string }
variable "vm_size"        { type = string; default = "Standard_B2s" }
variable "os_type"        { type = string; default = "Linux" }

# ── OS Image ─────────────────────────────────────────────────
variable "image_publisher" { type = string; default = "Canonical" }
variable "image_offer"     { type = string; default = "0001-com-ubuntu-server-jammy" }
variable "image_sku"       { type = string; default = "22_04-lts-gen2" }
variable "image_version"   { type = string; default = "latest" }

# ── Auth ─────────────────────────────────────────────────────
variable "admin_username"  { type = string; default = "azureuser" }
variable "admin_password"  { type = string; default = ""; sensitive = true }
variable "ssh_public_key"  { type = string; default = "" }
variable "disable_password_authentication" { type = bool; default = true }

# ── Networking ───────────────────────────────────────────────
variable "subnet_id"           { type = string }
variable "enable_public_ip"    { type = bool;   default = false }
variable "private_ip_allocation" { type = string; default = "Dynamic" }
variable "allowed_ports"       { type = list(number); default = [22, 80, 443] }

# ── OS Disk ──────────────────────────────────────────────────
variable "os_disk_type"    { type = string; default = "Premium_LRS" }
variable "os_disk_size_gb" { type = number; default = 128 }
variable "os_disk_caching" { type = string; default = "ReadWrite" }

# ── Tags (mandatory) ─────────────────────────────────────────
variable "tags" { type = map(string); default = {} }

variable "tag_application_name"     { type = string }
variable "tag_application_owner"    { type = string }
variable "tag_business_criticality" { type = string }
variable "tag_email_id"             { type = string }
variable "tag_start_date"           { type = string }

# ── Resources ────────────────────────────────────────────────

resource "azurerm_resource_group" "this" {
  count    = var.create_resource_group ? 1 : 0
  name     = var.resource_group_name
  location = var.location
  tags     = local.mandatory_tags
}

locals {
  rg_name = var.create_resource_group ? azurerm_resource_group.this[0].name : var.resource_group_name

  mandatory_tags = merge(var.tags, {
    "Application Name"     = var.tag_application_name
    "Application Owner"    = var.tag_application_owner
    "Business Criticality" = var.tag_business_criticality
    "Email ID"             = var.tag_email_id
    "Environment"          = var.environment
    "start-date"           = var.tag_start_date
    "ManagedBy"            = "terraform"
    "Subscription"         = var.subscription
  })
}

resource "azurerm_public_ip" "this" {
  count               = var.enable_public_ip ? 1 : 0
  name                = "${var.resource_name}-pip"
  resource_group_name = local.rg_name
  location            = var.location
  allocation_method   = "Static"
  sku                 = "Standard"
  tags                = local.mandatory_tags
}

resource "azurerm_network_security_group" "this" {
  name                = "${var.resource_name}-nsg"
  resource_group_name = local.rg_name
  location            = var.location

  dynamic "security_rule" {
    for_each = { for idx, port in var.allowed_ports : tostring(port) => port }
    content {
      name                       = "allow-${security_rule.value}"
      priority                   = 100 + index(var.allowed_ports, security_rule.value)
      direction                  = "Inbound"
      access                     = "Allow"
      protocol                   = "Tcp"
      source_port_range          = "*"
      destination_port_range     = tostring(security_rule.value)
      source_address_prefix      = "*"
      destination_address_prefix = "*"
    }
  }

  tags = local.mandatory_tags
}

resource "azurerm_network_interface" "this" {
  name                = "${var.resource_name}-nic"
  resource_group_name = local.rg_name
  location            = var.location

  ip_configuration {
    name                          = "internal"
    subnet_id                     = var.subnet_id
    private_ip_address_allocation = var.private_ip_allocation
    public_ip_address_id          = var.enable_public_ip ? azurerm_public_ip.this[0].id : null
  }

  tags = local.mandatory_tags
}

resource "azurerm_network_interface_security_group_association" "this" {
  network_interface_id      = azurerm_network_interface.this.id
  network_security_group_id = azurerm_network_security_group.this.id
}

resource "azurerm_linux_virtual_machine" "this" {
  count               = var.os_type == "Linux" ? 1 : 0
  name                = var.resource_name
  resource_group_name = local.rg_name
  location            = var.location
  size                = var.vm_size
  admin_username      = var.admin_username

  disable_password_authentication = var.disable_password_authentication
  admin_password                  = var.disable_password_authentication ? null : var.admin_password

  dynamic "admin_ssh_key" {
    for_each = var.ssh_public_key != "" ? [1] : []
    content {
      username   = var.admin_username
      public_key = var.ssh_public_key
    }
  }

  network_interface_ids = [azurerm_network_interface.this.id]

  os_disk {
    caching              = var.os_disk_caching
    storage_account_type = var.os_disk_type
    disk_size_gb         = var.os_disk_size_gb
  }

  source_image_reference {
    publisher = var.image_publisher
    offer     = var.image_offer
    sku       = var.image_sku
    version   = var.image_version
  }

  identity { type = "SystemAssigned" }
  boot_diagnostics {}

  tags = local.mandatory_tags

  lifecycle {
    ignore_changes = [source_image_reference, admin_password, os_disk]
  }
}

resource "azurerm_windows_virtual_machine" "this" {
  count               = var.os_type == "Windows" ? 1 : 0
  name                = var.resource_name
  resource_group_name = local.rg_name
  location            = var.location
  size                = var.vm_size
  admin_username      = var.admin_username
  admin_password      = var.admin_password

  network_interface_ids = [azurerm_network_interface.this.id]

  os_disk {
    caching              = var.os_disk_caching
    storage_account_type = var.os_disk_type
    disk_size_gb         = var.os_disk_size_gb
  }

  source_image_reference {
    publisher = var.image_publisher
    offer     = var.image_offer
    sku       = var.image_sku
    version   = var.image_version
  }

  identity { type = "SystemAssigned" }
  boot_diagnostics {}

  tags = local.mandatory_tags

  lifecycle {
    ignore_changes = [source_image_reference, admin_password, os_disk]
  }
}

# ── Outputs ──────────────────────────────────────────────────

output "vm_id" {
  value = var.os_type == "Linux" ? try(azurerm_linux_virtual_machine.this[0].id, "") : try(azurerm_windows_virtual_machine.this[0].id, "")
}

output "private_ip" {
  value = azurerm_network_interface.this.private_ip_address
}

output "public_ip" {
  value = var.enable_public_ip ? azurerm_public_ip.this[0].ip_address : ""
}

output "resource_group" {
  value = local.rg_name
}

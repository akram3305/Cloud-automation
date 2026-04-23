# ============================================================
# Azure VM Module — AIonOS Platform
# Supports: Linux & Windows VMs, multi-subscription (prod/nonprod/connectivity)
# ============================================================

locals {
  provider_alias = var.subscription  # prod | nonprod | connectivity
}

# ── Public IPs ────────────────────────────────────────────────────────────
resource "azurerm_public_ip" "this" {
  for_each = {
    for k, v in var.vms : k => v if v.enable_public_ip
  }

  name                = "${each.key}-pip"
  resource_group_name = var.resource_group_name
  location            = var.location
  allocation_method   = each.value.public_ip_allocation
  sku                 = each.value.public_ip_sku
  zones               = each.value.availability_zone != null ? [each.value.availability_zone] : []

  tags = merge(each.value.tags, {
    Name        = "${each.key}-pip"
    Environment = var.environment
    ManagedBy   = "terraform"
  })
}

# ── Network Interfaces ────────────────────────────────────────────────────
resource "azurerm_network_interface" "this" {
  for_each = var.vms

  name                = "${each.key}-nic"
  resource_group_name = var.resource_group_name
  location            = var.location

  ip_configuration {
    name                          = "internal"
    subnet_id                     = each.value.subnet_id
    private_ip_address_allocation = each.value.private_ip_allocation
    private_ip_address            = each.value.private_ip_allocation == "Static" ? each.value.private_ip_address : null
    public_ip_address_id          = each.value.enable_public_ip ? azurerm_public_ip.this[each.key].id : null
  }

  tags = merge(each.value.tags, {
    Name        = "${each.key}-nic"
    Environment = var.environment
    ManagedBy   = "terraform"
  })
}

# ── Linux VMs ─────────────────────────────────────────────────────────────
resource "azurerm_linux_virtual_machine" "this" {
  for_each = {
    for k, v in var.vms : k => v if v.os_type == "Linux"
  }

  name                = each.key
  resource_group_name = var.resource_group_name
  location            = var.location
  size                = each.value.vm_size
  admin_username      = each.value.admin_username
  zone                = each.value.availability_zone

  disable_password_authentication = each.value.disable_password_authentication

  admin_password = each.value.disable_password_authentication ? null : each.value.admin_password

  dynamic "admin_ssh_key" {
    for_each = each.value.ssh_public_key != null ? [1] : []
    content {
      username   = each.value.admin_username
      public_key = each.value.ssh_public_key
    }
  }

  network_interface_ids = [azurerm_network_interface.this[each.key].id]

  os_disk {
    caching              = each.value.os_disk_caching
    storage_account_type = each.value.os_disk_storage_account_type
    disk_size_gb         = each.value.os_disk_size_gb
  }

  source_image_reference {
    publisher = each.value.image_publisher
    offer     = each.value.image_offer
    sku       = each.value.image_sku
    version   = each.value.image_version
  }

  dynamic "identity" {
    for_each = each.value.identity_type != null ? [1] : []
    content {
      type = each.value.identity_type
    }
  }

  boot_diagnostics {
    storage_account_uri = each.value.enable_boot_diagnostics ? null : null
  }

  tags = merge(each.value.tags, {
    Name        = each.key
    Environment = var.environment
    ManagedBy   = "terraform"
    OS          = "Linux"
  })

  lifecycle {
    ignore_changes = [
      source_image_reference,
      admin_password,
      os_disk,
    ]
    prevent_destroy       = false
    create_before_destroy = false
  }
}

# ── Windows VMs ───────────────────────────────────────────────────────────
resource "azurerm_windows_virtual_machine" "this" {
  for_each = {
    for k, v in var.vms : k => v if v.os_type == "Windows"
  }

  name                = each.key
  resource_group_name = var.resource_group_name
  location            = var.location
  size                = each.value.vm_size
  admin_username      = each.value.admin_username
  admin_password      = each.value.admin_password
  zone                = each.value.availability_zone

  network_interface_ids = [azurerm_network_interface.this[each.key].id]

  os_disk {
    caching              = each.value.os_disk_caching
    storage_account_type = each.value.os_disk_storage_account_type
    disk_size_gb         = each.value.os_disk_size_gb
  }

  source_image_reference {
    publisher = each.value.image_publisher
    offer     = each.value.image_offer
    sku       = each.value.image_sku
    version   = each.value.image_version
  }

  dynamic "identity" {
    for_each = each.value.identity_type != null ? [1] : []
    content {
      type = each.value.identity_type
    }
  }

  boot_diagnostics {
    storage_account_uri = each.value.enable_boot_diagnostics ? null : null
  }

  tags = merge(each.value.tags, {
    Name        = each.key
    Environment = var.environment
    ManagedBy   = "terraform"
    OS          = "Windows"
  })

  lifecycle {
    ignore_changes = [
      source_image_reference,
      admin_password,
      os_disk,
    ]
    prevent_destroy       = false
    create_before_destroy = false
  }
}

# ── Managed Data Disks ────────────────────────────────────────────────────
locals {
  data_disks = flatten([
    for vm_name, vm in var.vms : [
      for disk in vm.data_disks : {
        vm_name              = vm_name
        disk_name            = disk.name
        disk_size_gb         = disk.disk_size_gb
        storage_account_type = disk.storage_account_type
        caching              = disk.caching
        lun                  = disk.lun
        os_type              = vm.os_type
      }
    ]
  ])
}

resource "azurerm_managed_disk" "this" {
  for_each = {
    for d in local.data_disks : "${d.vm_name}-${d.disk_name}" => d
  }

  name                 = "${each.value.vm_name}-${each.value.disk_name}"
  resource_group_name  = var.resource_group_name
  location             = var.location
  storage_account_type = each.value.storage_account_type
  create_option        = "Empty"
  disk_size_gb         = each.value.disk_size_gb

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "azurerm_virtual_machine_data_disk_attachment" "this" {
  for_each = {
    for d in local.data_disks : "${d.vm_name}-${d.disk_name}" => d
  }

  managed_disk_id    = azurerm_managed_disk.this[each.key].id
  virtual_machine_id = each.value.os_type == "Linux" ? azurerm_linux_virtual_machine.this[each.value.vm_name].id : azurerm_windows_virtual_machine.this[each.value.vm_name].id
  lun                = each.value.lun
  caching            = each.value.caching
}

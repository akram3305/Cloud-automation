variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod)"
}

variable "resource_group_name" {
  type        = string
  description = "Azure Resource Group name"
}

variable "location" {
  type        = string
  description = "Azure region (e.g. eastus, westeurope)"
}

variable "subscription" {
  type        = string
  description = "Subscription alias: prod, nonprod, or connectivity"
  default     = "nonprod"
  validation {
    condition     = contains(["prod", "nonprod", "connectivity"], var.subscription)
    error_message = "subscription must be prod, nonprod, or connectivity"
  }
}

variable "vms" {
  type = map(object({
    vm_size        = string
    admin_username = string
    admin_password = optional(string)

    # OS image
    image_publisher = string
    image_offer     = string
    image_sku       = string
    image_version   = optional(string, "latest")

    # OS type: Linux or Windows
    os_type = optional(string, "Linux")

    # Networking
    subnet_id              = string
    private_ip_allocation  = optional(string, "Dynamic")
    private_ip_address     = optional(string)
    enable_public_ip       = optional(bool, false)
    public_ip_sku          = optional(string, "Standard")
    public_ip_allocation   = optional(string, "Static")

    # OS Disk
    os_disk_caching              = optional(string, "ReadWrite")
    os_disk_storage_account_type = optional(string, "Premium_LRS")
    os_disk_size_gb              = optional(number, 128)

    # Additional data disks
    data_disks = optional(list(object({
      name                 = string
      disk_size_gb         = number
      storage_account_type = optional(string, "Premium_LRS")
      caching              = optional(string, "ReadWrite")
      lun                  = number
    })), [])

    # Availability
    availability_zone = optional(string)
    availability_set  = optional(string)

    # Monitoring
    enable_boot_diagnostics  = optional(bool, true)
    enable_azure_monitor     = optional(bool, false)

    # SSH / WinRM
    ssh_public_key = optional(string)
    disable_password_authentication = optional(bool, true)

    # Identity
    identity_type = optional(string, "SystemAssigned")

    tags = optional(map(string), {})
  }))
  description = "Map of Azure VMs to create"
}

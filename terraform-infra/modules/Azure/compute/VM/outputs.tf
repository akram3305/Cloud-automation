output "linux_vm_ids" {
  description = "Map of Linux VM name => resource ID"
  value       = { for k, v in azurerm_linux_virtual_machine.this : k => v.id }
}

output "windows_vm_ids" {
  description = "Map of Windows VM name => resource ID"
  value       = { for k, v in azurerm_windows_virtual_machine.this : k => v.id }
}

output "linux_vm_private_ips" {
  description = "Map of Linux VM name => private IP"
  value       = { for k, v in azurerm_linux_virtual_machine.this : k => v.private_ip_address }
}

output "windows_vm_private_ips" {
  description = "Map of Windows VM name => private IP"
  value       = { for k, v in azurerm_windows_virtual_machine.this : k => v.private_ip_address }
}

output "public_ips" {
  description = "Map of VM name => public IP address"
  value       = { for k, v in azurerm_public_ip.this : k => v.ip_address }
}

output "nic_ids" {
  description = "Map of VM name => NIC resource ID"
  value       = { for k, v in azurerm_network_interface.this : k => v.id }
}

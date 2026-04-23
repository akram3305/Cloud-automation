output "vnet_id" {
  description = "Resource ID of the Virtual Network"
  value       = azurerm_virtual_network.this.id
}

output "vnet_name" {
  description = "Name of the Virtual Network"
  value       = azurerm_virtual_network.this.name
}

output "vnet_cidr" {
  description = "Address space of the VNet"
  value       = azurerm_virtual_network.this.address_space
}

output "subnet_ids" {
  description = "Map of subnet name => subnet resource ID"
  value       = { for k, v in azurerm_subnet.this : k => v.id }
}

output "subnet_cidrs" {
  description = "Map of subnet name => CIDR"
  value       = { for k, v in azurerm_subnet.this : k => v.address_prefixes[0] }
}

output "default_nsg_id" {
  description = "ID of the default Network Security Group"
  value       = azurerm_network_security_group.default.id
}

output "storage_account_ids" {
  description = "Map of storage account name => resource ID"
  value       = { for k, v in azurerm_storage_account.this : k => v.id }
}

output "primary_blob_endpoints" {
  description = "Map of storage account name => primary blob endpoint URL"
  value       = { for k, v in azurerm_storage_account.this : k => v.primary_blob_endpoint }
}

output "primary_access_keys" {
  description = "Map of storage account name => primary access key (sensitive)"
  sensitive   = true
  value       = { for k, v in azurerm_storage_account.this : k => v.primary_access_key }
}

output "container_ids" {
  description = "Map of container key => resource ID"
  value       = { for k, v in azurerm_storage_container.this : k => v.id }
}

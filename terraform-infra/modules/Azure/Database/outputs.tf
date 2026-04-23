# PostgreSQL outputs
output "postgresql_server_id" {
  description = "Resource ID of the PostgreSQL Flexible Server"
  value       = var.engine == "postgresql" ? azurerm_postgresql_flexible_server.this[0].id : null
}

output "postgresql_server_fqdn" {
  description = "FQDN of the PostgreSQL Flexible Server"
  value       = var.engine == "postgresql" ? azurerm_postgresql_flexible_server.this[0].fqdn : null
}

output "postgresql_database_ids" {
  description = "Map of PostgreSQL database IDs"
  value       = { for k, v in azurerm_postgresql_flexible_server_database.this : k => v.id }
}

# MySQL outputs
output "mysql_server_id" {
  description = "Resource ID of the MySQL Flexible Server"
  value       = var.engine == "mysql" ? azurerm_mysql_flexible_server.this[0].id : null
}

output "mysql_server_fqdn" {
  description = "FQDN of the MySQL Flexible Server"
  value       = var.engine == "mysql" ? azurerm_mysql_flexible_server.this[0].fqdn : null
}

# MSSQL outputs
output "mssql_server_id" {
  description = "Resource ID of the Azure SQL Server"
  value       = var.engine == "mssql" ? azurerm_mssql_server.this[0].id : null
}

output "mssql_server_fqdn" {
  description = "FQDN of the Azure SQL Server"
  value       = var.engine == "mssql" ? azurerm_mssql_server.this[0].fully_qualified_domain_name : null
}

output "mssql_database_ids" {
  description = "Map of Azure SQL database IDs"
  value       = { for k, v in azurerm_mssql_database.this : k => v.id }
}

# Generic
output "engine" {
  description = "Database engine that was deployed"
  value       = var.engine
}

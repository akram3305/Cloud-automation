variable "resource_group_name" {
  description = "Resource group where the database is deployed"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

# --- Engine selection ---
variable "engine" {
  description = "Database engine: postgresql, mysql, or mssql"
  type        = string
  default     = "postgresql"
  validation {
    condition     = contains(["postgresql", "mysql", "mssql"], var.engine)
    error_message = "engine must be postgresql, mysql, or mssql."
  }
}

# --- PostgreSQL Flexible Server ---
variable "postgresql_server_name" {
  description = "Name of the PostgreSQL Flexible Server"
  type        = string
  default     = ""
}

variable "postgresql_sku_name" {
  description = "SKU name for PostgreSQL Flexible Server (e.g. GP_Standard_D2s_v3)"
  type        = string
  default     = "GP_Standard_D2s_v3"
}

variable "postgresql_version" {
  description = "PostgreSQL major version"
  type        = string
  default     = "15"
  validation {
    condition     = contains(["11", "12", "13", "14", "15", "16"], var.postgresql_version)
    error_message = "postgresql_version must be 11-16."
  }
}

variable "postgresql_storage_mb" {
  description = "Storage size in MB for PostgreSQL"
  type        = number
  default     = 32768
}

variable "postgresql_backup_retention_days" {
  description = "Backup retention in days (7-35)"
  type        = number
  default     = 7
}

variable "postgresql_geo_redundant_backup" {
  description = "Enable geo-redundant backup"
  type        = bool
  default     = false
}

variable "postgresql_ha_mode" {
  description = "High availability mode: Disabled, ZoneRedundant, or SameZone"
  type        = string
  default     = "Disabled"
}

variable "postgresql_zone" {
  description = "Availability zone for primary replica"
  type        = string
  default     = "1"
}

variable "postgresql_databases" {
  description = "Map of databases to create on the PostgreSQL server"
  type = map(object({
    charset   = optional(string, "UTF8")
    collation = optional(string, "en_US.utf8")
  }))
  default = {}
}

variable "postgresql_firewall_rules" {
  description = "Map of firewall rules (name => {start_ip, end_ip})"
  type = map(object({
    start_ip = string
    end_ip   = string
  }))
  default = {}
}

# --- MySQL Flexible Server ---
variable "mysql_server_name" {
  description = "Name of the MySQL Flexible Server"
  type        = string
  default     = ""
}

variable "mysql_sku_name" {
  description = "SKU name for MySQL Flexible Server (e.g. GP_Standard_D2ds_v4)"
  type        = string
  default     = "GP_Standard_D2ds_v4"
}

variable "mysql_version" {
  description = "MySQL version: 5.7 or 8.0.21"
  type        = string
  default     = "8.0.21"
}

variable "mysql_storage_gb" {
  description = "Storage size in GB for MySQL (20-16384)"
  type        = number
  default     = 20
}

variable "mysql_backup_retention_days" {
  description = "Backup retention in days"
  type        = number
  default     = 7
}

variable "mysql_geo_redundant_backup" {
  description = "Enable geo-redundant backup"
  type        = bool
  default     = false
}

variable "mysql_ha_mode" {
  description = "High availability mode: Disabled, ZoneRedundant, or SameZone"
  type        = string
  default     = "Disabled"
}

variable "mysql_databases" {
  description = "List of MySQL database names to create"
  type        = list(string)
  default     = []
}

variable "mysql_firewall_rules" {
  description = "Map of firewall rules (name => {start_ip, end_ip})"
  type = map(object({
    start_ip = string
    end_ip   = string
  }))
  default = {}
}

# --- MS SQL ---
variable "mssql_server_name" {
  description = "Name of the Azure SQL Server"
  type        = string
  default     = ""
}

variable "mssql_version" {
  description = "SQL Server version (2.0 or 12.0)"
  type        = string
  default     = "12.0"
}

variable "mssql_administrator_login" {
  description = "SQL Server administrator login name"
  type        = string
  default     = "sqladmin"
}

variable "mssql_databases" {
  description = "Map of SQL databases to create"
  type = map(object({
    sku_name                     = optional(string, "S1")
    max_size_gb                  = optional(number, 4)
    zone_redundant               = optional(bool, false)
    geo_backup_enabled           = optional(bool, true)
    short_term_backup_days       = optional(number, 7)
  }))
  default = {}
}

variable "mssql_firewall_rules" {
  description = "Map of firewall rules (name => {start_ip, end_ip})"
  type = map(object({
    start_ip = string
    end_ip   = string
  }))
  default = {}
}

variable "mssql_aad_admin" {
  description = "AAD admin for the SQL server (optional)"
  type = object({
    login     = string
    object_id = string
    tenant_id = string
  })
  default = null
}

# --- Shared credentials ---
variable "admin_username" {
  description = "Administrator username (used by PostgreSQL, MySQL, MSSQL)"
  type        = string
  default     = "dbadmin"
}

variable "admin_password" {
  description = "Administrator password"
  type        = string
  sensitive   = true
}

# --- Networking ---
variable "delegated_subnet_id" {
  description = "Subnet ID with Microsoft.DBforPostgreSQL/flexibleServers or MySQL delegation"
  type        = string
  default     = null
}

variable "private_dns_zone_id" {
  description = "Private DNS zone ID for flexible server VNet integration"
  type        = string
  default     = null
}

# --- Tags ---
variable "tags" {
  description = "Tags to apply to all database resources"
  type        = map(string)
  default     = {}
}

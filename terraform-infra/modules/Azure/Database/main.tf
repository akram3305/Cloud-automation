locals {
  default_tags = merge(var.tags, {
    ManagedBy = "Terraform"
    Module    = "Azure/Database"
  })
}

# ===========================================================================
# PostgreSQL Flexible Server
# ===========================================================================
resource "azurerm_postgresql_flexible_server" "this" {
  count = var.engine == "postgresql" ? 1 : 0

  name                = var.postgresql_server_name
  resource_group_name = var.resource_group_name
  location            = var.location
  version             = var.postgresql_version
  sku_name            = var.postgresql_sku_name
  storage_mb          = var.postgresql_storage_mb
  administrator_login    = var.admin_username
  administrator_password = var.admin_password

  backup_retention_days        = var.postgresql_backup_retention_days
  geo_redundant_backup_enabled = var.postgresql_geo_redundant_backup

  zone = var.postgresql_zone

  dynamic "high_availability" {
    for_each = var.postgresql_ha_mode != "Disabled" ? [1] : []
    content {
      mode                      = var.postgresql_ha_mode
      standby_availability_zone = "2"
    }
  }

  dynamic "delegated_subnet_id" {
    for_each = var.delegated_subnet_id != null ? [1] : []
    content {}
  }

  private_dns_zone_id = var.private_dns_zone_id
  delegated_subnet_id = var.delegated_subnet_id

  tags = local.default_tags

  lifecycle {
    ignore_changes = [
      administrator_password,
      zone,
    ]
  }
}

resource "azurerm_postgresql_flexible_server_database" "this" {
  for_each = var.engine == "postgresql" ? var.postgresql_databases : {}

  name      = each.key
  server_id = azurerm_postgresql_flexible_server.this[0].id
  charset   = each.value.charset
  collation = each.value.collation
}

resource "azurerm_postgresql_flexible_server_firewall_rule" "this" {
  for_each = var.engine == "postgresql" ? var.postgresql_firewall_rules : {}

  name             = each.key
  server_id        = azurerm_postgresql_flexible_server.this[0].id
  start_ip_address = each.value.start_ip
  end_ip_address   = each.value.end_ip
}

# ===========================================================================
# MySQL Flexible Server
# ===========================================================================
resource "azurerm_mysql_flexible_server" "this" {
  count = var.engine == "mysql" ? 1 : 0

  name                = var.mysql_server_name
  resource_group_name = var.resource_group_name
  location            = var.location
  version             = var.mysql_version
  administrator_login    = var.admin_username
  administrator_password = var.admin_password

  backup_retention_days        = var.mysql_backup_retention_days
  geo_redundant_backup_enabled = var.mysql_geo_redundant_backup

  sku_name = var.mysql_sku_name

  storage {
    size_gb = var.mysql_storage_gb
  }

  delegated_subnet_id = var.delegated_subnet_id
  private_dns_zone_id = var.private_dns_zone_id

  dynamic "high_availability" {
    for_each = var.mysql_ha_mode != "Disabled" ? [1] : []
    content {
      mode = var.mysql_ha_mode
    }
  }

  tags = local.default_tags

  lifecycle {
    ignore_changes = [administrator_password]
  }
}

resource "azurerm_mysql_flexible_database" "this" {
  for_each = var.engine == "mysql" ? toset(var.mysql_databases) : toset([])

  name                = each.key
  resource_group_name = var.resource_group_name
  server_name         = azurerm_mysql_flexible_server.this[0].name
  charset             = "utf8mb4"
  collation           = "utf8mb4_unicode_ci"
}

resource "azurerm_mysql_flexible_server_firewall_rule" "this" {
  for_each = var.engine == "mysql" ? var.mysql_firewall_rules : {}

  name                = each.key
  resource_group_name = var.resource_group_name
  server_name         = azurerm_mysql_flexible_server.this[0].name
  start_ip_address    = each.value.start_ip
  end_ip_address      = each.value.end_ip
}

# ===========================================================================
# Azure SQL (MS SQL)
# ===========================================================================
resource "azurerm_mssql_server" "this" {
  count = var.engine == "mssql" ? 1 : 0

  name                = var.mssql_server_name
  resource_group_name = var.resource_group_name
  location            = var.location
  version             = var.mssql_version

  administrator_login          = var.mssql_administrator_login
  administrator_login_password = var.admin_password

  dynamic "azuread_administrator" {
    for_each = var.mssql_aad_admin != null ? [var.mssql_aad_admin] : []
    content {
      login_username = azuread_administrator.value.login
      object_id      = azuread_administrator.value.object_id
      tenant_id      = azuread_administrator.value.tenant_id
    }
  }

  tags = local.default_tags

  lifecycle {
    ignore_changes = [administrator_login_password]
  }
}

resource "azurerm_mssql_database" "this" {
  for_each = var.engine == "mssql" ? var.mssql_databases : {}

  name      = each.key
  server_id = azurerm_mssql_server.this[0].id
  sku_name  = each.value.sku_name
  max_size_gb    = each.value.max_size_gb
  zone_redundant = each.value.zone_redundant
  geo_backup_enabled = each.value.geo_backup_enabled

  short_term_retention_policy {
    retention_days = each.value.short_term_backup_days
  }

  tags = local.default_tags

  lifecycle {
    prevent_destroy = false
  }
}

resource "azurerm_mssql_firewall_rule" "this" {
  for_each = var.engine == "mssql" ? var.mssql_firewall_rules : {}

  name             = each.key
  server_id        = azurerm_mssql_server.this[0].id
  start_ip_address = each.value.start_ip
  end_ip_address   = each.value.end_ip
}

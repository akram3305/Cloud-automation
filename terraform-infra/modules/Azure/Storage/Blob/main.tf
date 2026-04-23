# ============================================================
# Azure Blob Storage Module — AIonOS Platform
# ============================================================

resource "azurerm_storage_account" "this" {
  for_each = var.storage_accounts

  name                = each.key
  resource_group_name = var.resource_group_name
  location            = var.location

  account_tier             = each.value.account_tier
  account_replication_type = each.value.account_replication_type
  account_kind             = each.value.account_kind
  access_tier              = each.value.access_tier

  enable_https_traffic_only       = each.value.enable_https_traffic_only
  min_tls_version                 = each.value.min_tls_version
  allow_nested_items_to_be_public = each.value.allow_nested_items_to_be_public
  shared_access_key_enabled       = each.value.shared_access_key_enabled

  blob_properties {
    versioning_enabled = each.value.blob_versioning_enabled

    delete_retention_policy {
      days = each.value.blob_soft_delete_retention_days
    }

    container_delete_retention_policy {
      days = each.value.container_soft_delete_retention_days
    }
  }

  network_rules {
    default_action             = each.value.network_default_action
    ip_rules                   = each.value.ip_rules
    virtual_network_subnet_ids = each.value.subnet_ids
  }

  tags = merge(each.value.tags, {
    Name        = each.key
    Environment = var.environment
    ManagedBy   = "terraform"
    Subscription = var.subscription
  })
}

# ── Blob Containers ───────────────────────────────────────────────────────
locals {
  containers = flatten([
    for sa_name, sa in var.storage_accounts : [
      for container_name, container in sa.containers : {
        sa_name        = sa_name
        container_name = container_name
        access_type    = container.access_type
      }
    ]
  ])
}

resource "azurerm_storage_container" "this" {
  for_each = {
    for c in local.containers : "${c.sa_name}-${c.container_name}" => c
  }

  name                  = each.value.container_name
  storage_account_name  = each.value.sa_name
  container_access_type = each.value.access_type

  depends_on = [azurerm_storage_account.this]
}

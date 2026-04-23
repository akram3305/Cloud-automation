locals {
  default_tags = merge(var.tags, {
    ManagedBy = "Terraform"
    Module    = "Azure/kubernetes/AKS"
  })
}

# ---------------------------------------------------------------------------
# AKS Cluster
# ---------------------------------------------------------------------------
resource "azurerm_kubernetes_cluster" "this" {
  name                = var.cluster_name
  location            = var.location
  resource_group_name = var.resource_group_name
  dns_prefix          = var.dns_prefix
  kubernetes_version  = var.kubernetes_version

  sku_tier = "Standard"

  default_node_pool {
    name                = var.default_node_pool_name
    vm_size             = var.default_node_pool_vm_size
    enable_auto_scaling = var.enable_auto_scaling
    min_count           = var.enable_auto_scaling ? var.default_node_pool_min_count : null
    max_count           = var.enable_auto_scaling ? var.default_node_pool_max_count : null
    node_count          = var.enable_auto_scaling ? null : var.default_node_pool_node_count
    os_disk_size_gb     = var.os_disk_size_gb
    os_disk_type        = var.os_disk_type
    zones               = var.node_pool_availability_zones
    vnet_subnet_id      = var.vnet_subnet_id

    upgrade_settings {
      max_surge = "33%"
    }
  }

  identity {
    type = var.identity_type
  }

  network_profile {
    network_plugin = var.network_plugin
    network_policy = var.network_plugin == "azure" ? var.network_policy : null
    service_cidr   = var.service_cidr
    dns_service_ip = var.dns_service_ip
  }

  azure_active_directory_role_based_access_control {
    managed                = true
    azure_rbac_enabled     = var.enable_azure_rbac
    admin_group_object_ids = var.admin_group_object_ids
  }

  dynamic "oms_agent" {
    for_each = var.enable_oms_agent ? [1] : []
    content {
      log_analytics_workspace_id = var.log_analytics_workspace_id
    }
  }

  dynamic "azure_policy" {
    for_each = var.enable_azure_policy ? [1] : []
    content {
      enabled = true
    }
  }

  http_application_routing_enabled = var.enable_http_application_routing

  tags = local.default_tags

  lifecycle {
    ignore_changes = [
      default_node_pool[0].node_count,
      kubernetes_version,
    ]
  }
}

# ---------------------------------------------------------------------------
# Additional node pools
# ---------------------------------------------------------------------------
resource "azurerm_kubernetes_cluster_node_pool" "additional" {
  for_each = var.additional_node_pools

  name                  = each.key
  kubernetes_cluster_id = azurerm_kubernetes_cluster.this.id
  vm_size               = each.value.vm_size
  enable_auto_scaling   = each.value.enable_auto_scaling
  min_count             = each.value.enable_auto_scaling ? each.value.min_count : null
  max_count             = each.value.enable_auto_scaling ? each.value.max_count : null
  node_count            = each.value.enable_auto_scaling ? null : each.value.node_count
  os_disk_size_gb       = each.value.os_disk_size_gb
  zones                 = each.value.availability_zones
  mode                  = each.value.mode
  node_labels           = each.value.node_labels
  node_taints           = each.value.node_taints

  tags = local.default_tags

  lifecycle {
    ignore_changes = [node_count]
  }
}

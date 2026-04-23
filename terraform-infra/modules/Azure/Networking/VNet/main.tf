# ============================================================
# Azure VNet Module — AIonOS Platform
# Supports Hub-and-Spoke peering (Connectivity <-> Prod/NonProd)
# ============================================================

resource "azurerm_virtual_network" "this" {
  name                = var.vnet_name
  resource_group_name = var.resource_group_name
  location            = var.location
  address_space       = [var.vnet_cidr]
  dns_servers         = length(var.dns_servers) > 0 ? var.dns_servers : null

  dynamic "ddos_protection_plan" {
    for_each = var.enable_ddos_protection ? [1] : []
    content {
      id     = var.ddos_protection_plan_id
      enable = true
    }
  }

  tags = merge(var.tags, {
    Name        = var.vnet_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Subscription = var.subscription
  })
}

# ── Subnets ───────────────────────────────────────────────────────────────
resource "azurerm_subnet" "this" {
  for_each = var.subnets

  name                 = each.key
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.this.name
  address_prefixes     = [each.value.cidr]
  service_endpoints    = each.value.service_endpoints

  private_endpoint_network_policies             = each.value.private_endpoint_network_policies
  private_link_service_network_policies_enabled = each.value.private_link_service_network_policies_enabled

  dynamic "delegation" {
    for_each = each.value.delegation_name != null ? [1] : []
    content {
      name = each.value.delegation_name
      service_delegation {
        name = each.value.delegation_service
      }
    }
  }
}

# ── VNet Peerings (Hub-and-Spoke) ─────────────────────────────────────────
resource "azurerm_virtual_network_peering" "this" {
  for_each = var.peerings

  name                         = each.key
  resource_group_name          = var.resource_group_name
  virtual_network_name         = azurerm_virtual_network.this.name
  remote_virtual_network_id    = each.value.remote_vnet_id
  allow_forwarded_traffic      = each.value.allow_forwarded_traffic
  allow_gateway_transit        = each.value.allow_gateway_transit
  use_remote_gateways          = each.value.use_remote_gateways
  allow_virtual_network_access = each.value.allow_virtual_network_access
}

# ── Network Security Group (default per VNet) ─────────────────────────────
resource "azurerm_network_security_group" "default" {
  name                = "${var.vnet_name}-default-nsg"
  resource_group_name = var.resource_group_name
  location            = var.location

  tags = merge(var.tags, {
    Environment = var.environment
    ManagedBy   = "terraform"
  })
}

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">= 3.90.0"
    }
  }
}

# ── Production Subscription ───────────────────────────────────────────────
provider "azurerm" {
  alias           = "prod"
  subscription_id = var.azure_prod_subscription_id
  client_id       = var.azure_prod_client_id
  client_secret   = var.azure_prod_client_secret
  tenant_id       = var.azure_tenant_id
  features {}
}

# ── Non-Production Subscription ───────────────────────────────────────────
provider "azurerm" {
  alias           = "nonprod"
  subscription_id = var.azure_nonprod_subscription_id
  client_id       = var.azure_nonprod_client_id
  client_secret   = var.azure_nonprod_client_secret
  tenant_id       = var.azure_tenant_id
  features {}
}

# ── Connectivity Subscription (Hub Networking) ────────────────────────────
provider "azurerm" {
  alias           = "connectivity"
  subscription_id = var.azure_connectivity_subscription_id
  client_id       = var.azure_connectivity_client_id
  client_secret   = var.azure_connectivity_client_secret
  tenant_id       = var.azure_tenant_id
  features {}
}

# ── Shared ────────────────────────────────────────────────────────────────
variable "azure_tenant_id" {
  type        = string
  description = "Azure Active Directory Tenant ID (shared across all subscriptions)"
}

variable "azure_location" {
  type        = string
  default     = "eastus"
  description = "Default Azure region for resource deployment"
}

# ── Production Subscription ───────────────────────────────────────────────
variable "azure_prod_subscription_id" {
  type        = string
  description = "Production subscription ID"
}

variable "azure_prod_client_id" {
  type        = string
  description = "Production Service Principal Client ID"
}

variable "azure_prod_client_secret" {
  type        = string
  sensitive   = true
  description = "Production Service Principal Client Secret"
}

# ── Non-Production Subscription ───────────────────────────────────────────
variable "azure_nonprod_subscription_id" {
  type        = string
  description = "Non-Production subscription ID"
}

variable "azure_nonprod_client_id" {
  type        = string
  description = "Non-Production Service Principal Client ID"
}

variable "azure_nonprod_client_secret" {
  type        = string
  sensitive   = true
  description = "Non-Production Service Principal Client Secret"
}

# ── Connectivity Subscription ─────────────────────────────────────────────
variable "azure_connectivity_subscription_id" {
  type        = string
  description = "Connectivity (hub networking) subscription ID"
}

variable "azure_connectivity_client_id" {
  type        = string
  description = "Connectivity Service Principal Client ID"
}

variable "azure_connectivity_client_secret" {
  type        = string
  sensitive   = true
  description = "Connectivity Service Principal Client Secret"
}

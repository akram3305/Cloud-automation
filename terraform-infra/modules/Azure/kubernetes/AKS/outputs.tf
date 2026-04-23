output "cluster_id" {
  description = "Resource ID of the AKS cluster"
  value       = azurerm_kubernetes_cluster.this.id
}

output "cluster_name" {
  description = "Name of the AKS cluster"
  value       = azurerm_kubernetes_cluster.this.name
}

output "kube_config_raw" {
  description = "Raw kubeconfig for the AKS cluster"
  value       = azurerm_kubernetes_cluster.this.kube_config_raw
  sensitive   = true
}

output "kube_admin_config" {
  description = "Admin kubeconfig block"
  value       = azurerm_kubernetes_cluster.this.kube_admin_config
  sensitive   = true
}

output "host" {
  description = "Kubernetes API server host"
  value       = azurerm_kubernetes_cluster.this.kube_config[0].host
  sensitive   = true
}

output "cluster_identity" {
  description = "Managed identity assigned to the AKS cluster"
  value       = azurerm_kubernetes_cluster.this.identity
}

output "kubelet_identity" {
  description = "Identity used by kubelet (for ACR pulls etc.)"
  value       = azurerm_kubernetes_cluster.this.kubelet_identity
}

output "node_resource_group" {
  description = "Auto-created resource group that holds AKS node infrastructure"
  value       = azurerm_kubernetes_cluster.this.node_resource_group
}

output "private_fqdn" {
  description = "Private FQDN of the cluster (private cluster only)"
  value       = azurerm_kubernetes_cluster.this.private_fqdn
}

output "additional_node_pool_ids" {
  description = "Map of additional node pool IDs"
  value       = { for k, v in azurerm_kubernetes_cluster_node_pool.additional : k => v.id }
}

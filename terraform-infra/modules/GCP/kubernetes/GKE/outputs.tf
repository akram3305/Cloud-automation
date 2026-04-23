output "cluster_id" {
  description = "GKE cluster resource ID"
  value       = google_container_cluster.this.id
}

output "cluster_name" {
  description = "GKE cluster name"
  value       = google_container_cluster.this.name
}

output "cluster_endpoint" {
  description = "GKE cluster API server endpoint"
  value       = google_container_cluster.this.endpoint
  sensitive   = true
}

output "cluster_ca_certificate" {
  description = "Base64-encoded cluster CA certificate"
  value       = google_container_cluster.this.master_auth[0].cluster_ca_certificate
  sensitive   = true
}

output "node_pool_ids" {
  description = "Map of node pool name to ID"
  value       = { for k, v in google_container_node_pool.this : k => v.id }
}

output "workload_identity_pool" {
  description = "Workload Identity Pool for the cluster (PROJECT_ID.svc.id.goog)"
  value       = var.enable_workload_identity ? "${var.project_id}.svc.id.goog" : null
}

output "location" {
  description = "Location (region or zone) of the cluster"
  value       = google_container_cluster.this.location
}

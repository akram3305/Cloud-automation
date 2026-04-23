output "vpc_id" {
  description = "ID of the VPC network"
  value       = google_compute_network.this.id
}

output "vpc_self_link" {
  description = "Self-link of the VPC network"
  value       = google_compute_network.this.self_link
}

output "vpc_name" {
  description = "Name of the VPC network"
  value       = google_compute_network.this.name
}

output "subnet_ids" {
  description = "Map of subnet name to ID"
  value       = { for k, v in google_compute_subnetwork.this : k => v.id }
}

output "subnet_self_links" {
  description = "Map of subnet name to self_link"
  value       = { for k, v in google_compute_subnetwork.this : k => v.self_link }
}

output "subnet_cidrs" {
  description = "Map of subnet name to CIDR range"
  value       = { for k, v in google_compute_subnetwork.this : k => v.ip_cidr_range }
}

output "cloud_router_self_link" {
  description = "Self-link of the Cloud Router (if created)"
  value       = var.create_cloud_nat ? google_compute_router.this[0].self_link : null
}

output "nat_name" {
  description = "Name of the Cloud NAT (if created)"
  value       = var.create_cloud_nat ? google_compute_router_nat.this[0].name : null
}

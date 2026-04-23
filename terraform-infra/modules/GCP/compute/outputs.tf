output "instance_ids" {
  description = "Map of instance name to self_link"
  value       = { for k, v in google_compute_instance.this : k => v.self_link }
}

output "instance_internal_ips" {
  description = "Map of instance name to internal IP"
  value       = { for k, v in google_compute_instance.this : k => v.network_interface[0].network_ip }
}

output "instance_external_ips" {
  description = "Map of instance name to external IP (empty string if no public IP)"
  value = {
    for k, v in google_compute_instance.this : k =>
    length(v.network_interface[0].access_config) > 0 ? v.network_interface[0].access_config[0].nat_ip : ""
  }
}

output "instance_names" {
  description = "List of instance names"
  value       = keys(google_compute_instance.this)
}

output "additional_disk_ids" {
  description = "Map of additional disk key to self_link"
  value       = { for k, v in google_compute_disk.additional : k => v.self_link }
}

output "instance_template_self_link" {
  description = "Self-link of the instance template (if created)"
  value       = var.create_instance_template ? google_compute_instance_template.this[0].self_link : null
}

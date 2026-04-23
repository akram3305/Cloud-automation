output "bucket_names" {
  description = "Map of logical key to bucket name"
  value       = { for k, v in google_storage_bucket.this : k => v.name }
}

output "bucket_self_links" {
  description = "Map of logical key to bucket self_link"
  value       = { for k, v in google_storage_bucket.this : k => v.self_link }
}

output "bucket_urls" {
  description = "Map of logical key to bucket URL (gs://...)"
  value       = { for k, v in google_storage_bucket.this : k => v.url }
}

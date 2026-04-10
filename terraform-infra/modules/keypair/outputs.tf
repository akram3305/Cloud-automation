output "key_name" {
  value = var.generate_new_key ? aws_key_pair.this[0].key_name : data.aws_key_pair.existing[0].key_name
}

output "private_key_path" {
  value = var.generate_new_key && var.save_locally ? local_file.private_key[0].filename : null
}

output "public_key" {
  value = var.generate_new_key ? tls_private_key.this[0].public_key_openssh : null
}
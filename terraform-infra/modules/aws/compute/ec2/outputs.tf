output "instance_ids" {
  value = { for k, v in aws_instance.this : k => v.id }
}

output "public_ips" {
  value = { for k, v in aws_instance.this : k => v.public_ip }
}

output "private_ips" {
  value = { for k, v in aws_instance.this : k => v.private_ip }
}

output "eip_public_ips" {
  value = { for k, v in aws_eip.this : k => v.public_ip }
}
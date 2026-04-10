output "security_group_ids" {
  description = "Map of security group name -> ID"
  value       = { for k, v in aws_security_group.this : k => v.id }
}

output "security_group_arns" {
  description = "Map of security group name -> ARN"
  value       = { for k, v in aws_security_group.this : k => v.arn }
}

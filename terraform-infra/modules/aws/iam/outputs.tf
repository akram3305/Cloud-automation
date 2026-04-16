output "role_arns" {
  description = "Map of role name -> ARN"
  value       = { for k, v in aws_iam_role.this : k => v.arn }
}

output "role_names" {
  description = "Map of role key -> role name"
  value       = { for k, v in aws_iam_role.this : k => v.name }
}

output "role_ids" {
  description = "Map of role key -> unique ID"
  value       = { for k, v in aws_iam_role.this : k => v.unique_id }
}

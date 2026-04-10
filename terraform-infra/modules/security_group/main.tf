# Security Group Module
resource "aws_security_group" "this" {
  for_each = var.security_groups

  name        = each.value.name
  description = each.value.description
  vpc_id      = each.value.vpc_id

  # Dynamic ingress rules
  dynamic "ingress" {
    for_each = each.value.ingress_rules
    content {
      description      = ingress.value.description
      from_port        = ingress.value.from_port
      to_port          = ingress.value.to_port
      protocol         = ingress.value.protocol
      cidr_blocks      = ingress.value.cidr_blocks
      ipv6_cidr_blocks = ingress.value.ipv6_cidr_blocks
      prefix_list_ids  = ingress.value.prefix_list_ids
      security_groups  = ingress.value.security_groups
      self             = ingress.value.self
    }
  }

  # Dynamic egress rules
  dynamic "egress" {
    for_each = each.value.egress_rules
    content {
      description      = egress.value.description
      from_port        = egress.value.from_port
      to_port          = egress.value.to_port
      protocol         = egress.value.protocol
      cidr_blocks      = egress.value.cidr_blocks
      ipv6_cidr_blocks = egress.value.ipv6_cidr_blocks
      prefix_list_ids  = egress.value.prefix_list_ids
      security_groups  = egress.value.security_groups
      self             = egress.value.self
    }
  }

  tags = merge(
    each.value.tags,
    {
      Name        = each.value.name
      ManagedBy   = "terraform"
      Environment = var.environment
    }
  )
}

# Default security group rules (optional)
resource "aws_security_group_rule" "custom_rules" {
  for_each = var.custom_rules

  description              = each.value.description
  type                     = each.value.type
  from_port                = each.value.from_port
  to_port                  = each.value.to_port
  protocol                 = each.value.protocol
  cidr_blocks             = each.value.cidr_blocks
  ipv6_cidr_blocks        = each.value.ipv6_cidr_blocks
  prefix_list_ids         = each.value.prefix_list_ids
  security_group_id       = aws_security_group.this[each.value.security_group_key].id
  source_security_group_id = each.value.source_security_group_id
  self                     = each.value.self
}

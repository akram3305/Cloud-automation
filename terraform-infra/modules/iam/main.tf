# ============================================================
# IAM Roles Module
# ============================================================

locals {
  assume_role_policies = {
    ec2      = "ec2.amazonaws.com"
    eks      = "eks.amazonaws.com"
    eks_node = "ec2.amazonaws.com"
    lambda   = "lambda.amazonaws.com"
    ecs      = "ecs-tasks.amazonaws.com"
  }

  managed_policies = {
    ec2 = [
      "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
      "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy",
    ]
    eks = [
      "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy",
      "arn:aws:iam::aws:policy/AmazonEKSVPCResourceController",
    ]
    eks_node = [
      "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
      "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
      "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
    ]
    lambda = [
      "arn:aws:iam::aws:policy/AWSLambdaBasicExecutionRole",
      "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess",
    ]
    ecs = [
      "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
    ]
  }
}

resource "aws_iam_role" "this" {
  for_each = var.roles

  name        = each.value.name
  description = each.value.description  # ← was lookup(), now direct access on typed object
  path        = "/"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = local.assume_role_policies[each.value.type]
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = merge(var.tags, {
    Name        = each.value.name
    Environment = var.environment
    ManagedBy   = "terraform"
    CreatedBy   = "AIonOS-Platform"
  })
}

resource "aws_iam_role_policy_attachment" "managed" {
  for_each = {
    for combo in flatten([
      for role_key, role in var.roles : [
        for policy_arn in local.managed_policies[role.type] : {
          key        = "${role_key}__${policy_arn}"
          role_name  = aws_iam_role.this[role_key].name
          policy_arn = policy_arn
        }
      ]
    ]) : combo.key => combo
  }

  role       = each.value.role_name
  policy_arn = each.value.policy_arn
}

resource "aws_iam_role_policy_attachment" "custom" {
  for_each = {
    for combo in flatten([
      for role_key, role in var.roles : [
        for policy_arn in role.extra_policies : {  # ← was lookup(), now direct access
          key        = "${role_key}__${policy_arn}"
          role_name  = aws_iam_role.this[role_key].name
          policy_arn = policy_arn
        }
      ]
    ]) : combo.key => combo
  }

  role       = each.value.role_name
  policy_arn = each.value.policy_arn
}
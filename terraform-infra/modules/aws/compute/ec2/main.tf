resource "aws_instance" "this" {
  for_each = var.instances

  ami                    = each.value.ami
  instance_type          = each.value.instance_type
  subnet_id              = each.value.subnet_id
  vpc_security_group_ids = each.value.vpc_security_group_ids
  key_name               = each.value.key_name
  iam_instance_profile   = try(each.value.iam_instance_profile, null)

  # User data
  user_data = each.value.user_data != null ? (
    fileexists("${path.module}/user_data/templates/${each.value.user_data}") ?
    templatefile("${path.module}/user_data/templates/${each.value.user_data}", 
      merge(try(each.value.user_data_vars, {}), {
        environment = var.environment
        hostname    = each.key
      })
    )
    : each.value.user_data
  ) : null

  user_data_replace_on_change = try(each.value.user_data_replace_on_change, false)

  # Root volume
  root_block_device {
    volume_type           = each.value.root_volume_type
    volume_size           = each.value.root_volume_size
    delete_on_termination = each.value.root_volume_delete_on_termination
    encrypted             = each.value.root_volume_encrypted
    kms_key_id            = try(each.value.root_volume_kms_key_id, null)
    iops                  = try(each.value.root_volume_iops, null)
    throughput            = try(each.value.root_volume_throughput, null)
  }

  # Additional volumes
  dynamic "ebs_block_device" {
    for_each = try(each.value.ebs_volumes, [])
    content {
      device_name           = ebs_block_device.value.device_name
      volume_type           = ebs_block_device.value.volume_type
      volume_size           = ebs_block_device.value.volume_size
      delete_on_termination = ebs_block_device.value.delete_on_termination
      encrypted             = ebs_block_device.value.encrypted
      kms_key_id            = try(ebs_block_device.value.kms_key_id, null)
      iops                  = try(ebs_block_device.value.iops, null)
      throughput            = try(ebs_block_device.value.throughput, null)
      snapshot_id           = try(ebs_block_device.value.snapshot_id, null)
    }
  }

  associate_public_ip_address = each.value.associate_public_ip_address

  monitoring              = each.value.monitoring
  disable_api_termination = each.value.disable_api_termination

  metadata_options {
    http_endpoint               = each.value.metadata_http_endpoint
    http_tokens                 = each.value.metadata_http_tokens
    http_put_response_hop_limit = each.value.metadata_http_hop_limit
    instance_metadata_tags      = each.value.metadata_instance_tags
  }

  tags = merge(
    each.value.tags,
    {
      Name        = each.key
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  )

  lifecycle {
    ignore_changes = [
      ami,
      user_data,
      ebs_block_device,
      vpc_security_group_ids,
      subnet_id,
      key_name,
      associate_public_ip_address,
      monitoring,
    ]
    prevent_destroy = false
    create_before_destroy = false
  }
}

# EIP
resource "aws_eip" "this" {
  for_each = {
    for k, v in var.instances :
    k => v if v.associate_public_ip_address && try(v.allocate_eip, false)
  }

  domain = "vpc"

  tags = merge(
    var.instances[each.key].tags,
    {
      Name        = "${each.key}-eip"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  )
}

resource "aws_eip_association" "this" {
  for_each = aws_eip.this

  instance_id   = aws_instance.this[each.key].id
  allocation_id = each.value.id
}

# CPU Alarm
resource "aws_cloudwatch_metric_alarm" "cpu_utilization" {
  for_each = {
    for k, v in var.instances :
    k => v if try(v.enable_cpu_alarm, false)
  }

  alarm_name          = "${each.key}-cpu-utilization"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = each.value.cpu_alarm_evaluation_periods
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = each.value.cpu_alarm_period
  statistic           = "Average"
  threshold           = each.value.cpu_alarm_threshold

  alarm_actions = try(each.value.cpu_alarm_actions, [])
  ok_actions    = try(each.value.cpu_alarm_ok_actions, [])

  dimensions = {
    InstanceId = aws_instance.this[each.key].id
  }

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
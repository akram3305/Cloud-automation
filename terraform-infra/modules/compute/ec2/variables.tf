variable "environment" {
  type = string
}

variable "instances" {
  type = map(object({
    ami                    = string
    instance_type          = string
    subnet_id              = string
    vpc_security_group_ids = list(string)
    key_name               = string

    iam_instance_profile = optional(string)

    user_data                   = optional(string)
    user_data_vars              = optional(map(any), {})
    user_data_replace_on_change = optional(bool, false)

    root_volume_type              = string
    root_volume_size              = number
    root_volume_delete_on_termination = bool
    root_volume_encrypted         = bool
    root_volume_kms_key_id        = optional(string)
    root_volume_iops              = optional(number)
    root_volume_throughput        = optional(number)

    ebs_volumes = optional(list(object({
      device_name           = string
      volume_type           = string
      volume_size           = number
      delete_on_termination = bool
      encrypted             = bool
      kms_key_id            = optional(string)
      iops                  = optional(number)
      throughput            = optional(number)
      snapshot_id           = optional(string)
    })), [])

    associate_public_ip_address = bool
    allocate_eip               = optional(bool, false)

    monitoring              = bool
    disable_api_termination = bool

    metadata_http_endpoint  = string
    metadata_http_tokens    = string
    metadata_http_hop_limit = number
    metadata_instance_tags  = string

    enable_cpu_alarm             = optional(bool, false)
    cpu_alarm_threshold          = optional(number, 80)
    cpu_alarm_period             = optional(number, 300)
    cpu_alarm_evaluation_periods = optional(number, 2)
    cpu_alarm_actions            = optional(list(string), [])
    cpu_alarm_ok_actions         = optional(list(string), [])

    tags = map(string)
  }))
}
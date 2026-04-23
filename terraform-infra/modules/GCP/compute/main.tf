locals {
  default_labels = merge(var.labels, {
    managed_by = "terraform"
    module     = "gcp-compute"
  })
}

# ---------------------------------------------------------------------------
# Compute Engine instances
# ---------------------------------------------------------------------------
resource "google_compute_instance" "this" {
  for_each = var.instances

  name         = each.key
  machine_type = each.value.machine_type
  zone         = each.value.zone != "" ? each.value.zone : "${var.region}-a"
  project      = var.project_id

  tags   = each.value.tags
  labels = merge(local.default_labels, each.value.labels)

  deletion_protection = each.value.deletion_protection

  boot_disk {
    initialize_params {
      image = each.value.boot_image
      size  = each.value.boot_disk_size
      type  = each.value.boot_disk_type
    }
  }

  dynamic "attached_disk" {
    for_each = each.value.additional_disks
    content {
      source      = google_compute_disk.additional["${each.key}/${attached_disk.value.disk_name}"].self_link
      device_name = attached_disk.value.disk_name
    }
  }

  network_interface {
    network    = each.value.network
    subnetwork = each.value.subnetwork != "" ? each.value.subnetwork : null

    dynamic "access_config" {
      for_each = each.value.assign_public_ip ? [1] : []
      content {
        # Ephemeral public IP
      }
    }
  }

  metadata = merge(
    each.value.metadata,
    each.value.startup_script != "" ? { startup-script = each.value.startup_script } : {}
  )

  dynamic "service_account" {
    for_each = each.value.service_account_email != "" ? [1] : []
    content {
      email  = each.value.service_account_email
      scopes = each.value.service_account_scopes
    }
  }

  lifecycle {
    ignore_changes = [metadata["ssh-keys"]]
  }
}

# ---------------------------------------------------------------------------
# Additional persistent disks
# ---------------------------------------------------------------------------
resource "google_compute_disk" "additional" {
  for_each = {
    for pair in flatten([
      for instance_name, inst in var.instances : [
        for disk in inst.additional_disks : {
          key       = "${instance_name}/${disk.disk_name}"
          zone      = inst.zone != "" ? inst.zone : "${var.region}-a"
          disk_name = disk.disk_name
          disk_type = disk.disk_type
          disk_size = disk.disk_size
        }
      ]
    ]) : pair.key => pair
  }

  name    = each.value.disk_name
  type    = each.value.disk_type
  size    = each.value.disk_size
  zone    = each.value.zone
  project = var.project_id

  labels = local.default_labels
}

# ---------------------------------------------------------------------------
# Firewall rules
# ---------------------------------------------------------------------------
resource "google_compute_firewall" "this" {
  for_each = var.firewall_rules

  name        = each.key
  network     = "default"
  project     = var.project_id
  direction   = each.value.direction
  priority    = each.value.priority
  description = each.value.description

  dynamic "allow" {
    for_each = each.value.direction == "INGRESS" || each.value.direction == "" ? [1] : []
    content {
      protocol = each.value.protocol
      ports    = each.value.ports
    }
  }

  dynamic "deny" {
    for_each = each.value.direction == "EGRESS" ? [1] : []
    content {
      protocol = each.value.protocol
      ports    = each.value.ports
    }
  }

  source_ranges = each.value.direction != "EGRESS" ? each.value.ranges : null
  destination_ranges = each.value.direction == "EGRESS" ? each.value.ranges : null
  target_tags   = length(each.value.target_tags) > 0 ? each.value.target_tags : null
  source_tags   = length(each.value.source_tags) > 0 ? each.value.source_tags : null
}

# ---------------------------------------------------------------------------
# Instance template (optional, for MIGs)
# ---------------------------------------------------------------------------
resource "google_compute_instance_template" "this" {
  count = var.create_instance_template ? 1 : 0

  name_prefix  = var.instance_template_name
  machine_type = var.template_machine_type
  project      = var.project_id

  disk {
    boot         = true
    auto_delete  = true
    source_image = var.template_boot_image
  }

  network_interface {
    network = "default"
  }

  metadata = var.template_startup_script != "" ? {
    startup-script = var.template_startup_script
  } : {}

  labels = local.default_labels

  lifecycle {
    create_before_destroy = true
  }
}

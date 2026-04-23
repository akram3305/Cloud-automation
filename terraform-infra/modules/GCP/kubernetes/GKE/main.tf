locals {
  default_labels = merge(var.labels, {
    managed_by = "terraform"
    module     = "gcp-gke"
  })
}

# ---------------------------------------------------------------------------
# GKE Cluster
# ---------------------------------------------------------------------------
resource "google_container_cluster" "this" {
  name     = var.cluster_name
  project  = var.project_id
  location = var.regional_cluster ? var.region : "${var.region}-a"

  node_locations = length(var.cluster_zones) > 0 ? var.cluster_zones : null

  network    = var.network
  subnetwork = var.subnetwork

  # Remove default node pool; use separately managed pools
  remove_default_node_pool = var.remove_default_node_pool
  initial_node_count       = 1

  # Release channel / version
  min_master_version = var.kubernetes_version != "" ? var.kubernetes_version : null

  release_channel {
    channel = var.kubernetes_version != "" ? "UNSPECIFIED" : var.release_channel
  }

  # Private cluster config
  dynamic "private_cluster_config" {
    for_each = var.private_cluster ? [1] : []
    content {
      enable_private_nodes    = true
      enable_private_endpoint = var.enable_private_endpoint
      master_ipv4_cidr_block  = var.master_ipv4_cidr_block
    }
  }

  # Authorized networks
  dynamic "master_authorized_networks_config" {
    for_each = length(var.master_authorized_networks) > 0 ? [1] : []
    content {
      dynamic "cidr_blocks" {
        for_each = var.master_authorized_networks
        content {
          cidr_block   = cidr_blocks.value.cidr_block
          display_name = cidr_blocks.value.display_name
        }
      }
    }
  }

  # VPC-native (alias IP) networking
  ip_allocation_policy {
    cluster_secondary_range_name  = var.cluster_secondary_range_name != "" ? var.cluster_secondary_range_name : null
    services_secondary_range_name = var.services_secondary_range_name != "" ? var.services_secondary_range_name : null
    cluster_ipv4_cidr_block       = var.pods_ipv4_cidr_block != "" && var.cluster_secondary_range_name == "" ? var.pods_ipv4_cidr_block : null
    services_ipv4_cidr_block      = var.services_ipv4_cidr_block != "" && var.services_secondary_range_name == "" ? var.services_ipv4_cidr_block : null
  }

  # Add-ons
  addons_config {
    http_load_balancing {
      disabled = !var.enable_http_load_balancing
    }
    horizontal_pod_autoscaling {
      disabled = !var.enable_horizontal_pod_autoscaling
    }
    network_policy_config {
      disabled = !var.enable_network_policy
    }
  }

  # Network policy
  dynamic "network_policy" {
    for_each = var.enable_network_policy ? [1] : []
    content {
      enabled  = true
      provider = "CALICO"
    }
  }

  # Workload Identity
  dynamic "workload_identity_config" {
    for_each = var.enable_workload_identity ? [1] : []
    content {
      workload_pool = "${var.project_id}.svc.id.goog"
    }
  }

  logging_service    = var.logging_service
  monitoring_service = var.monitoring_service

  resource_labels = local.default_labels

  lifecycle {
    ignore_changes = [
      initial_node_count,
      node_locations,
    ]
  }
}

# ---------------------------------------------------------------------------
# Node pools
# ---------------------------------------------------------------------------
resource "google_container_node_pool" "this" {
  for_each = var.node_pools

  name     = each.key
  cluster  = google_container_cluster.this.id
  project  = var.project_id
  location = var.regional_cluster ? var.region : "${var.region}-a"

  node_locations = length(each.value.node_locations) > 0 ? each.value.node_locations : null

  initial_node_count = each.value.initial_node_count

  autoscaling {
    min_node_count = each.value.min_count
    max_node_count = each.value.max_count
  }

  management {
    auto_repair  = each.value.auto_repair
    auto_upgrade = each.value.auto_upgrade
  }

  node_config {
    machine_type = each.value.machine_type
    disk_size_gb = each.value.disk_size_gb
    disk_type    = each.value.disk_type
    image_type   = each.value.image_type
    preemptible  = each.value.preemptible
    spot         = each.value.spot

    labels = merge(local.default_labels, each.value.node_labels)

    dynamic "taint" {
      for_each = each.value.node_taints
      content {
        key    = taint.value.key
        value  = taint.value.value
        effect = taint.value.effect
      }
    }

    dynamic "service_account" {
      for_each = each.value.service_account != "" ? [1] : []
      content {}
    }

    service_account = each.value.service_account != "" ? each.value.service_account : null
    oauth_scopes    = each.value.oauth_scopes

    dynamic "workload_metadata_config" {
      for_each = var.enable_workload_identity ? [1] : []
      content {
        mode = "GKE_METADATA"
      }
    }

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }
  }

  lifecycle {
    ignore_changes = [initial_node_count]
  }
}

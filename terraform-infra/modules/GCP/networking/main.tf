locals {
  default_labels = merge(var.labels, {
    managed_by = "terraform"
    module     = "gcp-networking"
  })
}

# ---------------------------------------------------------------------------
# VPC Network
# ---------------------------------------------------------------------------
resource "google_compute_network" "this" {
  name                    = var.vpc_name
  project                 = var.project_id
  auto_create_subnetworks = var.auto_create_subnetworks
  routing_mode            = var.routing_mode
  mtu                     = var.mtu
}

# ---------------------------------------------------------------------------
# Subnets
# ---------------------------------------------------------------------------
resource "google_compute_subnetwork" "this" {
  for_each = var.subnets

  name          = each.key
  network       = google_compute_network.this.self_link
  project       = var.project_id
  region        = each.value.region != "" ? each.value.region : var.region
  ip_cidr_range = each.value.cidr

  private_ip_google_access = each.value.private_google_access

  dynamic "secondary_ip_range" {
    for_each = each.value.secondary_ranges
    content {
      range_name    = secondary_ip_range.value.range_name
      ip_cidr_range = secondary_ip_range.value.ip_cidr_range
    }
  }

  dynamic "log_config" {
    for_each = each.value.flow_logs_enabled ? [1] : []
    content {
      aggregation_interval = "INTERVAL_10_MIN"
      flow_sampling        = each.value.flow_logs_sampling
      metadata             = "INCLUDE_ALL_METADATA"
    }
  }
}

# ---------------------------------------------------------------------------
# Cloud Router (for NAT)
# ---------------------------------------------------------------------------
resource "google_compute_router" "this" {
  count = var.create_cloud_nat ? 1 : 0

  name    = var.cloud_router_name != "" ? var.cloud_router_name : "${var.vpc_name}-router"
  network = google_compute_network.this.self_link
  project = var.project_id
  region  = var.region
}

# ---------------------------------------------------------------------------
# Cloud NAT
# ---------------------------------------------------------------------------
resource "google_compute_router_nat" "this" {
  count = var.create_cloud_nat ? 1 : 0

  name                               = var.nat_name != "" ? var.nat_name : "${var.vpc_name}-nat"
  router                             = google_compute_router.this[0].name
  project                            = var.project_id
  region                             = var.region
  nat_ip_allocate_option             = var.nat_ip_allocate_option
  source_subnetwork_ip_ranges_to_nat = var.nat_source_subnetwork_ip_ranges

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# ---------------------------------------------------------------------------
# VPC Peerings
# ---------------------------------------------------------------------------
resource "google_compute_network_peering" "this" {
  for_each = var.vpc_peerings

  name                                = each.key
  network                             = google_compute_network.this.self_link
  peer_network                        = each.value.peer_vpc_self_link
  export_custom_routes                = each.value.export_custom_routes
  import_custom_routes                = each.value.import_custom_routes
  export_subnet_routes_with_public_ip = each.value.export_subnet_routes_with_public_ip
}

# ---------------------------------------------------------------------------
# Firewall rules
# ---------------------------------------------------------------------------
resource "google_compute_firewall" "this" {
  for_each = var.firewall_rules

  name        = each.key
  network     = google_compute_network.this.self_link
  project     = var.project_id
  direction   = each.value.direction
  priority    = each.value.priority
  description = each.value.description

  dynamic "allow" {
    for_each = each.value.direction != "EGRESS" ? [1] : []
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

  source_ranges      = each.value.direction != "EGRESS" ? each.value.ranges : null
  destination_ranges = each.value.direction == "EGRESS" ? each.value.ranges : null
  target_tags        = length(each.value.target_tags) > 0 ? each.value.target_tags : null
  source_tags        = length(each.value.source_tags) > 0 ? each.value.source_tags : null
}

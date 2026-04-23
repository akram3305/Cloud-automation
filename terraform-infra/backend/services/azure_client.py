# -*- coding: utf-8 -*-
"""
services/azure_client.py — AIonOS Platform

Azure SDK client factory for 3-subscription Hub-and-Spoke architecture:
  - prod        → Production subscription
  - nonprod     → Non-Production subscription
  - connectivity → Connectivity (hub networking) subscription
"""
import os
from functools import lru_cache
from dotenv import load_dotenv

from azure.identity import ClientSecretCredential
from azure.mgmt.compute import ComputeManagementClient
from azure.mgmt.network import NetworkManagementClient
from azure.mgmt.storage import StorageManagementClient
from azure.mgmt.resource import ResourceManagementClient
from azure.mgmt.monitor import MonitorManagementClient

load_dotenv()

# ── Subscription config ────────────────────────────────────────────────────
AZURE_TENANT_ID = os.getenv("AZURE_TENANT_ID", "")

SUBSCRIPTIONS = {
    "prod": {
        "subscription_id": os.getenv("AZURE_PROD_SUBSCRIPTION_ID", ""),
        "client_id":       os.getenv("AZURE_PROD_CLIENT_ID", ""),
        "client_secret":   os.getenv("AZURE_PROD_CLIENT_SECRET", ""),
    },
    "nonprod": {
        "subscription_id": os.getenv("AZURE_NONPROD_SUBSCRIPTION_ID", ""),
        "client_id":       os.getenv("AZURE_NONPROD_CLIENT_ID", ""),
        "client_secret":   os.getenv("AZURE_NONPROD_CLIENT_SECRET", ""),
    },
    "connectivity": {
        "subscription_id": os.getenv("AZURE_CONNECTIVITY_SUBSCRIPTION_ID", ""),
        "client_id":       os.getenv("AZURE_CONNECTIVITY_CLIENT_ID", ""),
        "client_secret":   os.getenv("AZURE_CONNECTIVITY_CLIENT_SECRET", ""),
    },
}

VALID_SUBSCRIPTIONS = ("prod", "nonprod", "connectivity")


def _validate_subscription(subscription: str):
    if subscription not in VALID_SUBSCRIPTIONS:
        raise ValueError(
            f"Invalid subscription '{subscription}'. "
            f"Must be one of: {VALID_SUBSCRIPTIONS}"
        )


def _get_credential(subscription: str) -> ClientSecretCredential:
    _validate_subscription(subscription)
    cfg = SUBSCRIPTIONS[subscription]
    return ClientSecretCredential(
        tenant_id=AZURE_TENANT_ID,
        client_id=cfg["client_id"],
        client_secret=cfg["client_secret"],
    )


def _get_subscription_id(subscription: str) -> str:
    _validate_subscription(subscription)
    return SUBSCRIPTIONS[subscription]["subscription_id"]


# ── Client factories ───────────────────────────────────────────────────────

def get_compute_client(subscription: str = "nonprod") -> ComputeManagementClient:
    return ComputeManagementClient(
        credential=_get_credential(subscription),
        subscription_id=_get_subscription_id(subscription),
    )


def get_network_client(subscription: str = "connectivity") -> NetworkManagementClient:
    return NetworkManagementClient(
        credential=_get_credential(subscription),
        subscription_id=_get_subscription_id(subscription),
    )


def get_storage_client(subscription: str = "nonprod") -> StorageManagementClient:
    return StorageManagementClient(
        credential=_get_credential(subscription),
        subscription_id=_get_subscription_id(subscription),
    )


def get_resource_client(subscription: str = "nonprod") -> ResourceManagementClient:
    return ResourceManagementClient(
        credential=_get_credential(subscription),
        subscription_id=_get_subscription_id(subscription),
    )


def get_monitor_client(subscription: str = "nonprod") -> MonitorManagementClient:
    return MonitorManagementClient(
        credential=_get_credential(subscription),
        subscription_id=_get_subscription_id(subscription),
    )


# ── Health check ──────────────────────────────────────────────────────────

def check_azure_connectivity() -> dict:
    """Test connectivity for all 3 subscriptions. Returns status per subscription."""
    results = {}
    for sub in VALID_SUBSCRIPTIONS:
        cfg = SUBSCRIPTIONS[sub]
        if not cfg["subscription_id"] or not cfg["client_id"]:
            results[sub] = {"status": "not_configured"}
            continue
        try:
            client = get_resource_client(sub)
            list(client.resource_groups.list())
            results[sub] = {"status": "connected", "subscription_id": cfg["subscription_id"]}
        except Exception as e:
            results[sub] = {"status": "error", "message": str(e)}
    return results

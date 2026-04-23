# -*- coding: utf-8 -*-
"""
routers/azure_storage.py — AIonOS Platform

Azure Storage management: Storage Accounts → Blob Containers, File Shares, Queues, Tables
Mirrors the real Azure hierarchy: create a Storage Account first, then manage data services inside it.

Route ordering: /accounts specific paths registered before /{account_name}/... parameterised paths.
All mutating operations return immediately; Azure LROs complete in the background via BackgroundTasks.
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Query
from pydantic import BaseModel
from typing import Optional

from routers.auth import get_current_user, require_operator
from services.azure_client import get_storage_client, VALID_SUBSCRIPTIONS

router = APIRouter(prefix="/azure/storage", tags=["azure-storage"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _rg_from_id(resource_id: str) -> str:
    """Parse resource group name out of an Azure resource ID string."""
    parts = (resource_id or "").split("/")
    try:
        return parts[parts.index("resourceGroups") + 1]
    except (ValueError, IndexError):
        return ""


def _validate_sub(sub: str):
    if sub not in VALID_SUBSCRIPTIONS:
        raise HTTPException(status_code=400, detail=f"Invalid subscription '{sub}'. Must be one of: {list(VALID_SUBSCRIPTIONS)}")


def _run_poller(poller):
    try:
        poller.result()
    except Exception:
        pass


# ── Schemas ───────────────────────────────────────────────────────────────────

class StorageAccountCreate(BaseModel):
    name:           str
    resource_group: str
    location:       str
    subscription:   str  = "nonprod"
    sku:            str  = "Standard_LRS"   # Standard_LRS | Standard_GRS | Standard_ZRS | Premium_LRS
    kind:           str  = "StorageV2"      # StorageV2 | BlobStorage | FileStorage
    tags:           dict = {}


class ContainerCreate(BaseModel):
    name:           str
    resource_group: str
    subscription:   str = "nonprod"
    public_access:  str = "None"            # None | Blob | Container


class FileShareCreate(BaseModel):
    name:           str
    resource_group: str
    subscription:   str = "nonprod"
    quota_gb:       int = 100


class QueueCreate(BaseModel):
    name:           str
    resource_group: str
    subscription:   str = "nonprod"


class TableCreate(BaseModel):
    name:           str
    resource_group: str
    subscription:   str = "nonprod"


# ── Storage Accounts ──────────────────────────────────────────────────────────

@router.get("/accounts")
def list_storage_accounts(
    subscription: str = "nonprod",
    current_user=Depends(get_current_user),
):
    """List all storage accounts in the given subscription."""
    _validate_sub(subscription)
    try:
        client = get_storage_client(subscription)
        accounts = list(client.storage_accounts.list())
        result = []
        for a in accounts:
            ep = a.primary_endpoints
            result.append({
                "name":               a.name,
                "id":                 a.id,
                "resource_group":     _rg_from_id(a.id or ""),
                "location":           a.location,
                "sku":                a.sku.name if a.sku else None,
                "kind":               a.kind,
                "provisioning_state": a.provisioning_state,
                "blob_endpoint":      ep.blob  if ep else None,
                "file_endpoint":      ep.file  if ep else None,
                "queue_endpoint":     ep.queue if ep else None,
                "table_endpoint":     ep.table if ep else None,
                "tags":               a.tags or {},
            })
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/accounts")
def create_storage_account(
    payload: StorageAccountCreate,
    background_tasks: BackgroundTasks,
    current_user=Depends(require_operator),
):
    """Create a new storage account. Azure LRO runs in the background."""
    _validate_sub(payload.subscription)
    try:
        from azure.mgmt.storage.models import StorageAccountCreateParameters, Sku
        client = get_storage_client(payload.subscription)
        params = StorageAccountCreateParameters(
            sku=Sku(name=payload.sku),
            kind=payload.kind,
            location=payload.location,
            tags=payload.tags,
        )
        poller = client.storage_accounts.begin_create(
            payload.resource_group, payload.name, params
        )
        background_tasks.add_task(_run_poller, poller)
        return {
            "message": f"Storage account '{payload.name}' creation initiated",
            "status":  "creating",
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/accounts/{resource_group}/{account_name}")
def delete_storage_account(
    resource_group: str,
    account_name:   str,
    subscription:   str = "nonprod",
    current_user=Depends(require_operator),
):
    """Delete a storage account (and all data inside it)."""
    _validate_sub(subscription)
    try:
        client = get_storage_client(subscription)
        client.storage_accounts.delete(resource_group, account_name)
        return {"message": f"Storage account '{account_name}' deleted"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Blob Containers ───────────────────────────────────────────────────────────

@router.get("/{account_name}/containers")
def list_containers(
    account_name:   str,
    resource_group: str = Query(..., description="Resource group of the storage account"),
    subscription:   str = "nonprod",
    current_user=Depends(get_current_user),
):
    """List all blob containers inside a storage account."""
    _validate_sub(subscription)
    try:
        client = get_storage_client(subscription)
        items = list(client.blob_containers.list(resource_group, account_name))
        return [
            {
                "name":          c.name,
                "public_access": str(c.public_access) if c.public_access else "None",
                "last_modified": str(c.last_modified_time) if c.last_modified_time else None,
                "lease_state":   c.lease_state,
            }
            for c in items
        ]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/{account_name}/containers")
def create_container(
    account_name: str,
    payload:      ContainerCreate,
    current_user=Depends(require_operator),
):
    """Create a blob container inside a storage account."""
    _validate_sub(payload.subscription)
    try:
        from azure.mgmt.storage.models import BlobContainer, PublicAccess
        access_map = {
            "Blob":      PublicAccess.BLOB,
            "Container": PublicAccess.CONTAINER,
        }
        client = get_storage_client(payload.subscription)
        container = BlobContainer(public_access=access_map.get(payload.public_access))
        result = client.blob_containers.create(
            payload.resource_group, account_name, payload.name, container
        )
        return {"message": f"Container '{payload.name}' created", "name": result.name}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/{account_name}/containers/{container_name}")
def delete_container(
    account_name:   str,
    container_name: str,
    resource_group: str = Query(...),
    subscription:   str = "nonprod",
    current_user=Depends(require_operator),
):
    """Delete a blob container."""
    _validate_sub(subscription)
    try:
        client = get_storage_client(subscription)
        client.blob_containers.delete(resource_group, account_name, container_name)
        return {"message": f"Container '{container_name}' deleted"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── File Shares ───────────────────────────────────────────────────────────────

@router.get("/{account_name}/fileshares")
def list_file_shares(
    account_name:   str,
    resource_group: str = Query(...),
    subscription:   str = "nonprod",
    current_user=Depends(get_current_user),
):
    """List all file shares inside a storage account."""
    _validate_sub(subscription)
    try:
        client = get_storage_client(subscription)
        items = list(client.file_shares.list(resource_group, account_name))
        return [
            {
                "name":     s.name,
                "quota_gb": s.share_quota,
                "last_modified": str(s.last_modified_time) if s.last_modified_time else None,
            }
            for s in items
        ]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/{account_name}/fileshares")
def create_file_share(
    account_name: str,
    payload:      FileShareCreate,
    current_user=Depends(require_operator),
):
    """Create a file share inside a storage account."""
    _validate_sub(payload.subscription)
    try:
        from azure.mgmt.storage.models import FileShare
        client = get_storage_client(payload.subscription)
        share = FileShare(share_quota=payload.quota_gb)
        result = client.file_shares.create(
            payload.resource_group, account_name, payload.name, share
        )
        return {"message": f"File share '{payload.name}' created", "name": result.name}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/{account_name}/fileshares/{share_name}")
def delete_file_share(
    account_name:   str,
    share_name:     str,
    resource_group: str = Query(...),
    subscription:   str = "nonprod",
    current_user=Depends(require_operator),
):
    """Delete a file share."""
    _validate_sub(subscription)
    try:
        client = get_storage_client(subscription)
        client.file_shares.delete(resource_group, account_name, share_name)
        return {"message": f"File share '{share_name}' deleted"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Queues ────────────────────────────────────────────────────────────────────

@router.get("/{account_name}/queues")
def list_queues(
    account_name:   str,
    resource_group: str = Query(...),
    subscription:   str = "nonprod",
    current_user=Depends(get_current_user),
):
    """List all queues inside a storage account."""
    _validate_sub(subscription)
    try:
        client = get_storage_client(subscription)
        items = list(client.queue.list(resource_group, account_name))
        return [{"name": q.name, "metadata": q.metadata or {}} for q in items]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/{account_name}/queues")
def create_queue(
    account_name: str,
    payload:      QueueCreate,
    current_user=Depends(require_operator),
):
    """Create a queue inside a storage account."""
    _validate_sub(payload.subscription)
    try:
        from azure.mgmt.storage.models import StorageQueue
        client = get_storage_client(payload.subscription)
        result = client.queue.create(
            payload.resource_group, account_name, payload.name, StorageQueue()
        )
        return {"message": f"Queue '{payload.name}' created", "name": result.name}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/{account_name}/queues/{queue_name}")
def delete_queue(
    account_name:   str,
    queue_name:     str,
    resource_group: str = Query(...),
    subscription:   str = "nonprod",
    current_user=Depends(require_operator),
):
    """Delete a queue."""
    _validate_sub(subscription)
    try:
        client = get_storage_client(subscription)
        client.queue.delete(resource_group, account_name, queue_name)
        return {"message": f"Queue '{queue_name}' deleted"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Tables ────────────────────────────────────────────────────────────────────

@router.get("/{account_name}/tables")
def list_tables(
    account_name:   str,
    resource_group: str = Query(...),
    subscription:   str = "nonprod",
    current_user=Depends(get_current_user),
):
    """List all tables inside a storage account."""
    _validate_sub(subscription)
    try:
        client = get_storage_client(subscription)
        items = list(client.table.list(resource_group, account_name))
        return [{"name": t.name} for t in items]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/{account_name}/tables")
def create_table(
    account_name: str,
    payload:      TableCreate,
    current_user=Depends(require_operator),
):
    """Create a table inside a storage account."""
    _validate_sub(payload.subscription)
    try:
        client = get_storage_client(payload.subscription)
        result = client.table.create(payload.resource_group, account_name, payload.name)
        return {"message": f"Table '{payload.name}' created", "name": result.name}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/{account_name}/tables/{table_name}")
def delete_table(
    account_name:   str,
    table_name:     str,
    resource_group: str = Query(...),
    subscription:   str = "nonprod",
    current_user=Depends(require_operator),
):
    """Delete a table."""
    _validate_sub(subscription)
    try:
        client = get_storage_client(subscription)
        client.table.delete(resource_group, account_name, table_name)
        return {"message": f"Table '{table_name}' deleted"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

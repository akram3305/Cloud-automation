# -*- coding: utf-8 -*-
"""
routers/azure_vms.py — AIonOS Platform
Azure VM management across 3 subscriptions (prod, nonprod, connectivity)

Route ordering: specific paths (/health, /resource-groups, /vnets, /sizes/*, /locations, /create)
MUST be registered before parameterised catch-alls (/{rg}/{vm}).

Async behaviour: all mutating operations (start/stop/restart/create/delete) return
immediately and complete in the background via FastAPI BackgroundTasks.
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional

from models.user import User
from routers.auth import get_current_user, require_operator
from services.azure_client import (
    get_compute_client,
    get_network_client,
    get_resource_client,
    check_azure_connectivity,
    VALID_SUBSCRIPTIONS,
)

router = APIRouter(prefix="/azure/vms", tags=["azure-vms"])

VALID_SUBS = list(VALID_SUBSCRIPTIONS)


# ── Schemas ───────────────────────────────────────────────────────────────

# ── VM size → estimated hourly price (USD, Pay-As-You-Go) ─────────────────
_VM_PRICE = {
    "Standard_B1s":0.0104,"Standard_B1ms":0.0207,"Standard_B2s":0.0456,"Standard_B2ms":0.0832,
    "Standard_B4ms":0.1660,"Standard_B8ms":0.3320,"Standard_B12ms":0.4980,"Standard_B16ms":0.6640,"Standard_B20ms":0.8300,
    "Standard_D2s_v5":0.0960,"Standard_D4s_v5":0.1920,"Standard_D8s_v5":0.3840,"Standard_D16s_v5":0.7680,
    "Standard_D32s_v5":1.5360,"Standard_D48s_v5":2.3040,"Standard_D64s_v5":3.0720,"Standard_D96s_v5":4.6080,
    "Standard_D2as_v5":0.0888,"Standard_D4as_v5":0.1776,"Standard_D8as_v5":0.3552,"Standard_D16as_v5":0.7104,
    "Standard_E2s_v5":0.1260,"Standard_E4s_v5":0.2520,"Standard_E8s_v5":0.5040,"Standard_E16s_v5":1.0080,
    "Standard_E32s_v5":2.0160,"Standard_E64s_v5":4.0320,"Standard_E96s_v5":5.4432,
    "Standard_F2s_v2":0.0846,"Standard_F4s_v2":0.1690,"Standard_F8s_v2":0.3380,"Standard_F16s_v2":0.6760,
    "Standard_F32s_v2":1.3520,"Standard_F64s_v2":2.7040,"Standard_F72s_v2":3.0420,
    "Standard_NC4as_T4_v3":0.5280,"Standard_NC8as_T4_v3":0.7520,"Standard_NC16as_T4_v3":1.2040,"Standard_NC64as_T4_v3":4.3520,
    "Standard_NC6s_v3":3.0600,"Standard_NC12s_v3":6.1200,"Standard_NC24s_v3":12.240,
    "Standard_M8ms":2.1400,"Standard_M16ms":4.2800,"Standard_M32ms":8.5600,"Standard_M64ms":17.120,"Standard_M128ms":34.240,
}

def _estimate_price(vm_size: str) -> float:
    """Return estimated hourly price for a VM size."""
    import re
    if vm_size in _VM_PRICE:
        return _VM_PRICE[vm_size]
    m = re.search(r"(\d+)", vm_size or "")
    n = int(m.group(1)) if m else 2
    s = vm_size.upper()
    if "NC" in s: return n * 0.132
    if "M128" in s or "M64" in s: return n * 0.268
    if s.startswith("STANDARD_E"): return n * 0.063
    if s.startswith("STANDARD_F"): return n * 0.042
    return n * 0.048  # general purpose fallback


class AzureVMCreate(BaseModel):
    name:               str
    resource_group:     str
    location:           str
    subscription:       str = "nonprod"
    vm_size:            str = "Standard_B2s"
    admin_username:     str = "azureuser"
    admin_password:     Optional[str] = None
    ssh_public_key:     Optional[str] = None
    os_type:            str = "Linux"
    image_publisher:    str = "Canonical"
    image_offer:        str = "0001-com-ubuntu-server-jammy"
    image_sku:          str = "22_04-lts-gen2"
    subnet_id:          str
    enable_public_ip:   bool = False
    os_disk_size_gb:    int = 128
    os_disk_type:       str = "Premium_LRS"
    tags:               dict = {}


class VMSchedule(BaseModel):
    auto_start: Optional[str] = None   # "HH:MM" 24 h, or "" to clear
    auto_stop:  Optional[str] = None   # "HH:MM" 24 h, or "" to clear


# ── Helpers ───────────────────────────────────────────────────────────────

def _serialize_vm(vm, power_state: str = "unknown") -> dict:
    """Convert Azure VM SDK object to a clean dict."""
    if power_state == "unknown" and vm.instance_view and vm.instance_view.statuses:
        for s in vm.instance_view.statuses:
            if s.code and s.code.startswith("PowerState/"):
                power_state = s.code.split("/")[1]
                break
    return {
        "id":                 vm.id,
        "name":               vm.name,
        "location":           vm.location,
        "vm_size":            vm.hardware_profile.vm_size if vm.hardware_profile else None,
        "os_type":            str(vm.storage_profile.os_disk.os_type) if vm.storage_profile and vm.storage_profile.os_disk else None,
        "power_state":        power_state,
        "provisioning_state": vm.provisioning_state,
        "tags":               vm.tags or {},
    }


def _validate_subscription(subscription: str):
    if subscription not in VALID_SUBS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid subscription '{subscription}'. Must be one of: {VALID_SUBS}"
        )


# ── Background task helpers ───────────────────────────────────────────────

def _run_poller(poller):
    """Wait for an Azure LRO poller to complete (runs in background thread)."""
    try:
        poller.result()
    except Exception:
        pass  # errors are swallowed — client should poll VM status separately


def _delete_vm_and_cleanup(compute, network, poller, resource_group: str, nic_ids: list, os_disk_name: Optional[str]):
    """
    Background: wait for VM deletion, then delete associated NICs, public IPs, and OS disk.
    """
    try:
        poller.result()
    except Exception:
        return  # VM delete failed — skip cleanup to avoid orphaning half-deleted resources

    for nic_id in nic_ids:
        try:
            nic_name = nic_id.split("/")[-1]
            nic = network.network_interfaces.get(resource_group, nic_name)
            pip_ids = [
                ipc.public_ip_address.id
                for ipc in (nic.ip_configurations or [])
                if ipc.public_ip_address
            ]
            network.network_interfaces.begin_delete(resource_group, nic_name).result()
            for pip_id in pip_ids:
                try:
                    network.public_ip_addresses.begin_delete(resource_group, pip_id.split("/")[-1]).result()
                except Exception:
                    pass
        except Exception:
            pass

    if os_disk_name:
        try:
            compute.disks.begin_delete(resource_group, os_disk_name).result()
        except Exception:
            pass


def _provision_azure_vm(compute, network, payload: AzureVMCreate):
    """
    Background: create NIC (and optional public IP), then create VM.
    All Azure SDK calls here are blocking — this runs in a background thread.
    """
    from azure.mgmt.compute.models import (
        HardwareProfile, StorageProfile, OSDisk, ManagedDiskParameters,
        OSProfile, NetworkProfile, NetworkInterfaceReference,
        VirtualMachine, ImageReference, LinuxConfiguration,
        SshConfiguration, SshPublicKey,
    )
    from azure.mgmt.network.models import (
        NetworkInterface, NetworkInterfaceIPConfiguration,
        PublicIPAddress, PublicIPAddressSku,
    )

    try:
        pip_resource = None
        if payload.enable_public_ip:
            pip_resource = network.public_ip_addresses.begin_create_or_update(
                payload.resource_group,
                f"{payload.name}-pip",
                PublicIPAddress(
                    location=payload.location,
                    sku=PublicIPAddressSku(name="Standard"),
                    public_ip_allocation_method="Static",
                )
            ).result()

        nic = network.network_interfaces.begin_create_or_update(
            payload.resource_group,
            f"{payload.name}-nic",
            NetworkInterface(
                location=payload.location,
                ip_configurations=[
                    NetworkInterfaceIPConfiguration(
                        name="ipconfig1",
                        subnet={"id": payload.subnet_id},
                        public_ip_address=pip_resource,
                    )
                ],
            ),
        ).result()

        if payload.os_type == "Linux" and payload.ssh_public_key:
            os_profile = OSProfile(
                computer_name=payload.name,
                admin_username=payload.admin_username,
                linux_configuration=LinuxConfiguration(
                    disable_password_authentication=True,
                    ssh=SshConfiguration(
                        public_keys=[SshPublicKey(
                            path=f"/home/{payload.admin_username}/.ssh/authorized_keys",
                            key_data=payload.ssh_public_key,
                        )]
                    ),
                ),
            )
        else:
            os_profile = OSProfile(
                computer_name=payload.name,
                admin_username=payload.admin_username,
                admin_password=payload.admin_password,
            )

        vm_params = VirtualMachine(
            location=payload.location,
            tags=payload.tags,
            hardware_profile=HardwareProfile(vm_size=payload.vm_size),
            storage_profile=StorageProfile(
                image_reference=ImageReference(
                    publisher=payload.image_publisher,
                    offer=payload.image_offer,
                    sku=payload.image_sku,
                    version="latest",
                ),
                os_disk=OSDisk(
                    create_option="FromImage",
                    disk_size_gb=payload.os_disk_size_gb,
                    managed_disk=ManagedDiskParameters(storage_account_type=payload.os_disk_type),
                ),
            ),
            os_profile=os_profile,
            network_profile=NetworkProfile(
                network_interfaces=[NetworkInterfaceReference(id=nic.id, primary=True)]
            ),
        )

        compute.virtual_machines.begin_create_or_update(
            payload.resource_group, payload.name, vm_params
        ).result()

    except Exception:
        pass  # errors logged by Azure SDK; client should poll provisioning_state


# ── Specific routes first (must precede parameterised /{rg}/{vm}) ─────────
#    Includes: /health  /resource-groups  /vnets  /sizes/*  /locations
#              /create  /cost-by-rg
#    Then the /{rg}/{vm}/* sub-routes (connect, schedule, start, stop …)
#    Finally the bare /{rg}/{vm} catch-all.

@router.get("/health")
def azure_health(user: User = Depends(get_current_user)):
    """Check connectivity to all 3 Azure subscriptions."""
    return check_azure_connectivity()


@router.get("/resource-groups")
def list_resource_groups(
    subscription: str = "nonprod",
    user: User = Depends(get_current_user),
):
    """List all resource groups in a subscription."""
    _validate_subscription(subscription)
    try:
        client = get_resource_client(subscription)
        rgs = client.resource_groups.list()
        return [
            {"name": rg.name, "location": rg.location, "tags": rg.tags or {}}
            for rg in rgs
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vnets")
def list_vnets(
    subscription: str = "connectivity",
    resource_group: Optional[str] = None,
    user: User = Depends(get_current_user),
):
    """
    List VNets — defaults to Connectivity subscription (hub networking).
    Network resources live in Connectivity; VMs deploy to prod/nonprod.
    """
    _validate_subscription(subscription)
    try:
        client = get_network_client(subscription)
        vnets = client.virtual_networks.list(resource_group) if resource_group else client.virtual_networks.list_all()
        return [
            {
                "id":             v.id,
                "name":           v.name,
                "location":       v.location,
                "address_space":  v.address_space.address_prefixes if v.address_space else [],
                "resource_group": v.id.split("/resourceGroups/")[1].split("/")[0],
                "tags":           v.tags or {},
            }
            for v in vnets
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vnets/{resource_group}/{vnet_name}/subnets")
def list_subnets(
    resource_group: str,
    vnet_name: str,
    subscription: str = "connectivity",
    user: User = Depends(get_current_user),
):
    """List subnets in a VNet (defaults to Connectivity subscription)."""
    _validate_subscription(subscription)
    try:
        client = get_network_client(subscription)
        subnets = client.subnets.list(resource_group, vnet_name)
        return [
            {"id": s.id, "name": s.name, "address_prefix": s.address_prefix}
            for s in subnets
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sizes/{location}")
def list_vm_sizes(
    location: str,
    subscription: str = "nonprod",
    user: User = Depends(get_current_user),
):
    """List available VM sizes in a location."""
    _validate_subscription(subscription)
    try:
        client = get_compute_client(subscription)
        sizes = client.virtual_machine_sizes.list(location)
        return [
            {
                "name":            s.name,
                "vcpus":           s.number_of_cores,
                "memory_mb":       s.memory_in_mb,
                "os_disk_size_mb": s.os_disk_size_in_mb,
            }
            for s in sizes
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/locations")
def list_azure_locations(
    subscription: str = "nonprod",
    user: User = Depends(get_current_user),
):
    """List all available Azure regions for a subscription."""
    _validate_subscription(subscription)
    try:
        from azure.mgmt.resource import SubscriptionClient
        from services.azure_client import _get_credential, _get_subscription_id
        sub_client = SubscriptionClient(_get_credential(subscription))
        locations  = sub_client.subscriptions.list_locations(_get_subscription_id(subscription))
        return [
            {
                "name":         loc.name,
                "display_name": loc.display_name,
                "region_type":  str(loc.metadata.region_type) if loc.metadata else "",
            }
            for loc in locations
            if loc.metadata and str(loc.metadata.region_type) == "Physical"
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cost-by-rg")
def azure_cost_by_rg(
    subscription: str = "nonprod",
    user: User = Depends(get_current_user),
):
    """
    Estimate monthly cost grouped by resource group.
    Uses a built-in size → hourly-price table; running VMs count toward cost,
    deallocated VMs cost $0 compute (disk still billed but omitted here).
    """
    _validate_subscription(subscription)
    try:
        client = get_compute_client(subscription)
        vms    = list(client.virtual_machines.list_all())

        rg_map: dict = {}
        for vm in vms:
            rg = vm.id.split("/resourceGroups/")[1].split("/")[0] if vm.id else "unknown"

            # Lightweight power-state check via instance_view
            try:
                iv      = client.virtual_machines.get(rg, vm.name, expand="instanceView")
                pstate  = "unknown"
                for s in (iv.instance_view.statuses or []):
                    if s.code and s.code.startswith("PowerState/"):
                        pstate = s.code.split("/")[1]
                        break
            except Exception:
                pstate = "unknown"

            size     = vm.hardware_profile.vm_size if vm.hardware_profile else ""
            hourly   = _estimate_price(size) if pstate == "running" else 0.0
            monthly  = round(hourly * 730, 2)

            if rg not in rg_map:
                rg_map[rg] = {"resource_group": rg, "vm_count": 0, "running": 0,
                              "stopped": 0, "monthly_cost_usd": 0.0, "vms": []}
            rg_map[rg]["vm_count"]         += 1
            rg_map[rg]["monthly_cost_usd"] = round(rg_map[rg]["monthly_cost_usd"] + monthly, 2)
            if pstate == "running":
                rg_map[rg]["running"] += 1
            else:
                rg_map[rg]["stopped"] += 1
            rg_map[rg]["vms"].append({
                "name": vm.name, "size": size,
                "power_state": pstate, "monthly_usd": monthly,
            })

        result = sorted(rg_map.values(), key=lambda x: x["monthly_cost_usd"], reverse=True)
        total  = round(sum(r["monthly_cost_usd"] for r in result), 2)
        return {"subscription": subscription, "total_monthly_usd": total, "resource_groups": result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/create")
def create_azure_vm(
    payload: AzureVMCreate,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_operator),
):
    """
    Provision a new Azure VM (async — returns immediately, provisions in background).
    VMs deploy to prod/nonprod subscriptions; subnet_id must reference a VNet
    from the Connectivity (hub) subscription.
    """
    _validate_subscription(payload.subscription)
    if not (payload.os_type == "Linux" and payload.ssh_public_key):
        if not payload.admin_password:
            raise HTTPException(
                status_code=400,
                detail="admin_password is required when SSH key is not provided"
            )

    compute = get_compute_client(payload.subscription)
    network = get_network_client(payload.subscription)
    background_tasks.add_task(_provision_azure_vm, compute, network, payload)
    return {
        "message":      f"VM '{payload.name}' provisioning started",
        "status":       "provisioning",
        "subscription": payload.subscription,
    }


# ── Per-VM sub-routes  /{rg}/{vm}/<action>  ────────────────────────────────
# These MUST be registered before the bare /{rg}/{vm} GET to avoid shadowing.

@router.get("/{resource_group}/{vm_name}/connect")
def get_vm_connect_info(
    resource_group: str,
    vm_name:        str,
    subscription:   str = "nonprod",
    user: User = Depends(get_current_user),
):
    """
    Return SSH / RDP connection details for a specific VM.
    Fetches the attached NIC to resolve public and private IPs.
    """
    _validate_subscription(subscription)
    try:
        compute = get_compute_client(subscription)
        network = get_network_client(subscription)

        vm = compute.virtual_machines.get(resource_group, vm_name, expand="instanceView")

        # Power state
        pstate = "unknown"
        for s in (vm.instance_view.statuses or []):
            if s.code and s.code.startswith("PowerState/"):
                pstate = s.code.split("/")[1]; break

        # NIC → IPs
        public_ip = private_ip = None
        if vm.network_profile and vm.network_profile.network_interfaces:
            nic_id  = vm.network_profile.network_interfaces[0].id or ""
            nic_rg  = nic_id.split("/resourceGroups/")[1].split("/")[0] if "/resourceGroups/" in nic_id else resource_group
            nic_name = nic_id.split("/")[-1]
            try:
                nic = network.network_interfaces.get(nic_rg, nic_name)
                for ipc in (nic.ip_configurations or []):
                    private_ip = ipc.private_ip_address
                    if ipc.public_ip_address:
                        pip_name = ipc.public_ip_address.id.split("/")[-1]
                        pip = network.public_ip_addresses.get(nic_rg, pip_name)
                        public_ip = pip.ip_address
                        break
            except Exception:
                pass

        os_type  = str(vm.storage_profile.os_disk.os_type) if vm.storage_profile and vm.storage_profile.os_disk else "Linux"
        username = vm.os_profile.admin_username if vm.os_profile else "azureuser"
        is_linux = "windows" not in os_type.lower()
        host     = public_ip or private_ip or ""

        return {
            "name":         vm_name,
            "os_type":      os_type,
            "power_state":  pstate,
            "admin_username": username,
            "public_ip":    public_ip,
            "private_ip":   private_ip,
            "port":         22 if is_linux else 3389,
            "ssh_command":  f"ssh {username}@{host}" if is_linux and host else None,
            "rdp_host":     host if not is_linux else None,
            "has_public_ip": public_ip is not None,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{resource_group}/{vm_name}/schedule")
def get_vm_schedule(
    resource_group: str,
    vm_name:        str,
    subscription:   str = "nonprod",
    user: User = Depends(get_current_user),
):
    """Read the auto_start / auto_stop schedule stored in the VM's Azure tags."""
    _validate_subscription(subscription)
    try:
        client = get_compute_client(subscription)
        vm     = client.virtual_machines.get(resource_group, vm_name)
        tags   = vm.tags or {}
        return {
            "auto_start": tags.get("auto_start", ""),
            "auto_stop":  tags.get("auto_stop",  ""),
        }
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/{resource_group}/{vm_name}/schedule")
def set_vm_schedule(
    resource_group: str,
    vm_name:        str,
    payload:        VMSchedule,
    subscription:   str = "nonprod",
    user: User = Depends(require_operator),
):
    """
    Persist auto_start / auto_stop schedule as Azure tags on the VM.
    Pass an empty string "" to clear a schedule.  Null means "leave unchanged".
    """
    _validate_subscription(subscription)
    try:
        client = get_compute_client(subscription)
        vm     = client.virtual_machines.get(resource_group, vm_name)
        tags   = dict(vm.tags or {})

        if payload.auto_start is not None:
            if payload.auto_start:
                tags["auto_start"] = payload.auto_start
            else:
                tags.pop("auto_start", None)

        if payload.auto_stop is not None:
            if payload.auto_stop:
                tags["auto_stop"] = payload.auto_stop
            else:
                tags.pop("auto_stop", None)

        client.virtual_machines.begin_update(
            resource_group, vm_name, {"tags": tags}
        ).result()

        return {
            "message":    f"Schedule updated for '{vm_name}'",
            "auto_start": tags.get("auto_start", ""),
            "auto_stop":  tags.get("auto_stop",  ""),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Parameterised routes (catch-all — must come last) ─────────────────────

@router.get("")
def list_azure_vms(
    subscription: str = "nonprod",
    resource_group: Optional[str] = None,
    user: User = Depends(get_current_user),
):
    """
    List Azure VMs in a subscription (no per-VM instance_view fetch to avoid N+1).
    power_state is omitted here; use GET /{rg}/{vm} to get live status for a single VM.
    """
    _validate_subscription(subscription)
    try:
        client = get_compute_client(subscription)
        vms = client.virtual_machines.list(resource_group) if resource_group else client.virtual_machines.list_all()
        return {
            "subscription": subscription,
            "vms": [_serialize_vm(vm) for vm in vms],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{resource_group}/{vm_name}")
def get_azure_vm(
    resource_group: str,
    vm_name: str,
    subscription: str = "nonprod",
    user: User = Depends(get_current_user),
):
    """Get details + live power state of a specific Azure VM."""
    _validate_subscription(subscription)
    try:
        client = get_compute_client(subscription)
        vm = client.virtual_machines.get(resource_group, vm_name, expand="instanceView")
        return _serialize_vm(vm)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{resource_group}/{vm_name}/start")
def start_azure_vm(
    resource_group: str,
    vm_name: str,
    background_tasks: BackgroundTasks,
    subscription: str = "nonprod",
    user: User = Depends(require_operator),
):
    """Start an Azure VM (async — returns immediately)."""
    _validate_subscription(subscription)
    try:
        client = get_compute_client(subscription)
        poller = client.virtual_machines.begin_start(resource_group, vm_name)
        background_tasks.add_task(_run_poller, poller)
        background_tasks.add_task(_notify_vm_action, "start", "azure", vm_name, resource_group, user.username)
        return {"message": f"VM '{vm_name}' start initiated", "status": "starting", "subscription": subscription}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{resource_group}/{vm_name}/stop")
def stop_azure_vm(
    resource_group: str,
    vm_name: str,
    background_tasks: BackgroundTasks,
    deallocate: bool = True,
    subscription: str = "nonprod",
    user: User = Depends(require_operator),
):
    """Stop (and optionally deallocate) an Azure VM (async — returns immediately)."""
    _validate_subscription(subscription)
    try:
        client = get_compute_client(subscription)
        poller = (
            client.virtual_machines.begin_deallocate(resource_group, vm_name)
            if deallocate
            else client.virtual_machines.begin_power_off(resource_group, vm_name)
        )
        background_tasks.add_task(_run_poller, poller)
        background_tasks.add_task(_notify_vm_action, "stop", "azure", vm_name, resource_group, user.username)
        action = "deallocation" if deallocate else "shutdown"
        return {"message": f"VM '{vm_name}' {action} initiated", "status": "stopping", "subscription": subscription}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{resource_group}/{vm_name}/restart")
def restart_azure_vm(
    resource_group: str,
    vm_name: str,
    background_tasks: BackgroundTasks,
    subscription: str = "nonprod",
    user: User = Depends(require_operator),
):
    """Restart an Azure VM (async — returns immediately)."""
    _validate_subscription(subscription)
    try:
        client = get_compute_client(subscription)
        poller = client.virtual_machines.begin_restart(resource_group, vm_name)
        background_tasks.add_task(_run_poller, poller)
        background_tasks.add_task(_notify_vm_action, "restart", "azure", vm_name, resource_group, user.username)
        return {"message": f"VM '{vm_name}' restart initiated", "status": "restarting", "subscription": subscription}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{resource_group}/{vm_name}")
def delete_azure_vm(
    resource_group: str,
    vm_name: str,
    background_tasks: BackgroundTasks,
    subscription: str = "nonprod",
    user: User = Depends(require_operator),
):
    """
    Delete an Azure VM and clean up its NIC, public IP, and OS disk (async).
    Collects associated resource IDs before deletion, then runs cleanup after VM is gone.
    """
    _validate_subscription(subscription)
    try:
        compute = get_compute_client(subscription)
        network = get_network_client(subscription)

        # Collect resource references before the VM is deleted
        vm = compute.virtual_machines.get(resource_group, vm_name)
        nic_ids = [ni.id for ni in vm.network_profile.network_interfaces] if vm.network_profile else []
        os_disk_name = vm.storage_profile.os_disk.name if vm.storage_profile and vm.storage_profile.os_disk else None

        poller = compute.virtual_machines.begin_delete(resource_group, vm_name)
        background_tasks.add_task(_delete_vm_and_cleanup, compute, network, poller, resource_group, nic_ids, os_disk_name)
        background_tasks.add_task(_notify_vm_action, "delete", "azure", vm_name, resource_group, user.username)

        return {"message": f"VM '{vm_name}' deletion started (NIC, public IP and OS disk will be cleaned up automatically)", "status": "deleting", "subscription": subscription}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Notification helper ───────────────────────────────────────────────────────

def _notify_vm_action(action: str, cloud: str, vm_name: str, region: str, actor: str):
    try:
        from services.notification_service import notify_vm_action
        from database import SessionLocal
        _db = SessionLocal()
        notify_vm_action(_db, action=action, cloud=cloud, vm_name=vm_name,
                         region=region, actor_username=actor)
        _db.close()
    except Exception as e:
        print(f"[Notify] azure vm action error: {e}")

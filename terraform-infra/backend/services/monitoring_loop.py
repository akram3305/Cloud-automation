# -*- coding: utf-8 -*-
"""
services/monitoring_loop.py — AIonOS Platform
Background logic for:
  - VM utilization checks (every 30 min)
  - Budget threshold alerts (every hour)
"""
from datetime import datetime, timedelta
from database import SessionLocal
from models.budget import BudgetConfig, BudgetAlertLog
from models.vm_utilization import VMUtilization
from services.email_service import send_email


# ── Utilization ───────────────────────────────────────────────────────────────

def run_utilization_check():
    """Collect CPU metrics for all VMs, persist to DB, email owners for idle/underutilized."""
    print("[Monitor] Running utilization check...")
    from services import utilization_service

    db = SessionLocal()
    try:
        all_vms = (
            utilization_service.get_aws_utilization()
            + utilization_service.get_gcp_utilization()
            + utilization_service.get_azure_utilization()
        )

        now          = datetime.utcnow()
        alert_cutoff = now - timedelta(hours=6)

        # VMs that already got an alert in the last 6 h — skip re-alerting
        recent_alerted = {
            row.vm_id
            for row in db.query(VMUtilization)
            .filter(VMUtilization.alert_sent == True, VMUtilization.checked_at >= alert_cutoff)
            .all()
        }

        from models import User
        admins        = db.query(User).filter(User.role == "admin").all()
        admin_emails  = [u.email for u in admins if u.email]

        for vm in all_vms:
            row = VMUtilization(
                cloud         = vm["cloud"],
                vm_id         = vm["vm_id"],
                vm_name       = vm["vm_name"],
                region        = vm["region"],
                instance_type = vm.get("instance_type", ""),
                owner_email   = vm.get("owner_email", ""),
                avg_cpu_24h   = vm.get("avg_cpu_24h"),
                max_cpu_24h   = vm.get("max_cpu_24h"),
                status        = vm["status"],
                state         = vm["state"],
                alert_sent    = False,
                checked_at    = now,
            )

            if vm["status"] in ("idle", "underutilized") and vm["vm_id"] not in recent_alerted:
                recipients = list(admin_emails)
                owner = vm.get("owner_email", "")
                if owner and "@" in owner:
                    recipients.append(owner)
                recipients = list(set(recipients))
                if recipients:
                    _send_utilization_email(vm, recipients)
                    row.alert_sent = True

            db.add(row)

        db.commit()
        print(f"[Monitor] Saved {len(all_vms)} utilization records")
    except Exception as e:
        print(f"[Monitor] Utilization check error: {e}")
    finally:
        db.close()


def _send_utilization_email(vm: dict, recipients: list):
    cloud_label = {"aws": "AWS EC2", "gcp": "GCP Compute Engine", "azure": "Azure VM"}.get(vm["cloud"], vm["cloud"].upper())
    avg         = vm.get("avg_cpu_24h")
    avg_str     = f"{avg:.1f}%" if avg is not None else "N/A"
    status_str  = "Idle (< 5% avg CPU)" if vm["status"] == "idle" else f"Underutilized ({avg_str} avg CPU — 24 h)"

    html = f"""
<html><body style="font-family:Arial,sans-serif;color:#1e293b;max-width:600px;margin:0 auto">
  <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:24px;border-radius:12px 12px 0 0">
    <h2 style="color:#f59e0b;margin:0">&#9888; VM Underutilization Alert</h2>
    <p style="color:#94a3b8;margin:6px 0 0">AIonOS Platform &mdash; Automated Cost Optimization</p>
  </div>
  <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-radius:0 0 12px 12px">
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px">
      <tr><td style="padding:9px 12px;color:#64748b;width:140px;border-bottom:1px solid #e2e8f0">VM Name</td>
          <td style="padding:9px 12px;font-weight:600;border-bottom:1px solid #e2e8f0">{vm["vm_name"]}</td></tr>
      <tr style="background:#fff"><td style="padding:9px 12px;color:#64748b;border-bottom:1px solid #e2e8f0">Cloud</td>
          <td style="padding:9px 12px;font-weight:600;border-bottom:1px solid #e2e8f0">{cloud_label}</td></tr>
      <tr><td style="padding:9px 12px;color:#64748b;border-bottom:1px solid #e2e8f0">Region / Zone</td>
          <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0">{vm["region"]}</td></tr>
      <tr style="background:#fff"><td style="padding:9px 12px;color:#64748b;border-bottom:1px solid #e2e8f0">Instance Type</td>
          <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0">{vm.get("instance_type","&mdash;")}</td></tr>
      <tr><td style="padding:9px 12px;color:#64748b;border-bottom:1px solid #e2e8f0">Status</td>
          <td style="padding:9px 12px;color:#f59e0b;font-weight:600;border-bottom:1px solid #e2e8f0">{status_str}</td></tr>
    </table>
    <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:16px;margin-bottom:20px">
      <strong style="color:#854d0e">&#128161; Recommended Actions</strong>
      <ul style="margin:8px 0;color:#713f12;padding-left:20px;font-size:13px">
        <li>Stop the VM if it is not actively needed</li>
        <li>Downsize to a smaller instance type to reduce cost</li>
        <li>Configure an auto-stop schedule in the AIonOS Platform</li>
      </ul>
    </div>
    <p style="font-size:11px;color:#94a3b8">Automated alert from AIonOS Platform. Checked at: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}</p>
  </div>
</body></html>
"""
    send_email(
        to      = recipients,
        subject = f"[{vm['cloud'].upper()}] VM Underutilization: {vm['vm_name']} ({avg_str} avg CPU)",
        html    = html,
    )


# ── Budget ────────────────────────────────────────────────────────────────────

def run_budget_check():
    """Compare current month cloud spend against all active budgets and send threshold alerts."""
    print("[Monitor] Running budget check...")
    db = SessionLocal()
    try:
        budgets = db.query(BudgetConfig).filter(BudgetConfig.is_active == True).all()
        if not budgets:
            return

        spend = {"aws": None, "gcp": None, "azure": None}
        for cloud in ("aws", "gcp", "azure"):
            try:
                spend[cloud] = _get_monthly_spend(cloud)
            except Exception as e:
                print(f"[Monitor] Spend fetch error [{cloud}]: {e}")

        all_spend = sum(v for v in spend.values() if v is not None) or 0.0

        from models import User
        admins       = db.query(User).filter(User.role == "admin").all()
        admin_emails = [u.email for u in admins if u.email]

        now = datetime.utcnow()

        for budget in budgets:
            current = all_spend if budget.cloud == "all" else (spend.get(budget.cloud) or 0.0)
            if budget.monthly_limit <= 0:
                continue
            pct = (current / budget.monthly_limit) * 100

            # Find the highest crossed threshold that hasn't been alerted today
            for threshold in (100, 90, 70, 50):
                if threshold == 50  and not budget.alert_50: continue
                if threshold == 70  and not budget.alert_70: continue
                if threshold == 90  and not budget.alert_90: continue
                if pct < threshold: continue

                recent = db.query(BudgetAlertLog).filter(
                    BudgetAlertLog.budget_id == budget.id,
                    BudgetAlertLog.threshold == threshold,
                    BudgetAlertLog.sent_at >= now - timedelta(hours=24),
                ).first()
                if recent:
                    break  # already sent today at this level

                recipients = list(admin_emails)
                for addr in (budget.notify_emails or "").split(","):
                    addr = addr.strip()
                    if addr and "@" in addr:
                        recipients.append(addr)
                recipients = list(set(recipients))

                action_taken = "notified"
                if threshold == 100 and budget.action_100 == "stop":
                    _auto_stop_vms(budget.cloud)
                    action_taken = "stopped"

                if recipients:
                    _send_budget_email(budget, threshold, current, recipients, action_taken)

                db.add(BudgetAlertLog(
                    budget_id     = budget.id,
                    budget_name   = budget.name,
                    cloud         = budget.cloud,
                    threshold     = threshold,
                    current_spend = current,
                    monthly_limit = budget.monthly_limit,
                    action_taken  = action_taken,
                ))
                break  # only send the highest crossed threshold per check

        db.commit()
    except Exception as e:
        print(f"[Monitor] Budget check error: {e}")
    finally:
        db.close()


def _get_monthly_spend(cloud: str) -> float:
    if cloud == "aws":
        import boto3
        from datetime import date
        ce    = boto3.client("ce", region_name="us-east-1")
        today = date.today()
        start = today.replace(day=1).isoformat()
        end   = today.isoformat()
        if start == end:
            return 0.0
        resp = ce.get_cost_and_usage(
            TimePeriod  = {"Start": start, "End": end},
            Granularity = "MONTHLY",
            Metrics     = ["UnblendedCost"],
        )
        results = resp.get("ResultsByTime", [])
        return float(results[0]["Total"]["UnblendedCost"]["Amount"]) if results else 0.0

    if cloud == "gcp":
        from services.gcp_client import CONFIGURED
        if not CONFIGURED:
            return 0.0
        return 0.0  # GCP billing API requires Billing Account — skipped without it

    if cloud == "azure":
        return 0.0  # Azure cost requires ConsumptionManagementClient — skipped without it

    return 0.0


def _send_budget_email(budget, threshold: int, current: float, recipients: list, action_taken: str):
    cloud_label  = {"aws": "AWS", "gcp": "GCP", "azure": "Azure", "all": "All Clouds"}.get(budget.cloud, budget.cloud.upper())
    pct          = (current / budget.monthly_limit) * 100
    bar_color    = "#ef4444" if threshold >= 90 else "#f59e0b" if threshold >= 70 else "#3b82f6"
    bar_width    = min(pct, 100)

    action_html = ""
    if action_taken == "stopped":
        action_html = """
        <div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:16px;margin-bottom:16px">
          <strong style="color:#991b1b">&#9889; Auto-Stop Triggered</strong>
          <p style="color:#7f1d1d;margin:6px 0 0;font-size:13px">
            All running VMs in this cloud have been automatically stopped to prevent further spend.
          </p>
        </div>"""

    html = f"""
<html><body style="font-family:Arial,sans-serif;color:#1e293b;max-width:600px;margin:0 auto">
  <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:24px;border-radius:12px 12px 0 0">
    <h2 style="color:{bar_color};margin:0">&#128176; Budget Alert &mdash; {threshold}% Reached</h2>
    <p style="color:#94a3b8;margin:6px 0 0">AIonOS Platform &mdash; Real-Time Budget Monitoring</p>
  </div>
  <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-radius:0 0 12px 12px">
    {action_html}
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:20px;font-size:13px">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;border-bottom:1px solid #f1f5f9;padding-bottom:8px">
        <span style="color:#64748b">Budget Name</span><strong>{budget.name}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;border-bottom:1px solid #f1f5f9;padding-bottom:8px">
        <span style="color:#64748b">Cloud</span><strong>{cloud_label}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;border-bottom:1px solid #f1f5f9;padding-bottom:8px">
        <span style="color:#64748b">Monthly Limit</span><strong>${budget.monthly_limit:,.2f}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:12px">
        <span style="color:#64748b">Current Spend</span>
        <strong style="color:{bar_color}">${current:,.2f} ({pct:.1f}%)</strong>
      </div>
      <div style="background:#e2e8f0;border-radius:8px;height:14px;overflow:hidden">
        <div style="background:{bar_color};height:100%;width:{bar_width:.1f}%;border-radius:8px"></div>
      </div>
    </div>
    <p style="font-size:11px;color:#94a3b8">Automated alert from AIonOS Platform. Checked at: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}</p>
  </div>
</body></html>
"""
    send_email(
        to      = recipients,
        subject = f"[Budget] {threshold}% of {budget.name} ({cloud_label}) reached — ${current:,.2f} / ${budget.monthly_limit:,.2f}",
        html    = html,
    )


def _auto_stop_vms(cloud: str):
    """Stop all running VMs when budget hits 100% with action=stop."""
    print(f"[Monitor] Auto-stopping {cloud} VMs...")

    if cloud in ("aws", "all"):
        try:
            import boto3
            ec2  = boto3.client("ec2", region_name="ap-south-1")
            resp = ec2.describe_instances(Filters=[{"Name": "instance-state-name", "Values": ["running"]}])
            ids  = [i["InstanceId"] for r in resp["Reservations"] for i in r["Instances"]]
            if ids:
                ec2.stop_instances(InstanceIds=ids)
                print(f"[Monitor] Auto-stopped {len(ids)} AWS instances")
        except Exception as e:
            print(f"[Monitor] Auto-stop AWS error: {e}")

    if cloud in ("gcp", "all"):
        try:
            from services.gcp_client import CONFIGURED
            from services.gcp_client import list_instances, stop_instance
            if CONFIGURED:
                for inst in list_instances(zone="-"):
                    if inst.get("status") == "RUNNING":
                        try:
                            stop_instance(name=inst["name"], zone=inst.get("zone", ""))
                        except Exception:
                            pass
        except Exception as e:
            print(f"[Monitor] Auto-stop GCP error: {e}")

    if cloud in ("azure", "all"):
        try:
            from services.azure_client import get_compute_client
            for sub in ("nonprod", "prod"):
                try:
                    compute = get_compute_client(sub)
                    for vm in list(compute.virtual_machines.list_all()):
                        rg = vm.id.split("/resourceGroups/")[1].split("/")[0]
                        compute.virtual_machines.begin_deallocate(rg, vm.name)
                except Exception:
                    pass
        except Exception as e:
            print(f"[Monitor] Auto-stop Azure error: {e}")

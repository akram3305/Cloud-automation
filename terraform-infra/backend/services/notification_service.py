# -*- coding: utf-8 -*-
"""
services/notification_service.py — AIonOS Platform
Central notification hub. One SMTP config in .env sends all alerts automatically.
Recipients are pulled from the DB — no per-user credentials needed.
"""
from services.email_service import send_email

CLOUD_LABEL = {"aws": "AWS EC2", "gcp": "GCP Compute Engine", "azure": "Azure VM"}
ORG_NAME    = "AIonOS India Pvt Ltd"


# ── DB helpers ────────────────────────────────────────────────────────────────

def _admin_emails(db) -> list:
    from models.user import User
    return [u.email for u in db.query(User).filter(User.role == "admin", User.is_active == True).all()
            if u.email and "@" in u.email]


def _user_email(db, username: str):
    from models.user import User
    u = db.query(User).filter(User.username == username).first()
    return u.email if u and u.email and "@" in u.email else None


def _recipients(db, owner_username=None, extra_emails=None):
    """Collect unique recipient list: owner + all admins + extras."""
    result = set(_admin_emails(db))
    if owner_username:
        e = _user_email(db, owner_username)
        if e:
            result.add(e)
    for e in (extra_emails or []):
        if e and "@" in e:
            result.add(e)
    return list(result)


# ── HTML base template ────────────────────────────────────────────────────────

def _wrap(title: str, color: str, icon: str, body: str) -> str:
    return f"""
<html><body style="font-family:Arial,sans-serif;color:#1e293b;max-width:600px;margin:0 auto;padding:0">
  <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:22px 28px;border-radius:12px 12px 0 0">
    <div style="font-size:18px;font-weight:700;color:{color}">{icon} {title}</div>
    <div style="font-size:12px;color:#94a3b8;margin-top:4px">{ORG_NAME} &mdash; AIonOS Platform</div>
  </div>
  <div style="background:#f8fafc;padding:24px 28px;border:1px solid #e2e8f0;border-radius:0 0 12px 12px">
    {body}
    <div style="margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8">
      Automated notification from AIonOS Platform &mdash; {ORG_NAME}
    </div>
  </div>
</body></html>"""


def _table(rows: list) -> str:
    html = '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">'
    for i, (k, v, color) in enumerate(rows):
        bg = "#fff" if i % 2 else "transparent"
        vc = color or "#1e293b"
        html += f'<tr style="background:{bg}"><td style="padding:8px 12px;color:#64748b;width:140px;border-bottom:1px solid #e2e8f0">{k}</td><td style="padding:8px 12px;font-weight:600;color:{vc};border-bottom:1px solid #e2e8f0">{v}</td></tr>'
    html += "</table>"
    return html


def _action_box(color: str, text: str) -> str:
    return f'<div style="background:{color}15;border:1px solid {color}40;border-radius:8px;padding:14px 16px;font-size:13px;color:{color};margin-bottom:16px">{text}</div>'


# ── 1. VM Created ─────────────────────────────────────────────────────────────

def notify_vm_created(db, *, vm_name, cloud, region, instance_type, creator_username,
                      instance_id=None, public_ip=None):
    cloud_label = CLOUD_LABEL.get(cloud, cloud.upper())
    rows = [
        ("VM Name",      vm_name,       "#0f172a"),
        ("Cloud",        cloud_label,   CLOUD_LABEL.get(cloud,"#0f172a") and "#0f172a"),
        ("Region",       region,        None),
        ("Type",         instance_type, None),
        ("Instance ID",  instance_id or "—", "#3b82f6"),
        ("Public IP",    public_ip  or "—", "#00d4aa"),
        ("Created By",   creator_username, "#0f172a"),
    ]
    body = (_action_box("#00d4aa", f"&#10003; Your VM <strong>{vm_name}</strong> has been successfully created and is now running.")
            + _table(rows))
    html = _wrap(f"VM Created: {vm_name}", "#00d4aa", "&#9989;", body)
    to   = _recipients(db, owner_username=creator_username)
    send_email(to, f"[{cloud.upper()}] VM Created: {vm_name} is ready", html)


# ── 2. VM Action (Start / Stop / Delete / Restart) ───────────────────────────

def notify_vm_action(db, *, action, cloud, vm_name, region, actor_username,
                     owner_username=None, instance_id=None):
    colors  = {"start": "#00d4aa", "stop": "#f59e0b", "delete": "#ef4444", "restart": "#3b82f6"}
    icons   = {"start": "&#9654;", "stop": "&#9646;&#9646;", "delete": "&#128465;", "restart": "&#8635;"}
    labels  = {"start": "Started", "stop": "Stopped", "delete": "Deleted", "restart": "Restarted"}
    color   = colors.get(action, "#64748b")
    icon    = icons.get(action, "&#9679;")
    label   = labels.get(action, action.capitalize())
    cloud_l = CLOUD_LABEL.get(cloud, cloud.upper())
    rows = [
        ("VM Name",   vm_name,        "#0f172a"),
        ("Cloud",     cloud_l,        None),
        ("Region",    region or "—",  None),
        ("Action",    label,          color),
        ("Done By",   actor_username, "#0f172a"),
    ]
    if instance_id:
        rows.append(("Instance ID", instance_id, "#3b82f6"))
    note = ""
    if action == "delete":
        note = _action_box("#ef4444", f"VM <strong>{vm_name}</strong> has been permanently deleted.")
    elif action == "stop":
        note = _action_box("#f59e0b", f"VM <strong>{vm_name}</strong> has been stopped. It will not incur compute charges while stopped.")
    body = note + _table(rows)
    html = _wrap(f"VM {label}: {vm_name}", color, icon, body)
    to   = _recipients(db, owner_username=owner_username or actor_username)
    send_email(to, f"[{cloud.upper()}] VM {label}: {vm_name} (by {actor_username})", html)


# ── 3. Schedule Set ───────────────────────────────────────────────────────────

def notify_schedule_set(db, *, vm_name, cloud, owner_username, actor_username,
                        auto_start, auto_stop):
    cloud_l = CLOUD_LABEL.get(cloud, cloud.upper())
    rows = [
        ("VM Name",     vm_name,                     "#0f172a"),
        ("Cloud",       cloud_l,                     None),
        ("Auto Start",  auto_start or "Not set",     "#00d4aa"),
        ("Auto Stop",   auto_stop  or "Not set",     "#f59e0b"),
        ("Set By",      actor_username,               "#0f172a"),
    ]
    body = (_action_box("#3b82f6", f"A schedule has been configured for VM <strong>{vm_name}</strong>.") + _table(rows))
    html = _wrap(f"Schedule Set: {vm_name}", "#3b82f6", "&#128197;", body)
    to   = _recipients(db, owner_username=owner_username)
    send_email(to, f"[{cloud.upper()}] Schedule set for VM: {vm_name}", html)


# ── 4. Schedule Triggered (success) ──────────────────────────────────────────

def notify_schedule_triggered(db, *, action, vm_name, cloud, region, schedule_time):
    color   = "#00d4aa" if action == "start" else "#f59e0b"
    label   = "Auto-Started" if action == "start" else "Auto-Stopped"
    cloud_l = CLOUD_LABEL.get(cloud, cloud.upper())
    rows = [
        ("VM Name",        vm_name,       "#0f172a"),
        ("Cloud",          cloud_l,       None),
        ("Region",         region or "—", None),
        ("Action",         label,         color),
        ("Scheduled Time", schedule_time, "#3b82f6"),
    ]
    body = (_action_box(color, f"Scheduled action <strong>{label}</strong> completed successfully for VM <strong>{vm_name}</strong>.")
            + _table(rows))
    html = _wrap(f"Scheduled {label}: {vm_name}", color, "&#128197;", body)
    to   = _admin_emails(db)
    send_email(to, f"[{cloud.upper()}] Scheduled {label}: {vm_name} at {schedule_time}", html)


# ── 5. Schedule Failed ────────────────────────────────────────────────────────

def notify_schedule_failed(db, *, action, vm_name, cloud, region, schedule_time, error):
    label   = "Auto-Start" if action == "start" else "Auto-Stop"
    cloud_l = CLOUD_LABEL.get(cloud, cloud.upper())
    rows = [
        ("VM Name",        vm_name,       "#0f172a"),
        ("Cloud",          cloud_l,       None),
        ("Region",         region or "—", None),
        ("Failed Action",  label,         "#ef4444"),
        ("Scheduled Time", schedule_time, "#3b82f6"),
        ("Error",          error[:200],   "#ef4444"),
    ]
    body = (_action_box("#ef4444", f"&#9888; Scheduled action <strong>{label}</strong> FAILED for VM <strong>{vm_name}</strong>. Immediate attention required.")
            + _table(rows))
    html = _wrap(f"Schedule FAILED: {vm_name}", "#ef4444", "&#10060;", body)
    to   = _admin_emails(db)
    send_email(to, f"[ALERT] Schedule {label} FAILED: {vm_name} ({cloud.upper()})", html)


# ── 6. Request Submitted ──────────────────────────────────────────────────────

def notify_request_submitted(db, *, req_id, resource_name, resource_type, cloud, username):
    cloud_l = CLOUD_LABEL.get(cloud, cloud.upper())
    rows = [
        ("Request ID",     f"#{req_id}",    "#3b82f6"),
        ("Resource Name",  resource_name,   "#0f172a"),
        ("Resource Type",  resource_type,   None),
        ("Cloud",          cloud_l,         None),
        ("Requested By",   username,        "#0f172a"),
        ("Status",         "Pending Approval", "#f59e0b"),
    ]
    body = (_action_box("#f59e0b", f"Your request to create <strong>{resource_name}</strong> has been submitted and is awaiting admin approval.")
            + _table(rows))
    html = _wrap(f"Request Submitted: {resource_name}", "#f59e0b", "&#128203;", body)
    to   = _recipients(db, owner_username=username)
    send_email(to, f"[{cloud.upper()}] Request #{req_id} submitted: {resource_name} (pending approval)", html)


# ── 7. Request Approved ───────────────────────────────────────────────────────

def notify_request_approved(db, *, req_id, resource_name, username, approved_by):
    rows = [
        ("Request ID",   f"#{req_id}",  "#3b82f6"),
        ("Resource",     resource_name, "#0f172a"),
        ("Approved By",  approved_by,   "#00d4aa"),
        ("Status",       "Provisioning started", "#00d4aa"),
    ]
    body = (_action_box("#00d4aa", f"Your request for <strong>{resource_name}</strong> has been approved by <strong>{approved_by}</strong>. Provisioning has started.")
            + _table(rows))
    html = _wrap(f"Request Approved: {resource_name}", "#00d4aa", "&#9989;", body)
    e    = _user_email(db, username)
    if e:
        send_email([e], f"[Approved] Your request for {resource_name} is being provisioned", html)


# ── 8. Request Rejected ───────────────────────────────────────────────────────

def notify_request_rejected(db, *, req_id, resource_name, username, reason, rejected_by):
    rows = [
        ("Request ID",   f"#{req_id}",  "#3b82f6"),
        ("Resource",     resource_name, "#0f172a"),
        ("Rejected By",  rejected_by,   "#ef4444"),
        ("Reason",       reason or "No reason provided", "#ef4444"),
    ]
    body = (_action_box("#ef4444", f"Your request for <strong>{resource_name}</strong> has been rejected.")
            + _table(rows))
    html = _wrap(f"Request Rejected: {resource_name}", "#ef4444", "&#10060;", body)
    e    = _user_email(db, username)
    if e:
        send_email([e], f"[Rejected] Your request for {resource_name} was rejected", html)


# ── 9. Request Completed (VM is live) ─────────────────────────────────────────

def notify_request_completed(db, *, req_id, resource_name, resource_type, cloud,
                              username, public_ip=None, instance_id=None):
    cloud_l = CLOUD_LABEL.get(cloud, cloud.upper())
    rows = [
        ("Request ID",    f"#{req_id}",          "#3b82f6"),
        ("Resource Name", resource_name,          "#0f172a"),
        ("Cloud",         cloud_l,               None),
        ("Instance ID",   instance_id or "—",    "#3b82f6"),
        ("Public IP",     public_ip  or "—",     "#00d4aa"),
        ("Status",        "Live & Running",       "#00d4aa"),
    ]
    body = (_action_box("#00d4aa", f"Your <strong>{resource_type}</strong> <strong>{resource_name}</strong> has been successfully provisioned and is now live!")
            + _table(rows))
    html = _wrap(f"Resource Ready: {resource_name}", "#00d4aa", "&#127881;", body)
    to   = _recipients(db, owner_username=username)
    send_email(to, f"[{cloud.upper()}] {resource_name} is live! Your resource is ready", html)


# ── 10. Request Failed ────────────────────────────────────────────────────────

def notify_request_failed(db, *, req_id, resource_name, username, error):
    rows = [
        ("Request ID", f"#{req_id}",  "#3b82f6"),
        ("Resource",   resource_name, "#0f172a"),
        ("Error",      error[:300],   "#ef4444"),
    ]
    body = (_action_box("#ef4444", f"Provisioning of <strong>{resource_name}</strong> failed. Admin has been notified.")
            + _table(rows))
    html = _wrap(f"Provisioning Failed: {resource_name}", "#ef4444", "&#10060;", body)
    to   = _recipients(db, owner_username=username)
    send_email(to, f"[FAILED] Provisioning of {resource_name} failed (Request #{req_id})", html)


# ── 11. VM Budget Alert ────────────────────────────────────────────────────────

def notify_vm_budget_alert(*, vm_name, cloud, instance_type, region,
                           threshold, current_cost, monthly_budget,
                           action_taken, recipients):
    pct     = (current_cost / monthly_budget * 100) if monthly_budget > 0 else 0
    color   = "#ef4444" if threshold >= 100 else "#f97316" if threshold >= 90 else "#f59e0b"
    cloud_l = CLOUD_LABEL.get(cloud, cloud.upper())
    bar_w   = min(pct, 100)
    action_html = ""
    if action_taken == "stopped":
        action_html = _action_box("#ef4444", f"&#9889; VM <strong>{vm_name}</strong> has been automatically stopped to prevent further costs.")
    rows = [
        ("VM Name",        vm_name,                         "#0f172a"),
        ("Cloud",          cloud_l,                         None),
        ("Region",         region or "—",                   None),
        ("Instance Type",  instance_type or "—",            None),
        ("Monthly Budget", f"${monthly_budget:,.2f}",       "#0f172a"),
        ("Current Cost",   f"${current_cost:,.2f} ({pct:.1f}%)", color),
    ]
    body = (action_html + _table(rows)
            + f'<div style="background:#e2e8f0;border-radius:8px;height:12px;overflow:hidden;margin-bottom:16px">'
            f'<div style="background:{color};height:100%;width:{bar_w:.1f}%;border-radius:8px"></div></div>'
            + _action_box(color, "Recommended: Stop or resize this VM to stay within budget."))
    html = _wrap(f"VM Budget {threshold}%: {vm_name}", color, "&#128176;", body)
    send_email(recipients, f"[Budget {threshold}%] {vm_name} ({cloud.upper()}) — ${current_cost:.2f} / ${monthly_budget:.2f}", html)

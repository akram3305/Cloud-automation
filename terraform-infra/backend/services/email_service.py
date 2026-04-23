# -*- coding: utf-8 -*-
"""
services/email_service.py — AIonOS Platform
SMTP email sender. Configure via SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS in .env
"""
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Union


def send_email(to: Union[str, List[str]], subject: str, html: str) -> bool:
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    from_addr = os.getenv("SMTP_FROM", smtp_user)

    if not smtp_host or not smtp_user:
        print(f"[Email] Not configured — skipping: {subject}")
        return False

    recipients = [to] if isinstance(to, str) else list(to)
    recipients  = [r for r in recipients if r and "@" in r]
    if not recipients:
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = from_addr
    msg["To"]      = ", ".join(recipients)
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as srv:
            srv.ehlo()
            srv.starttls()
            srv.login(smtp_user, smtp_pass)
            srv.sendmail(from_addr, recipients, msg.as_string())
        print(f"[Email] Sent to {recipients}: {subject}")
        return True
    except Exception as e:
        print(f"[Email] Send error: {e}")
        return False

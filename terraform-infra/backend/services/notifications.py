"""
Notification service — Slack webhook.
All functions are safe to call even if SLACK_WEBHOOK_URL is not set.
"""
import requests
import config


def notify_slack(message: str) -> bool:
    """
    Post a message to the configured Slack channel.
    Returns True on success, False if webhook URL is not configured or call fails.
    """
    if not config.SLACK_WEBHOOK_URL:
        return False
    try:
        resp = requests.post(
            config.SLACK_WEBHOOK_URL,
            json={"text": message},
            timeout=5,
        )
        return resp.status_code == 200
    except Exception:
        return False

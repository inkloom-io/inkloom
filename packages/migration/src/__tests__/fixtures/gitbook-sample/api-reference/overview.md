---
title: API Overview
description: Overview of the Acme REST API
---

# API Overview

The Acme REST API provides full access to all platform features.

## Base URL

```
https://api.acme.io/v2
```

{% hint style="info" %}
All API endpoints require authentication via API key or OAuth token.
{% endhint %}

## Response Format

All responses are JSON:

```json
{
  "data": {},
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-01-15T10:00:00Z"
  }
}
```

| Status Code | Description |
|------------|-------------|
| 200 | Success |
| 400 | Bad Request |
| 401 | Unauthorized |
| 404 | Not Found |
| 429 | Rate Limited |
| 500 | Server Error |

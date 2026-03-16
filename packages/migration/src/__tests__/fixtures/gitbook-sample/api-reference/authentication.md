---
title: Authentication
description: API authentication methods
---

# Authentication

Authenticate your API requests using one of the supported methods.

{% tabs %}
{% tab title="API Key" %}
Include your API key in the `Authorization` header:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.acme.io/v2/projects
```
{% endtab %}
{% tab title="OAuth Token" %}
Use an OAuth access token for user-scoped requests:

```bash
curl -H "Authorization: Bearer OAUTH_TOKEN" \
  https://api.acme.io/v2/user/projects
```
{% endtab %}
{% endtabs %}

{% hint style="warning" %}
API keys grant full access to your account. Store them securely and never commit them to version control.
{% endhint %}

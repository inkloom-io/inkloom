---
title: API Keys
description: Managing API keys
---

# API Keys

Create and manage API keys for your organization.

## Creating Keys

{% hint style="info" %}
Only organization admins can create API keys.
{% endhint %}

```javascript
const key = await acme.apiKeys.create({
  name: "Production Key",
  scopes: ["read:projects", "write:data"],
});
```

## Key Permissions

<details>
<summary>Available Scopes</summary>

- `read:projects` — Read project data
- `write:projects` — Create and update projects
- `read:data` — Read stored data
- `write:data` — Write and delete data
- `admin` — Full administrative access

</details>

{% hint style="danger" %}
Rotate your API keys regularly and revoke any compromised keys immediately.
{% endhint %}

![Key management dashboard](.gitbook/assets/key-management.png)

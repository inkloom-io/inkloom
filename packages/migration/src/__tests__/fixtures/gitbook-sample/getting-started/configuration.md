---
title: Configuration
description: Configuring the Acme SDK
---

# Configuration

Configure Acme SDK with your project settings.

{% code title="acme.config.js" %}
```javascript
export default {
  projectId: "your-project-id",
  apiKey: process.env.ACME_API_KEY,
  theme: {
    primaryColor: "#2563EB",
  },
};
```
{% endcode %}

<details>
<summary>Environment Variables</summary>

You can configure Acme using environment variables:

| Variable | Description | Required |
|----------|------------|----------|
| `ACME_API_KEY` | Your API key | Yes |
| `ACME_PROJECT_ID` | Project identifier | Yes |
| `ACME_DEBUG` | Enable debug mode | No |

</details>

<details>
<summary>Advanced Configuration</summary>

For advanced use cases, you can pass additional options:

```javascript
const client = new Acme({
  timeout: 30000,
  retries: 3,
  logging: true,
});
```

</details>

{% embed url="https://www.youtube.com/watch?v=example-config" %}

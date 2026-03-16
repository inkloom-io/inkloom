---
title: Custom Plugins
description: Building custom plugins for Acme
---

# Custom Plugins

Extend Acme with custom plugins to add new functionality.

{% code title="my-plugin.js" %}
```javascript
export function myPlugin(options) {
  return {
    name: "my-plugin",
    setup(app) {
      app.on("build", () => {
        console.log("Building with custom plugin...");
      });
    },
  };
}
```
{% endcode %}

{% hint style="info" %}
Plugins are loaded during initialization and cannot be added at runtime.
{% endhint %}

{% embed url="https://github.com/acme/plugin-examples" %}

## Plugin Lifecycle

1. **Register** — Plugin is registered with the app
2. **Initialize** — Setup hooks are called
3. **Execute** — Plugin code runs on events
4. **Teardown** — Cleanup on shutdown

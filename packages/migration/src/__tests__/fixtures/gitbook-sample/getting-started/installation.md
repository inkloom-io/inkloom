---
title: Installation
description: How to install the Acme SDK
---

# Installation

Install Acme SDK using your preferred package manager.

{% tabs %}
{% tab title="npm" %}
```bash
npm install @acme/sdk
```
{% endtab %}
{% tab title="yarn" %}
```bash
yarn add @acme/sdk
```
{% endtab %}
{% tab title="pnpm" %}
```bash
pnpm add @acme/sdk
```
{% endtab %}
{% endtabs %}

## Verify Installation

```javascript
import { Acme } from "@acme/sdk";
console.log(Acme.version);
```

{% hint style="info" %}
Make sure your `package.json` has `"type": "module"` for ESM support.
{% endhint %}

---
title: Showcase
description: Demonstrates all supported GitBook patterns
---

# Pattern Showcase

This page demonstrates every supported GitBook import pattern.

## Stepper

{% stepper %}
{% step %}
### Install the CLI
Run `npm install -g acme-cli` to install.
{% endstep %}
{% step %}
### Configure your project
Create `acme.config.js` in your project root.

```javascript
module.exports = { projectId: "abc" };
```
{% endstep %}
{% step %}
Just some content without a heading.
{% endstep %}
{% endstepper %}

## Columns

{% columns %}
{% column %}
### Left Column

This is the left side with a paragraph.
{% endcolumn %}
{% column %}
### Right Column

This is the right side with a list:

- Item A
- Item B
{% endcolumn %}
{% endcolumns %}

## Content References

{% content-ref url="welcome" %}
[Welcome Guide](welcome)
{% endcontent-ref %}

{% content-ref url="./" %}
[.](./)
{% endcontent-ref %}

## Figures

<figure><img src="../.gitbook/assets/welcome-banner.png" alt="banner alt"><figcaption><p>Welcome banner caption</p></figcaption></figure>

<figure><img src="../.gitbook/assets/logo.png" alt="logo alt"></figure>

## Card View Table

<table data-view="cards"><thead><tr><th></th><th></th><th data-hidden data-card-cover data-type="image">Cover</th></tr></thead><tbody><tr><td>Getting Started</td><td>Learn the basics</td><td></td></tr><tr><td>Advanced Usage</td><td>Go deeper</td><td></td></tr></tbody></table>

## Inline Badge

Use the <mark style="color:green;">POST</mark> method to create resources and <mark style="color:red;">DELETE</mark> to remove them.

## Inline Icon

Click the <Icon icon="flag" size={32} /> flag icon or the <Icon icon="star" /> star to bookmark.

export interface RequestConfig {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

export function generateCurl(config: RequestConfig): string {
  const parts: string[] = [`curl -X ${config.method.toUpperCase()}`];
  parts.push(`  '${config.url}'`);

  for (const [key, value] of Object.entries(config.headers)) {
    parts.push(`  -H '${key}: ${value}'`);
  }

  if (config.body && !["GET", "HEAD"].includes(config.method.toUpperCase())) {
    parts.push(`  -d '${config.body}'`);
  }

  return parts.join(" \\\n");
}

export function generateJavaScript(config: RequestConfig): string {
  const lines: string[] = [];
  const hasBody =
    config.body && !["GET", "HEAD"].includes(config.method.toUpperCase());

  lines.push(`const response = await fetch('${config.url}', {`);
  lines.push(`  method: '${config.method.toUpperCase()}',`);

  if (Object.keys(config.headers).length > 0) {
    lines.push(`  headers: {`);
    for (const [key, value] of Object.entries(config.headers)) {
      lines.push(`    '${key}': '${value}',`);
    }
    lines.push(`  },`);
  }

  if (hasBody) {
    lines.push(`  body: JSON.stringify(${formatJsonIndented(config.body!, 2)}),`);
  }

  lines.push(`});`);
  lines.push(``);
  lines.push(`const data = await response.json();`);
  lines.push(`console.log(data);`);

  return lines.join("\n");
}

export function generatePython(config: RequestConfig): string {
  const lines: string[] = [];
  lines.push(`import requests`);
  lines.push(``);

  const hasBody =
    config.body && !["GET", "HEAD"].includes(config.method.toUpperCase());

  if (Object.keys(config.headers).length > 0) {
    lines.push(`headers = {`);
    for (const [key, value] of Object.entries(config.headers)) {
      lines.push(`    "${key}": "${value}",`);
    }
    lines.push(`}`);
    lines.push(``);
  }

  if (hasBody) {
    lines.push(`payload = ${formatJsonIndented(config.body!, 0)}`);
    lines.push(``);
  }

  const method = config.method.toLowerCase();
  const args: string[] = [`"${config.url}"`];
  if (Object.keys(config.headers).length > 0) {
    args.push(`headers=headers`);
  }
  if (hasBody) {
    args.push(`json=payload`);
  }

  lines.push(`response = requests.${method}(`);
  for (let i = 0; i < args.length; i++) {
    const comma = i < args.length - 1 ? "," : "";
    lines.push(`    ${args[i]}${comma}`);
  }
  lines.push(`)`);
  lines.push(``);
  lines.push(`print(response.json())`);

  return lines.join("\n");
}

function formatJsonIndented(jsonStr: string, baseIndent: number): string {
  try {
    const parsed = JSON.parse(jsonStr);
    const formatted = JSON.stringify(parsed, null, 2);
    if (baseIndent === 0) return formatted;
    const indent = " ".repeat(baseIndent);
    return formatted
      .split("\n")
      .map((line, i) => (i === 0 ? line : indent + line))
      .join("\n");
  } catch {
    return jsonStr;
  }
}

// Pure helpers for task links (safe on server and client).

export type LinkKind = "jira" | "gitlab" | "github" | "other";

export interface LinkInfo {
  kind: LinkKind;
  /** Short display text, e.g. "ABC-123", "!42", "#7" or the host. */
  short: string;
  host: string;
}

/** Only http(s) URLs are allowed (blocks javascript:, data:, etc.). Returns the normalised URL or null. */
export function safeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function describeLink(raw: string): LinkInfo {
  const url = safeUrl(raw);
  if (!url) return { kind: "other", short: raw, host: "" };
  const u = new URL(url);
  const host = u.hostname.replace(/^www\./, "");
  const path = u.pathname;

  const jira = path.match(/\/browse\/([A-Z][A-Z0-9_]+-\d+)/i) ?? u.search.match(/selectedIssue=([A-Z][A-Z0-9_]+-\d+)/i);
  if (jira || /atlassian\.net$|jira/i.test(host)) return { kind: "jira", short: jira?.[1].toUpperCase() ?? host, host };

  const mr = path.match(/\/-\/merge_requests\/(\d+)/);
  if (mr || /gitlab/i.test(host)) return { kind: "gitlab", short: mr ? `!${mr[1]}` : host, host };

  const gh = path.match(/\/(pull|issues)\/(\d+)/);
  if (host === "github.com") return { kind: "github", short: gh ? `#${gh[2]}` : path.split("/").slice(1, 3).join("/") || host, host };

  return { kind: "other", short: host, host };
}

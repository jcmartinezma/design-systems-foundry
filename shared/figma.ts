export function fileKeyFromUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9]{10,}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const branchAt = parts.indexOf("branch");
    if (branchAt >= 0 && parts[branchAt + 1]) return parts[branchAt + 1]!;
    const marker = parts.findIndex((part) => part === "file" || part === "design");
    if (marker >= 0 && parts[marker + 1]) return parts[marker + 1]!;
  } catch {
    return null;
  }

  return null;
}

export function explainFigmaError(status: number, message: string): string {
  if (status === 401) {
    return "The token is invalid or has expired. Create another one in Figma → Settings → Security.";
  }
  if (status === 404) {
    return "That file could not be found. Check the link and that the token can see it.";
  }
  if (status === 403) {
    if (/plan/i.test(message)) {
      return "The variables API only works on Figma’s Enterprise plan. Use the local plugin: it does not need that plan.";
    }
    if (/account/i.test(message)) {
      return "This account does not have a Full seat in an Enterprise organization. Use the local plugin.";
    }
    if (/scope/i.test(message)) {
      return "The variables REST API is Enterprise only. On a Professional plan Figma rejects the token as if file_variables:read and file_variables:write were missing, because those scopes cannot be enabled outside Enterprise. Use the local plugin. If your organization is already Enterprise, create the token again and enable those two scopes.";
    }
    if (/permission/i.test(message)) {
      return "You do not have edit access to that Figma file.";
    }
    return `Figma rejected the request (${message}). If you are not on Enterprise, use the local plugin.`;
  }
  return message || `Figma responded with error ${status}.`;
}

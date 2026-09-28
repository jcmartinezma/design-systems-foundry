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
    return "El token no es válido o ha caducado. Genera otro en Figma → Settings → Security.";
  }
  if (status === 404) {
    return "No encuentro ese archivo. Revisa el enlace y que el token pueda verlo.";
  }
  if (status === 403) {
    if (/plan/i.test(message)) {
      return "La API de variables solo funciona en el plan Enterprise de Figma. Usa el plugin local: no necesita ese plan.";
    }
    if (/account/i.test(message)) {
      return "Esta cuenta no tiene un asiento Full de una organización Enterprise. Usa el plugin local.";
    }
    if (/scope/i.test(message)) {
      return "Al token le faltan los permisos file_variables:read y file_variables:write.";
    }
    if (/permission/i.test(message)) {
      return "No tienes permiso de edición en ese archivo de Figma.";
    }
    return `Figma ha rechazado la petición (${message}). Si no estás en Enterprise, usa el plugin local.`;
  }
  return message || `Figma ha respondido con el error ${status}.`;
}

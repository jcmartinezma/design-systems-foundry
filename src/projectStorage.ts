import { createDefaultProject, normalizeProject } from "../shared/project";
import type { Project } from "../shared/types";

const STORAGE_KEY = "foundry.project";

export function readStoredProject(): Project {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultProject();
    return normalizeProject(JSON.parse(raw) as unknown);
  } catch {
    return createDefaultProject();
  }
}

export function writeStoredProject(project: Project): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
}

export function clearStoredProject(): void {
  localStorage.removeItem(STORAGE_KEY);
}

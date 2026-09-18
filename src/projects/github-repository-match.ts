import type {
  ProjectForgeGitHubRepository,
  ProjectForgeRepository,
} from "./model.js";

export function normalizedGitHubRepositoryUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.hostname.toLowerCase() !== "github.com") return "";
    return `${url.hostname.toLowerCase()}${url.pathname
      .replace(/\.git$/iu, "")
      .replace(/\/+$/u, "")
      .toLowerCase()}`;
  } catch {
    return "";
  }
}

export function repositoryMatchesGitHubAnnouncement(
  repository: ProjectForgeRepository,
  providerRepository: ProjectForgeGitHubRepository,
): boolean {
  const clone = normalizedGitHubRepositoryUrl(providerRepository.clone_url);
  const web = normalizedGitHubRepositoryUrl(providerRepository.html_url);
  return (
    clone !== "" &&
    web !== "" &&
    repository.cloneUrls.some(
      (value) => normalizedGitHubRepositoryUrl(value) === clone,
    ) &&
    repository.webUrls.some(
      (value) => normalizedGitHubRepositoryUrl(value) === web,
    )
  );
}

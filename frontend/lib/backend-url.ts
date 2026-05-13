const DEFAULT_BACKEND_URL = "http://localhost:4000"

function normalizeBackendUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url
}

export function getBackendBaseUrl(): string {
  const explicitUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.trim()

  if (explicitUrl) {
    return normalizeBackendUrl(explicitUrl)
  }

  if (typeof window !== "undefined") {
    return ""
  }

  const renderUrl = process.env.RENDER_EXTERNAL_URL?.trim()

  if (renderUrl) {
    return normalizeBackendUrl(renderUrl)
  }

  return DEFAULT_BACKEND_URL
}

export function resolveBackendAssetUrl(url: string): string {
  const trimmedUrl = url.trim()

  if (!trimmedUrl) {
    return ""
  }

  if (
    trimmedUrl.startsWith("http://") ||
    trimmedUrl.startsWith("https://") ||
    trimmedUrl.startsWith("data:")
  ) {
    return trimmedUrl
  }

  if (trimmedUrl.startsWith("/")) {
    return `${getBackendBaseUrl()}${trimmedUrl}`
  }

  return trimmedUrl
}
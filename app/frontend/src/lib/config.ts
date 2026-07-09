// Runtime configuration
let runtimeConfig: {
  API_BASE_URL: string;
  PORTAL_SNAPSHOT_URL?: string;
} | null = null;

// Configuration loading state
let configLoading = true;

function getDefaultConfig() {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const hostname = window.location.hostname;
    const isLocalLike =
      /^(127\.0\.0\.1|localhost|\[::1\]|::1)$/i.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
    return {
      API_BASE_URL: window.location.origin,
      PORTAL_SNAPSHOT_URL: isLocalLike ? `${window.location.origin}/snapshot/latest.json` : undefined,
    };
  }
  return {
    API_BASE_URL: 'http://127.0.0.1:3000',
    PORTAL_SNAPSHOT_URL: 'http://127.0.0.1:3000/snapshot/latest.json',
  };
}

function isLoopbackHost(value: string): boolean {
  return /^(127\.0\.0\.1|localhost|\[::1\]|::1)$/i.test(value.trim());
}

// Function to load runtime configuration
export async function loadRuntimeConfig(): Promise<void> {
  try {
    console.log('🔧 DEBUG: Starting to load runtime config...');
    // Try to load configuration from a config endpoint
    const response = await fetch('/api/config');
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      // Only parse as JSON if the response is actually JSON
      if (contentType && contentType.includes('application/json')) {
        runtimeConfig = await response.json();
        if (typeof window !== 'undefined' && runtimeConfig?.API_BASE_URL) {
          const currentHost = window.location.hostname || '';
          try {
            const configHost = new URL(runtimeConfig.API_BASE_URL).hostname;
            if (!isLoopbackHost(currentHost) && isLoopbackHost(configHost)) {
              runtimeConfig = {
                API_BASE_URL: window.location.origin,
                PORTAL_SNAPSHOT_URL: runtimeConfig.PORTAL_SNAPSHOT_URL,
              };
            }
          } catch {
            runtimeConfig = {
              API_BASE_URL: window.location.origin,
              PORTAL_SNAPSHOT_URL: runtimeConfig.PORTAL_SNAPSHOT_URL,
            };
          }
        }
        console.log('Runtime config loaded successfully');
      } else {
        console.log(
          'Config endpoint returned non-JSON response, skipping runtime config'
        );
      }
    } else {
      console.log(
        '🔧 DEBUG: Config fetch failed with status:',
        response.status
      );
    }
  } catch (error) {
    console.log('Failed to load runtime config, using defaults:', error);
  } finally {
    configLoading = false;
    console.log(
      '🔧 DEBUG: Config loading finished, configLoading set to false'
    );
  }
}

// Get current configuration
export function getConfig() {
  // If config is still loading, return default config to avoid using stale Vite env vars
  if (configLoading) {
    console.log('Config still loading, using default config');
    return getDefaultConfig();
  }

  // First try runtime config (for Lambda)
  if (runtimeConfig) {
    console.log('Using runtime config');
    return runtimeConfig;
  }

  // Then try Vite environment variables (for local development)
  if (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_PORTAL_SNAPSHOT_URL) {
    const viteConfig = {
      API_BASE_URL: import.meta.env.VITE_API_BASE_URL || getDefaultConfig().API_BASE_URL,
      PORTAL_SNAPSHOT_URL: import.meta.env.VITE_PORTAL_SNAPSHOT_URL,
    };
    console.log('Using Vite environment config');
    return viteConfig;
  }

  // Finally fall back to default
  console.log('Using default config');
  return getDefaultConfig();
}

// Dynamic API_BASE_URL getter - this will always return the current config
export function getAPIBaseURL(): string {
  return getConfig().API_BASE_URL;
}

export function getPortalSnapshotURL(): string | undefined {
  return getConfig().PORTAL_SNAPSHOT_URL || getDefaultConfig().PORTAL_SNAPSHOT_URL;
}

// For backward compatibility, but this should be avoided
// Removed static export to prevent using stale config values
// export const API_BASE_URL = getAPIBaseURL();

export const config = {
  get API_BASE_URL() {
    return getAPIBaseURL();
  },
  get PORTAL_SNAPSHOT_URL() {
    return getPortalSnapshotURL();
  },
};

import logoConfig from "@/lib/constants/organization-logos.json";

interface LogoInfo {
  logo: string;
  alt: string;
}

/**
 * Get the logo configuration for an organization by name.
 * Matches against organization name (case-insensitive, partial match).
 * Falls back to default if no match found.
 */
export function getOrganizationLogo(organizationName?: string | null): LogoInfo {
  if (!organizationName) {
    return logoConfig.default;
  }

  const normalizedName = organizationName.toLowerCase().trim();

  // Check for exact or partial match against configured organizations
  for (const [key, value] of Object.entries(logoConfig.organizations)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return value as LogoInfo;
    }
  }

  return logoConfig.default;
}

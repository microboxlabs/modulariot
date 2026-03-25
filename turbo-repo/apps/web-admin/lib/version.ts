import packageJson from '../package.json'

export const version = packageJson.version

export function getVersionBadge() {
  return `${version}`
} 
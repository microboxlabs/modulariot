import { Prisma } from '../generated/client'
import { prisma } from './client'

interface CachedFeatures {
  features: Record<string, any>
  cachedAt: number
}

const featureCache = new Map<string, CachedFeatures>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes in milliseconds

export async function can(orgId: string, featureKey: string): Promise<boolean> {
  const features = await getOrgFeatures(orgId)
  
  // Check if feature exists and is truthy
  return Boolean(features[featureKey])
}

export async function getOrgFeatures(orgId: string): Promise<Record<string, any>> {
  const cached = featureCache.get(orgId)
  const now = Date.now()
  
  // Return cached features if still valid
  if (cached && (now - cached.cachedAt) < CACHE_TTL) {
    return cached.features
  }
  
  try {
    // Fetch organization with active subscription and plan
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        type: true,
        subscriptions: {
          where: { status: 'active' },
          include: { plan: true },
          take: 1
        }
      }
    })
    
    if (!org) {
      throw new Error(`Organization ${orgId} not found`)
    }
    
    // Get features from active subscription plan, fallback to empty object
    const activeSubscription = org.subscriptions[0]
    const planFeatures = activeSubscription?.plan?.features as Record<string, any> || {}
    
    // Merge with organization type default limits
    const typeDefaults = org.type.defaultLimits as Record<string, any> || {}
    
    // Plan features override type defaults
    const features = { ...typeDefaults, ...planFeatures }
    
    // Cache the result
    featureCache.set(orgId, {
      features,
      cachedAt: now
    })
    
    return features
  } catch (error) {
    console.error(`Error fetching features for org ${orgId}:`, error)
    // Return empty features on error
    return {}
  }
}

export async function getOrgLimit(orgId: string, limitKey: string): Promise<number> {
  const features = await getOrgFeatures(orgId)
  const limit = features[limitKey]
  
  // Return the limit as number, default to 0 if not found or not a number
  return typeof limit === 'number' ? limit : 0
}

// TODO: Add helper to check usage against limits
// TODO: Add helper to increment usage counters
// TODO: Add webhook handlers for subscription changes to clear cache
export function clearFeatureCache(orgId?: string): void {
  if (orgId) {
    featureCache.delete(orgId)
  } else {
    featureCache.clear()
  }
}
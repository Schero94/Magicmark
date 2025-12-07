/**
 * License Guard Service
 * Handles license creation, verification, and ping tracking
 */

import type { Core } from '@strapi/strapi';
import crypto from 'crypto';
import os from 'os';
import { readFileSync } from 'fs';
import { join } from 'path';

// Read plugin version from package.json
let pluginVersion = '2.0.0'; // Fallback
try {
  const pkgPath = join(__dirname, '../../../package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  pluginVersion = pkg.version || '2.0.0';
} catch (e) {
  // Use fallback version if package.json can't be read
}

// FIXED LICENSE SERVER URL - DO NOT MODIFY!
// This URL is hardcoded and cannot be overridden for security reasons.
// Any attempt to modify this will break license validation.
const LICENSE_SERVER_URL = 'https://magicapi.fitlex.me';

export interface LicenseData {
  licenseKey: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isExpired: boolean;
  isOnline?: boolean;
  expiresAt?: string;
  lastPingAt?: string;
  deviceName?: string;
  deviceId?: string;
  ipAddress?: string;
  featurePremium?: boolean;
  featureAdvanced?: boolean;
  featureEnterprise?: boolean;
  featureCustom?: boolean;
  maxDevices?: number;
  currentDevices?: number;
}

export interface VerificationResult {
  valid: boolean;
  data: LicenseData | null;
  gracePeriod?: boolean;
}

export interface LicenseStatus {
  valid: boolean;
  demo?: boolean;
  error?: string;
  data?: LicenseData | null;
}

interface ApiResponse {
  success: boolean;
  data?: any;
  message?: string;
}

const licenseGuardService = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Get license server URL (hardcoded and immutable for security)
   * @returns The fixed license server URL - cannot be overridden
   */
  getLicenseServerUrl(): string {
    // Always return the hardcoded URL - no environment variable override allowed
    return LICENSE_SERVER_URL;
  },

  /**
   * Generate a unique device ID based on machine identifiers
   */
  generateDeviceId(): string {
    try {
      const networkInterfaces = os.networkInterfaces();
      const macAddresses: string[] = [];
      
      // Collect MAC addresses
      Object.values(networkInterfaces).forEach(interfaces => {
        interfaces?.forEach(iface => {
          if (iface.mac && iface.mac !== '00:00:00:00:00:00') {
            macAddresses.push(iface.mac);
          }
        });
      });
      
      // Create hash from MAC addresses and hostname
      const identifier = `${macAddresses.join('-')}-${os.hostname()}`;
      return crypto.createHash('sha256').update(identifier).digest('hex').substring(0, 32);
    } catch (error) {
      strapi.log.error('Error generating device ID:', error);
      // Fallback to random ID
      return crypto.randomBytes(16).toString('hex');
    }
  },

  /**
   * Get device name
   */
  getDeviceName(): string {
    try {
      return os.hostname() || 'Unknown Device';
    } catch (error) {
      return 'Unknown Device';
    }
  },

  /**
   * Get server IP address
   */
  getIpAddress(): string {
    try {
      const networkInterfaces = os.networkInterfaces();
      for (const name of Object.keys(networkInterfaces)) {
        const interfaces = networkInterfaces[name];
        if (interfaces) {
          for (const iface of interfaces) {
            // Skip internal and non-IPv4 addresses
            if (iface.family === 'IPv4' && !iface.internal) {
              return iface.address;
            }
          }
        }
      }
      return '127.0.0.1';
    } catch (error) {
      return '127.0.0.1';
    }
  },

  /**
   * Get user agent (server context)
   */
  getUserAgent(): string {
    const strapiVersion = strapi.config.get('info.strapi') || '5.0.0';
    return `MagicMark/${pluginVersion} Strapi/${strapiVersion} Node/${process.version} ${os.platform()}/${os.release()}`;
  },

  /**
   * Create a license
   */
  async createLicense({ email, firstName, lastName }: { email: string; firstName: string; lastName: string }): Promise<LicenseData | null> {
    try {
      const deviceId = this.generateDeviceId();
      const deviceName = this.getDeviceName();
      const ipAddress = this.getIpAddress();
      const userAgent = this.getUserAgent();

      const licenseServerUrl = this.getLicenseServerUrl();
      const response = await fetch(`${licenseServerUrl}/api/licenses/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          deviceName,
          deviceId,
          ipAddress,
          userAgent,
          pluginName: 'magic-mark',
          productName: 'MagicMark - Advanced Query Builder',
        }),
      });

      const data = await response.json() as ApiResponse;

      if (data.success) {
        strapi.log.info('[SUCCESS] License created successfully:', data.data.licenseKey);
        return data.data as LicenseData;
      } else {
        strapi.log.error('[ERROR] License creation failed:', data);
        return null;
      }
    } catch (error) {
      strapi.log.error('[ERROR] Error creating license:', error);
      return null;
    }
  },

  /**
   * Verify a license (with grace period support)
   */
  async verifyLicense(licenseKey: string, allowGracePeriod: boolean = false): Promise<VerificationResult> {
    try {
      // Create timeout for fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const licenseServerUrl = this.getLicenseServerUrl();
      const response = await fetch(`${licenseServerUrl}/api/licenses/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          licenseKey,
          pluginName: 'magic-mark',
          productName: 'MagicMark - Advanced Query Builder',
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      const data = await response.json() as ApiResponse;

      if (data.success) {
        const isValid = data.data.isActive && !data.data.isExpired;
        const statusInfo = data.data.isExpired ? 'EXPIRED' : (data.data.isActive ? 'ACTIVE' : 'INACTIVE');
        strapi.log.info(`[SUCCESS] License verified online: ${statusInfo} (Key: ${licenseKey?.substring(0, 8)}...)`);
        
        // Store last validation timestamp
        if (isValid) {
          const pluginStore = strapi.store({ 
            type: 'plugin', 
            name: 'magic-mark' 
          });
          await pluginStore.set({ key: 'lastValidated', value: new Date().toISOString() });
        }
        
        return {
          valid: isValid,
          data: data.data as LicenseData,
        };
      } else {
        strapi.log.warn(`[WARN] License verification failed: ${data.message || 'Unknown error'} (Key: ${licenseKey?.substring(0, 8)}...)`);
        return { valid: false, data: null };
      }
    } catch (error: any) {
      // If grace period is allowed, accept the key anyway
      if (allowGracePeriod) {
        strapi.log.warn(`[WARN] Cannot verify license online: ${error.message} (Key: ${licenseKey?.substring(0, 8)}...)`);
        strapi.log.info(`[GRACE] Grace period active - accepting stored license key`);
        return { valid: true, data: null, gracePeriod: true };
      }
      
      strapi.log.error(`[ERROR] Error verifying license: ${error.message} (Key: ${licenseKey?.substring(0, 8)}...)`);
      return { valid: false, data: null };
    }
  },

  /**
   * Ping a license (lightweight check)
   */
  async pingLicense(licenseKey: string): Promise<any> {
    try {
      const licenseServerUrl = this.getLicenseServerUrl();
      const response = await fetch(`${licenseServerUrl}/api/licenses/ping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          licenseKey,
          pluginName: 'magic-mark',
          productName: 'MagicMark - Advanced Query Builder',
        }),
      });

      const data = await response.json() as ApiResponse;

      if (data.success) {
        strapi.log.debug(`[PING] License ping successful: ${data.data?.isActive ? 'ACTIVE' : 'INACTIVE'} (Key: ${licenseKey?.substring(0, 8)}...)`);
        return data.data;
      } else {
        strapi.log.debug(`[WARN] License ping failed: ${data.message || 'Unknown error'} (Key: ${licenseKey?.substring(0, 8)}...)`);
        return null;
      }
    } catch (error: any) {
      strapi.log.debug(`License ping error: ${error.message} (Key: ${licenseKey?.substring(0, 8)}...)`);
      return null;
    }
  },

  /**
   * Get license by key
   */
  async getLicenseByKey(licenseKey: string): Promise<LicenseData | null> {
    try {
      const licenseServerUrl = this.getLicenseServerUrl();
      const response = await fetch(`${licenseServerUrl}/api/licenses/key/${licenseKey}`);
      const data = await response.json() as ApiResponse;

      if (data.success) {
        return data.data as LicenseData;
      }
      return null;
    } catch (error) {
      strapi.log.error('[ERROR] Error fetching license by key:', error);
      return null;
    }
  },

  /**
   * Get current license data from store (fetches fresh from server)
   * This is the correct way to get license data with all feature flags
   */
  async getCurrentLicense(): Promise<LicenseData | null> {
    try {
      const pluginStore = strapi.store({ 
        type: 'plugin', 
        name: 'magic-mark' 
      });
      const licenseKey = await pluginStore.get({ key: 'licenseKey' }) as string | undefined;

      if (!licenseKey) {
        return null;
      }

      // Fetch fresh license data from server (includes featurePremium, featureAdvanced, etc.)
      const license = await this.getLicenseByKey(licenseKey);
      return license;
    } catch (error) {
      strapi.log.error('[LICENSE] Error loading current license:', error);
      return null;
    }
  },

  /**
   * Start periodic pinging for a license
   */
  startPinging(licenseKey: string, intervalMinutes: number = 15): NodeJS.Timeout {
    const intervalMs = intervalMinutes * 60 * 1000;
    
    // Immediate ping
    this.pingLicense(licenseKey);
    
    // Setup interval
    const pingInterval = setInterval(async () => {
      await this.pingLicense(licenseKey);
    }, intervalMs);

    strapi.log.info(`[PING] Started pinging license every ${intervalMinutes} minutes`);
    
    return pingInterval;
  },

  /**
   * Initialize license guard
   * Checks for existing license or prompts for creation
   */
  async initialize(): Promise<LicenseStatus> {
    try {
      strapi.log.info('[LICENSE] Initializing License Guard...');

      // Check if license key exists in plugin store
      const pluginStore = strapi.store({ 
        type: 'plugin', 
        name: 'magic-mark' 
      });
      const licenseKey = await pluginStore.get({ key: 'licenseKey' }) as string | undefined;

      // Check last validation timestamp
      const lastValidated = await pluginStore.get({ key: 'lastValidated' }) as string | undefined;
      const now = new Date();
      const gracePeriodHours = 24;
      let withinGracePeriod = false;
      
      if (lastValidated) {
        const lastValidatedDate = new Date(lastValidated);
        const hoursSinceValidation = (now.getTime() - lastValidatedDate.getTime()) / (1000 * 60 * 60);
        withinGracePeriod = hoursSinceValidation < gracePeriodHours;
      }

      strapi.log.info('──────────────────────────────────────────────────────────');
      strapi.log.info(`[STORE] Plugin Store Check:`);
      if (licenseKey) {
        strapi.log.info(`   [OK] License Key found: ${licenseKey}`);
        strapi.log.info(`   [KEY] Key (short): ${licenseKey.substring(0, 8)}...`);
        if (lastValidated) {
          const lastValidatedDate = new Date(lastValidated);
          const hoursAgo = Math.floor((now.getTime() - lastValidatedDate.getTime()) / (1000 * 60 * 60));
          strapi.log.info(`   [TIME] Last validated: ${hoursAgo}h ago (Grace: ${withinGracePeriod ? 'ACTIVE' : 'EXPIRED'})`);
        } else {
          strapi.log.info(`   [TIME] Last validated: Never (Grace: ACTIVE for first ${gracePeriodHours}h)`);
        }
      } else {
        strapi.log.info(`   [NONE] No license key stored`);
      }
      strapi.log.info('──────────────────────────────────────────────────────────');

      if (licenseKey) {
        strapi.log.info('[VERIFY] Verifying stored license key...');
        
        // Always allow grace period during initialization (server might not be ready yet)
        const verification = await this.verifyLicense(licenseKey, true);
        
        if (verification.valid) {
          if (verification.gracePeriod) {
            strapi.log.info('[SUCCESS] License accepted (offline mode / grace period)');
          } else {
            strapi.log.info('[SUCCESS] License is valid and active');
          }
          
          // Start pinging
          const pingInterval = this.startPinging(licenseKey, 15);
          
          // Store interval for cleanup
          (strapi as any).licenseGuard = {
            licenseKey,
            pingInterval,
            data: verification.data,
          };
          
          return { valid: true, data: verification.data };
        } else {
          strapi.log.warn('[WARN] Stored license is invalid or expired');
          // Only clear if we got a definitive rejection (not a network error during grace period)
          if (!withinGracePeriod) {
            await pluginStore.delete({ key: 'licenseKey' });
            await pluginStore.delete({ key: 'lastValidated' });
          }
        }
      }

      strapi.log.warn('[WARN] No valid license found. Plugin will run with limited functionality.');
      
      return { valid: false, demo: true };
    } catch (error: any) {
      strapi.log.error('[ERROR] Error initializing license guard:', error);
      return { valid: false, error: error.message };
    }
  },

  /**
   * Store license key after creation
   */
  async storeLicenseKey(licenseKey: string): Promise<boolean> {
    try {
      strapi.log.info(`[STORE] Storing license key: ${licenseKey}`);
      const pluginStore = strapi.store({ 
        type: 'plugin', 
        name: 'magic-mark' 
      });
      
      await pluginStore.set({ key: 'licenseKey', value: licenseKey });
      // Store initial validation timestamp
      await pluginStore.set({ key: 'lastValidated', value: new Date().toISOString() });
      
      // Verify it was stored
      const stored = await pluginStore.get({ key: 'licenseKey' }) as string | undefined;
      if (stored === licenseKey) {
        strapi.log.info('[SUCCESS] License key stored and verified successfully');
        return true;
      } else {
        strapi.log.error('[ERROR] License key storage verification failed');
        return false;
      }
    } catch (error) {
      strapi.log.error('[ERROR] Error storing license key:', error);
      return false;
    }
  },

  /**
   * Get bookmark limit based on license tier
   * @returns Bookmark limit: 10 (free), 50 (premium), -1 (advanced/unlimited)
   */
  async getBookmarkLimit(): Promise<number> {
    try {
      const licenseGuard = (strapi as any).licenseGuard;
      const licenseData = licenseGuard?.data;
      
      if (licenseData?.featureAdvanced) {
        return -1; // Unlimited
      }
      if (licenseData?.featurePremium) {
        return 50;
      }
      return 10; // Free tier
    } catch (error) {
      strapi.log.debug('[LICENSE] Error getting bookmark limit, using free tier');
      return 10;
    }
  },

  /**
   * Check if user can create more bookmarks
   * @param userId - User's documentId
   * @returns Object with canCreate boolean and current/max counts
   */
  async canCreateBookmark(userId: string): Promise<{ canCreate: boolean; current: number; max: number; message?: string }> {
    try {
      const limit = await this.getBookmarkLimit();
      
      // Unlimited for advanced tier
      if (limit === -1) {
        return { canCreate: true, current: 0, max: -1 };
      }
      
      // Count user's current bookmarks
      const BOOKMARK_UID = 'plugin::magic-mark.bookmark';
      const bookmarks = await strapi.documents(BOOKMARK_UID).findMany({
        filters: { creatorId: userId }
      });
      const currentCount = bookmarks?.length || 0;
      
      if (currentCount >= limit) {
        return {
          canCreate: false,
          current: currentCount,
          max: limit,
          message: `Bookmark limit reached (${currentCount}/${limit}). Upgrade to create more bookmarks.`
        };
      }
      
      return { canCreate: true, current: currentCount, max: limit };
    } catch (error) {
      strapi.log.error('[LICENSE] Error checking bookmark limit:', error);
      // Allow creation on error to not block users
      return { canCreate: true, current: 0, max: 10 };
    }
  },

  /**
   * Get current license limits and feature flags
   * @param userId - User's documentId for bookmark count
   * @returns License limits object
   */
  async getLicenseLimits(userId: string): Promise<{
    maxBookmarks: number;
    currentBookmarks: number;
    canCreate: boolean;
    tier: string;
    features: {
      queryHistory: boolean;
      export: boolean;
      analytics: boolean;
      bulkOperations: boolean;
      customIntegrations: boolean;
    };
  }> {
    try {
      // Get fresh license data from server (like Magic Mail does)
      const license = await this.getCurrentLicense();
      
      // Debug log
      strapi.log.info('[LICENSE] getLicenseLimits - license exists:', !!license);
      if (license) {
        strapi.log.info('[LICENSE] getLicenseLimits - featurePremium:', license.featurePremium);
        strapi.log.info('[LICENSE] getLicenseLimits - featureAdvanced:', license.featureAdvanced);
      }
      
      // Get tier info - check both formats (like Magic Mail)
      let tier = 'free';
      if (license?.featureEnterprise === true) tier = 'enterprise';
      else if (license?.featureAdvanced === true) tier = 'advanced';
      else if (license?.featurePremium === true) tier = 'premium';
      
      const isPremium = tier === 'premium' || tier === 'advanced' || tier === 'enterprise';
      const isAdvanced = tier === 'advanced' || tier === 'enterprise';
      
      strapi.log.info('[LICENSE] getLicenseLimits - detected tier:', tier);
      
      // Get bookmark counts
      const bookmarkCheck = await this.canCreateBookmark(userId);
      
      return {
        maxBookmarks: bookmarkCheck.max,
        currentBookmarks: bookmarkCheck.current,
        canCreate: bookmarkCheck.canCreate,
        tier,
        features: {
          queryHistory: isPremium || isAdvanced,
          export: isPremium || isAdvanced,
          analytics: isAdvanced,
          bulkOperations: isAdvanced,
          customIntegrations: isAdvanced,
        }
      };
    } catch (error) {
      strapi.log.error('[LICENSE] Error getting license limits:', error);
      return {
        maxBookmarks: 10,
        currentBookmarks: 0,
        canCreate: true,
        tier: 'free',
        features: {
          queryHistory: false,
          export: false,
          analytics: false,
          bulkOperations: false,
          customIntegrations: false,
        }
      };
    }
  },

  /**
   * Check if a specific feature is available based on license
   * @param feature - Feature key to check
   * @returns Boolean indicating if feature is available
   */
  hasFeature(feature: string): boolean {
    try {
      const licenseGuard = (strapi as any).licenseGuard;
      const licenseData = licenseGuard?.data;
      
      const isPremium = licenseData?.featurePremium || false;
      const isAdvanced = licenseData?.featureAdvanced || false;

      // Feature mapping
      const featureRequirements: Record<string, 'free' | 'premium' | 'advanced'> = {
        // Free tier
        basicBookmarks: 'free',
        basicFilters: 'free',
        
        // Premium tier
        extendedBookmarks: 'premium',
        queryHistory: 'premium',
        exportBookmarks: 'premium',
        sharedBookmarks: 'premium',
        
        // Advanced tier
        unlimitedBookmarks: 'advanced',
        advancedFilters: 'advanced',
        subGroups: 'advanced',
        bulkOperations: 'advanced',
        analytics: 'advanced',
        customIntegrations: 'advanced',
      };

      const requiredTier = featureRequirements[feature] || 'free';
      
      // Determine current tier level
      let currentTierLevel = 0; // free
      if (isAdvanced) currentTierLevel = 2;
      else if (isPremium) currentTierLevel = 1;

      const tierLevels: Record<string, number> = {
        free: 0,
        premium: 1,
        advanced: 2,
      };

      return currentTierLevel >= tierLevels[requiredTier];
    } catch (error) {
      strapi.log.debug('[LICENSE] Error checking feature:', feature);
      return false;
    }
  },

  /**
   * Get current tier name
   * @returns 'free' | 'premium' | 'advanced'
   */
  getCurrentTier(): 'free' | 'premium' | 'advanced' {
    try {
      const licenseGuard = (strapi as any).licenseGuard;
      const licenseData = licenseGuard?.data;
      
      if (licenseData?.featureAdvanced) return 'advanced';
      if (licenseData?.featurePremium) return 'premium';
      return 'free';
    } catch (error) {
      return 'free';
    }
  },

  /**
   * Cleanup on plugin destroy
   */
  cleanup(): void {
    const licenseGuard = (strapi as any).licenseGuard;
    if (licenseGuard && licenseGuard.pingInterval) {
      clearInterval(licenseGuard.pingInterval);
      strapi.log.info('[STOP] License pinging stopped');
    }
  },
});

export default licenseGuardService;


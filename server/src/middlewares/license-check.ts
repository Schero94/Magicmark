/**
 * License Check Middleware
 * Validates license before allowing plugin operations
 */

export default (config: any, { strapi }: any) => {
  return async (ctx: any, next: any) => {
    // Skip license check for license management endpoints
    if (ctx.request.url.includes('/magic-mark/license/')) {
      return await next();
    }

    // Skip for admin authentication endpoints
    if (ctx.request.url.includes('/admin/login')) {
      return await next();
    }

    try {
      const licenseGuard = strapi.plugin('magic-mark')?.service('license-guard');
      
      if (!licenseGuard) {
        return await next();
      }

      const pluginStore = strapi.store({ 
        type: 'plugin', 
        name: 'magic-mark' 
      });
      
      const licenseKey = await pluginStore.get({ key: 'licenseKey' });

      // No license key - allow access but log warning
      if (!licenseKey) {
        strapi.log.warn('[WARN] MagicMark: No license key found');
        return await next();
      }

      // Verify license with grace period
      const verification = await licenseGuard.verifyLicense(licenseKey, true);
      
      if (!verification.valid && !verification.gracePeriod) {
        strapi.log.warn('[WARN] MagicMark: Invalid license detected');
      }

      return await next();
    } catch {
      strapi.log.error('Error in license check middleware');
      return await next();
    }
  };
};


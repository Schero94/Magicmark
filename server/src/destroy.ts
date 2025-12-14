import type { Core } from '@strapi/strapi';
import { createLogger } from './utils/logger';

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const log = createLogger(strapi);
  
  // Cleanup License Guard ping interval
  try {
    const licenseGuardService = strapi.plugin('magic-mark')?.service('license-guard');
    if (licenseGuardService) {
      licenseGuardService.cleanup();
      log.info('[SUCCESS] License Guard cleanup completed');
    }
  } catch (error) {
    log.error('[ERROR] Error during License Guard cleanup:', error);
  }
};

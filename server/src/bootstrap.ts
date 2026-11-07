import type { Core } from '@strapi/strapi';
import { createLogger } from './utils/logger';

/** Initializes license enforcement and omits keys and personal details from logs. */
export default ({ strapi }: { strapi: Core.Strapi }) => {
  const log = createLogger(strapi);
  
  log.info('Plugin bootstrapping...');
  
  // Initialize License Guard
  try {
    const licenseGuardService = strapi.plugin('magic-mark').service('license-guard');
    
    // Wait a bit for all services to be ready
    setTimeout(async () => {
      const licenseStatus = await licenseGuardService.initialize();
      
      if (!licenseStatus.valid) {
        log.error('╔════════════════════════════════════════════════════════════════╗');
        log.error('║  [ERROR] MAGICMARK PLUGIN - NO VALID LICENSE                  ║');
        log.error('║                                                                ║');
        log.error('║  This plugin requires a valid license to operate.             ║');
        log.error('║  Please activate your license via Admin UI:                   ║');
        log.error('║  Go to Settings → MagicMark → License                         ║');
        log.error('║                                                                ║');
        log.error('║  The plugin will run with limited functionality until         ║');
        log.error('║  a valid license is activated.                                ║');
        log.error('╚════════════════════════════════════════════════════════════════╝');
      } else if (licenseStatus.valid) {
        log.info('╔════════════════════════════════════════════════════════════════╗');
        log.info('║  [SUCCESS] MAGICMARK PLUGIN LICENSE ACTIVE                    ║');
        log.info('║                                                                ║');
        
        if (licenseStatus.data) {
          const tier = licenseStatus.data.featureEnterprise
            ? 'Enterprise'
            : licenseStatus.data.featureAdvanced
              ? 'Advanced'
              : licenseStatus.data.featurePremium
                ? 'Premium'
                : 'Free';
          log.info(`║  Tier: ${tier}`.padEnd(66) + '║');
        } else {
          log.info(`║  Status: Grace Period Active                                  ║`);
        }
        
        log.info('║                                                                ║');
        log.info('║  [PING] Auto-pinging every 15 minutes                         ║');
        log.info('╚════════════════════════════════════════════════════════════════╝');
      }
    }, 3000); // Wait 3 seconds for API to be ready
  } catch {
    log.error('[ERROR] Error initializing License Guard');
  }
  
  log.info('Plugin bootstrapped successfully');
};

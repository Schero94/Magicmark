import type { Core } from '@strapi/strapi';
import { createLogger } from './utils/logger';

const magicMarkActions = {
  actions: [
    {
      section: 'plugins',
      displayName: 'Read',
      uid: 'settings.read',
      subCategory: 'Settings',
      pluginName: 'magic-mark',
    },
    {
      section: 'plugins',
      displayName: 'Edit',
      uid: 'settings.update',
      subCategory: 'Settings',
      pluginName: 'magic-mark',
    },
  ],
};

export default async ({ strapi }: { strapi: Core.Strapi }) => {
  const log = createLogger(strapi);
  
  // Register permissions
  await strapi.admin.services.permission.actionProvider.registerMany(
    magicMarkActions.actions
  );
  
  log.info('Plugin registered successfully');
};

import type { StrapiApp } from '@strapi/strapi/admin';

import pluginPkg from '../../package.json';
import pluginId from './pluginId';
import Initializer from './components/Initializer';
import PluginIcon from './components/PluginIcon';
import ViewsWidget from './components/ViewsWidget';
import AdvancedFilterButton from './components/AdvancedFilterButton';

const name = pluginPkg.strapi.name;

// Manual prefix translation function since we can't import from helper-plugin
const prefixPluginTranslations = (
  data: Record<string, any>,
  pluginId: string
): Record<string, any> => {
  const prefixed: Record<string, any> = {};
  Object.keys(data).forEach((key) => {
    prefixed[`${pluginId}.${key}`] = data[key];
  });
  return prefixed;
};

export default {
  register(app: StrapiApp) {
    console.log(`[${pluginId}] Registering plugin...`);
    
    // Menu link - path should be relative to root (no leading slash)
    app.addMenuLink({
      to: `plugins/${pluginId}`,
      icon: PluginIcon as any,
      intlLabel: {
        id: `${pluginId}.Admin.MainMenu.PluginName`,
        defaultMessage: name,
      },
      Component: () => import('./pages/App') as any,
      permissions: [],
    });

    app.createSettingSection(
      {
        id: pluginId,
        intlLabel: {
          id: `${pluginId}.settings.title`,
          defaultMessage: 'MagicMark',
        },
      },
      [
        {
          intlLabel: {
            id: `${pluginId}.settings.upgrade`,
            defaultMessage: 'Upgrade',
          },
          id: 'magic-mark-upgrade',
          to: `${pluginId}/upgrade`,
          Component: () => import(/* webpackChunkName: "magic-mark-upgrade" */ './pages/UpgradePage') as any,
          permissions: [],
        },
        {
          intlLabel: {
            id: `${pluginId}.settings.license`,
            defaultMessage: 'License',
          },
          id: 'magic-mark-license',
          to: `${pluginId}/license`,
          Component: () => import(/* webpackChunkName: "magic-mark-license" */ './pages/License') as any,
          permissions: [],
        },
      ]
    );

    app.registerPlugin({
      id: pluginId,
      initializer: Initializer as any,
      isReady: true,
      name,
    });
  },

  async bootstrap(app: StrapiApp) {
    console.log(`[${pluginId}] Bootstrapping plugin...`);
    
    // Inject components into the content manager list view actions
    // Using Strapi v5 API: app.getPlugin('content-manager').injectComponent()
    try {
      const contentManagerPlugin = app.getPlugin('content-manager');
      if (contentManagerPlugin) {
        console.log(`[${pluginId}] Injecting content manager components...`);
        
        // Inject Advanced Filter Button
        contentManagerPlugin.injectComponent('listView', 'actions', {
          name: 'magic-mark-advanced-filter',
          Component: AdvancedFilterButton as any,
        });
        
        // Inject ViewsWidget (Save Bookmark + Magicmark)
        contentManagerPlugin.injectComponent('listView', 'actions', {
          name: 'magic-mark-views-widget',
          Component: ViewsWidget as any,
        });
        
        console.log(`[${pluginId}] Successfully injected content manager components`);
      }
    } catch (error) {
      console.error(`[${pluginId}] Error injecting content manager components:`, error);
    }

    const env =
      typeof process === 'undefined' ? ({} as Record<string, string>) : process.env;

    if (env.STRAPI_ADMIN_FAVORITE_VIEWS_INJECT_TO) {
      for (const entry of env.STRAPI_ADMIN_FAVORITE_VIEWS_INJECT_TO.split(',')) {
        const parts = entry.split('::');
        if (parts.length < 2) continue;

        const [, pluginAndPath] = parts;
        const [pluginName, container, block] = pluginAndPath.split('.');

        const plugin = app.getPlugin(pluginName);
        if (!plugin) continue;

        try {
          (plugin as any).injectComponent(container, block, {
            name: 'favorite-views-widget',
            Component: ViewsWidget as any,
          });
        } catch (error) {
          console.error(`[${pluginId}] Error injecting component to ${pluginName}:`, error);
        }
      }
    }
  },

  async registerTrads({ locales }: { locales: string[] }) {
    const importedTrads = await Promise.all(
      locales.map((locale) => {
        return import(
          /* webpackChunkName: "translation-[request]" */ `./translations/${locale}.json`
        )
          .then(({ default: data }) => {
            return {
              data: prefixPluginTranslations(data, pluginId),
              locale,
            };
          })
          .catch(() => {
            return {
              data: {},
              locale,
            };
          });
      })
    );

    return Promise.resolve(importedTrads);
  },
};

/**
 * Magic Mark admin entry.
 *
 * register: menu link (needs `bookmarks.read`), plugin registration and, on Strapi versions
 * that have the homepage widget API, the "Pinned bookmarks" widget.
 * bootstrap: one component in the Content Manager list view toolbar (`listView.actions`).
 */
import { Star } from '@strapi/icons';
import type { StrapiApp } from '@strapi/strapi/admin';
import { ListViewActions } from './components/ListViewActions';
import PluginIcon from './components/PluginIcon';
import { PERMISSIONS } from './permissions';
import pluginId from './pluginId';

type ContentManagerApi = {
  injectComponent: (
    view: string,
    zone: string,
    component: { name: string; Component: React.ComponentType }
  ) => void;
};

export default {
  register(app: StrapiApp) {
    app.addMenuLink({
      to: `plugins/${pluginId}`,
      icon: PluginIcon,
      intlLabel: { id: `${pluginId}.plugin.name`, defaultMessage: 'Magic Mark' },
      Component: () => import('./pages/App'),
      permissions: PERMISSIONS.read,
    });

    app.registerPlugin({ id: pluginId, name: 'Magic Mark' });

    const widgets = (app as unknown as { widgets?: { register?: (widget: unknown) => void } })
      .widgets;
    if (widgets && typeof widgets.register === 'function') {
      widgets.register({
        id: 'pinned-bookmarks',
        pluginId,
        icon: Star,
        title: { id: `${pluginId}.widget.title`, defaultMessage: 'Pinned bookmarks' },
        link: {
          label: { id: `${pluginId}.widget.link`, defaultMessage: 'Manage bookmarks' },
          href: `/plugins/${pluginId}`,
        },
        component: async () => (await import('./widgets/PinnedBookmarksWidget')).default,
        permissions: PERMISSIONS.read,
      });
    }
  },

  bootstrap(app: StrapiApp) {
    const contentManager = app.getPlugin('content-manager') as unknown as
      ContentManagerApi | undefined;
    contentManager?.injectComponent('listView', 'actions', {
      name: `${pluginId}-list-view-actions`,
      Component: ListViewActions,
    });
  },

  async registerTrads({ locales }: { locales: string[] }) {
    return Promise.all(
      locales.map(async (locale) => {
        try {
          const { default: data } = await import(`./translations/${locale}.json`);
          return {
            data: Object.fromEntries(
              Object.entries(data as Record<string, string>).map(([key, value]) => [
                `${pluginId}.${key}`,
                value,
              ])
            ),
            locale,
          };
        } catch {
          return { data: {}, locale };
        }
      })
    );
  },
};

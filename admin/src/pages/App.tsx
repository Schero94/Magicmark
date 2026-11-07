/**
 * Plugin page router. The menu link is hidden without `bookmarks.read`; the page checks the
 * permission again and renders the native "no permissions" state. Unknown sub-paths (such as the
 * pages that 3.x had below the plugin page) show the native "Page not found" state.
 */
import { Page } from '@strapi/strapi/admin';
import { Route, Routes } from 'react-router-dom';
import { PERMISSIONS } from '../permissions';
import { BookmarksPage } from './BookmarksPage';
import { NotFoundPage } from './NotFoundPage';

const App = () => (
  <Page.Protect permissions={PERMISSIONS.read}>
    <Routes>
      <Route index element={<BookmarksPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  </Page.Protect>
);

export default App;

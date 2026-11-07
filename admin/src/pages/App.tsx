/**
 * Plugin page router. The menu link is hidden without `bookmarks.read`; the page checks the
 * permission again and renders the native "no permissions" state.
 */
import { Page } from '@strapi/strapi/admin';
import { Route, Routes } from 'react-router-dom';
import { PERMISSIONS } from '../permissions';
import { BookmarksPage } from './BookmarksPage';

const App = () => (
  <Page.Protect permissions={PERMISSIONS.read}>
    <Routes>
      <Route index element={<BookmarksPage />} />
      <Route path="*" element={<Page.Error />} />
    </Routes>
  </Page.Protect>
);

export default App;

/**
 * "Page not found" for unknown paths below the plugin page, for example pages that
 * 3.x had below `/plugins/magic-mark` and that no longer exist.
 * Built like Strapi's own NotFoundPage (@strapi/admin 5.61, not exported), so an old bookmark or
 * link lands on the native not-found state instead of an error.
 */
import { EmptyStateLayout, LinkButton } from '@strapi/design-system';
import { ArrowRight } from '@strapi/icons';
import { EmptyPictures } from '@strapi/icons/symbols';
import { Layouts, Page } from '@strapi/strapi/admin';
import { useIntl } from 'react-intl';
import { NavLink } from 'react-router-dom';
import pluginId from '../pluginId';
import { msg } from '../utils/translations';

export const NotFoundPage = () => {
  const { formatMessage } = useIntl();
  const title = formatMessage(msg('notFound.title', 'Page not found'));
  return (
    <Page.Main aria-labelledby="magic-mark-not-found-title">
      <Page.Title>{title}</Page.Title>
      <Layouts.Header id="magic-mark-not-found-title" title={title} />
      <Layouts.Content>
        <EmptyStateLayout
          icon={<EmptyPictures width="16rem" />}
          content={formatMessage(
            msg(
              'notFound.content',
              'This page does not exist. Your bookmarks are on the Magic Mark page.'
            )
          )}
          action={
            <LinkButton
              tag={NavLink}
              to={`/plugins/${pluginId}`}
              variant="secondary"
              endIcon={<ArrowRight />}
            >
              {formatMessage(msg('notFound.back', 'Go to Magic Mark'))}
            </LinkButton>
          }
          hasRadius
          shadow="tableShadow"
        />
      </Layouts.Content>
    </Page.Main>
  );
};

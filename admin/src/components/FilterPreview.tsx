// @ts-nocheck
import React from 'react';
import { Box, Flex, Typography } from '@strapi/design-system';
import { Filter, Link as LinkIcon } from '@strapi/icons';
import styled from 'styled-components';
import { parseQueryString, ParsedQuery, ParsedFilter } from '../utils/queryParser';

const FilterChip = styled.div<{ logic?: 'AND' | 'OR' }>`
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 4px;
  background: ${props => props.logic === 'OR' ? props.theme.colors.warning100 : props.theme.colors.primary100};
  border: 1px solid ${props => props.logic === 'OR' ? props.theme.colors.warning500 : props.theme.colors.primary500};
  font-size: 12px;
  margin: 4px;
  gap: 4px;
  color: ${props => props.theme.colors.neutral800};
`;

const LogicBadge = styled.span<{ logic: 'AND' | 'OR' }>`
  font-weight: bold;
  color: ${props => props.logic === 'OR' ? props.theme.colors.warning700 : props.theme.colors.primary700};
  font-size: 10px;
  text-transform: uppercase;
`;

const PopulateChip = styled.div`
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 4px;
  background: ${props => props.theme.colors.success100};
  border: 1px solid ${props => props.theme.colors.success500};
  font-size: 12px;
  margin: 4px;
  color: ${props => props.theme.colors.neutral800};
`;

const SortChip = styled.div`
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 4px;
  background: ${props => props.theme.colors.warning100};
  border: 1px solid ${props => props.theme.colors.warning500};
  font-size: 12px;
  margin: 4px;
  color: ${props => props.theme.colors.neutral800};
`;

interface FilterPreviewProps {
  query: string;
}

const FilterPreview: React.FC<FilterPreviewProps> = ({ query }) => {
  const parsed = parseQueryString(query);

  if (!query || (parsed.filters.length === 0 && parsed.sort.length === 0 && parsed.populate.length === 0)) {
    return (
      <Box padding={2} background="neutral100" borderRadius="4px">
        <Typography variant="pi" textColor="neutral600">
          No filters applied
        </Typography>
      </Box>
    );
  }

  return (
    <Box padding={3} background="neutral100" borderRadius="4px">
      {/* Filters */}
      {parsed.filters.length > 0 && (
        <Box marginBottom={2}>
          <Typography variant="pi" fontWeight="bold" style={{ marginBottom: '8px', display: 'block' }}>
            Filters:
          </Typography>
          <Flex wrap="wrap" gap={1}>
            {parsed.filters.map((filter, idx) => (
              <FilterChip key={idx} logic={filter.logic}>
                {filter.logic && <LogicBadge logic={filter.logic}>{filter.logic}</LogicBadge>}
                <span>{filter.field} {filter.operator} <strong>{filter.value}</strong></span>
              </FilterChip>
            ))}
          </Flex>
        </Box>
      )}

      {/* Sorting */}
      {parsed.sort.length > 0 && (
        <Box marginBottom={2}>
          <Typography variant="pi" fontWeight="bold" style={{ marginBottom: '8px', display: 'block' }}>
            Sorting:
          </Typography>
          <Flex wrap="wrap" gap={1}>
            {parsed.sort.map((sort, idx) => (
              <SortChip key={idx}>
                <Filter width="12px" height="12px" style={{ marginRight: '4px' }} /> {sort}
              </SortChip>
            ))}
          </Flex>
        </Box>
      )}

      {/* Population */}
      {parsed.populate.length > 0 && (
        <Box>
          <Typography variant="pi" fontWeight="bold" style={{ marginBottom: '8px', display: 'block' }}>
            Relations:
          </Typography>
          <Flex wrap="wrap" gap={1}>
            {parsed.populate.map((field, idx) => (
              <PopulateChip key={idx}>
                <LinkIcon width="12px" height="12px" style={{ marginRight: '4px' }} /> {field}
              </PopulateChip>
            ))}
          </Flex>
        </Box>
      )}
    </Box>
  );
};

export default FilterPreview;


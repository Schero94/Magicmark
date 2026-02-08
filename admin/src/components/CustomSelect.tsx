// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Box, Typography } from '@strapi/design-system';
import styled from 'styled-components';

const SelectContainer = styled.div`
  position: relative;
  width: 100%;
`;

const SelectButton = styled.button<{ $isOpen: boolean }>`
  width: 100%;
  padding: 10px 36px 10px 12px;
  border: 1px solid ${props => props.$isOpen ? '#4945ff' : 'rgba(128, 128, 128, 0.25)'};
  border-radius: 4px;
  background: ${(p) => p.theme.colors.neutral0};
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #4945ff;
  }
  
  &:focus {
    outline: none;
    border-color: #4945ff;
    box-shadow: 0 0 0 2px rgba(73, 69, 255, 0.1);
  }
  
  @media (max-width: 768px) {
    padding: 8px 32px 8px 10px;
    font-size: 13px;
  }
`;

const SelectText = styled.span<{ $isPlaceholder: boolean }>`
  color: ${props => props.$isPlaceholder ? '#8e8ea9' : '#212134'};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const IconWrapper = styled.span<{ $isOpen: boolean }>`
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%) ${props => props.$isOpen ? 'rotate(180deg)' : 'rotate(0deg)'};
  transition: transform 0.2s ease;
  display: flex;
  align-items: center;
  pointer-events: none;
  color: ${(p) => p.theme.colors.neutral500};
`;

const DropdownList = styled.div<{ $isOpen: boolean; top: number; left: number; width: number }>`
  position: fixed;
  top: ${props => props.top}px;
  left: ${props => props.left}px;
  width: ${props => props.width}px;
  max-height: 300px;
  overflow-y: auto;
  background: ${(p) => p.theme.colors.neutral0};
  border: 1px solid rgba(128, 128, 128, 0.25);
  border-radius: 4px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 10000;
  display: ${props => props.$isOpen ? 'block' : 'none'};
  
  @media (max-width: 768px) {
    max-height: 250px;
  }
`;

const DropdownItem = styled.button<{ $isSelected: boolean }>`
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: ${props => props.$isSelected ? '#f0f0ff' : props.theme.colors.neutral0};
  text-align: left;
  cursor: pointer;
  font-size: 14px;
  color: ${props => props.$isSelected ? '#4945ff' : props.theme.colors.neutral800};
  transition: background 0.15s ease;
  
  &:hover {
    background: ${(p) => p.theme.colors.neutral100};
  }
  
  &:focus {
    outline: none;
    background: #f0f0ff;
  }
  
  @media (max-width: 768px) {
    padding: 12px;
    font-size: 13px;
  }
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-bottom: 1px solid rgba(128, 128, 128, 0.25);
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-bottom-color: #4945ff;
  }
  
  @media (max-width: 768px) {
    padding: 12px;
    font-size: 13px;
  }
`;

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  searchable?: boolean;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  searchable = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Calculate dropdown position
  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Check if click is outside both the button AND the dropdown
      if (
        containerRef.current && 
        !containerRef.current.contains(target) &&
        !(target as Element).closest('[data-dropdown-portal]')
      ) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  const filteredOptions = searchable && searchTerm
    ? options.filter(opt => 
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  const selectedOption = options.find(opt => opt.value === value);

  const handleSelect = (optionValue: string) => {
    console.log('[CustomSelect] Selected:', optionValue);
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const dropdownContent = (
    <DropdownList 
      $isOpen={isOpen}
      top={dropdownPos.top}
      left={dropdownPos.left}
      width={dropdownPos.width}
      data-dropdown-portal="true"
    >
      {searchable && (
        <SearchInput
          ref={searchInputRef}
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      
      {filteredOptions.length === 0 ? (
        <Box padding={3}>
          <Typography variant="pi" textColor="neutral600">
            No options found
          </Typography>
        </Box>
      ) : (
        filteredOptions.map((option) => (
          <DropdownItem
            key={option.value}
            type="button"
            $isSelected={option.value === value}
            onClick={() => handleSelect(option.value)}
          >
            {option.label}
          </DropdownItem>
        ))
      )}
    </DropdownList>
  );

  return (
    <SelectContainer ref={containerRef}>
      <SelectButton
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        $isOpen={isOpen}
      >
        <SelectText $isPlaceholder={!value}>
          {selectedOption?.label || placeholder}
        </SelectText>
        <IconWrapper $isOpen={isOpen}>
          ▼
        </IconWrapper>
      </SelectButton>

      {isOpen && ReactDOM.createPortal(dropdownContent, document.body)}
    </SelectContainer>
  );
};

export default CustomSelect;


import React from 'react';

export interface PanelItemProps {
    actionText: string;
    disabled?: boolean;
    children: React.ReactNode;
}

export const PanelItem: React.FC<PanelItemProps> = (_props) => {
  // This component is only a declarative child; rendering handled by GroupedPanelView.
    return null;
};

PanelItem.displayName = 'PanelItem';
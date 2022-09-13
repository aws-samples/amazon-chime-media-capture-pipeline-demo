import React from 'react';
import SideNavigation from '@cloudscape-design/components/side-navigation';
export const Navigation = () => {
    const navigationItems = [
        { type: 'link', text: 'Meetings', href: '/' },
        { type: 'link', text: 'Recordings', href: '/recordings' },
    ];
    return (
        <SideNavigation
            header={{
                href: '/',
                text: 'Amazon Chime SDK Meetings with Transcribe',
            }}
            items={navigationItems}
        />
    );
};

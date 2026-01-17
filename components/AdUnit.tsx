import React from 'react';

interface AdUnitProps {
    slot?: string;
    format?: 'horizontal' | 'vertical' | 'square' | 'auto';
    className?: string;
}

export const AdUnit: React.FC<AdUnitProps> = ({ slot = "1234567890", format = 'auto', className = "" }) => {
    // In production, this would be an AdSense script or similar.
    // For now, it's a placeholder.

    return (
        <div className={`overflow-hidden rounded-lg flex items-center justify-center relative ${className}`}>
            {/* Simulating content size based on format */}
            <div className={`
                ${format === 'horizontal' ? 'w-full h-24' : ''}
                ${format === 'vertical' ? 'w-full h-64' : ''}
                ${format === 'square' ? 'w-full aspect-square' : ''}
                ${format === 'auto' ? 'w-full h-32' : ''}
             `}></div>
        </div>
    );
};

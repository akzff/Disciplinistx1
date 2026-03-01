import React from 'react';

interface CheckboxProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    style?: React.CSSProperties;
}

export function Checkbox({ 
    checked, 
    onChange, 
    disabled = false, 
    size = 'md', 
    className = '', 
    style = {} 
}: CheckboxProps) {
    const sizes = {
        sm: {
            width: '16px',
            height: '16px',
            fontSize: '10px'
        },
        md: {
            width: '20px',
            height: '20px',
            fontSize: '12px'
        },
        lg: {
            width: '24px',
            height: '24px',
            fontSize: '14px'
        }
    };

    const currentSize = sizes[size];

    return (
        <div 
            className={`custom-checkbox ${className}`}
            style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: currentSize.width,
                height: currentSize.height,
                cursor: disabled ? 'not-allowed' : 'pointer',
                ...style
            }}
        >
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                disabled={disabled}
                style={{
                    position: 'absolute',
                    opacity: 0,
                    width: 0,
                    height: 0,
                    margin: 0
                }}
            />
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    border: `2px solid ${checked ? 'var(--accent)' : 'rgba(255, 255, 255, 0.3)'}`,
                    borderRadius: '6px',
                    backgroundColor: checked ? 'var(--accent)' : 'transparent',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: disabled ? 0.5 : 1
                }}
            >
                {checked && (
                    <svg
                        width={currentSize.fontSize}
                        height={currentSize.fontSize}
                        viewBox="0 0 20 20"
                        fill="white"
                        style={{
                            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))'
                        }}
                    >
                        <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                        />
                    </svg>
                )}
            </div>
            
            <style jsx>{`
                .custom-checkbox:hover div {
                    border-color: ${disabled ? 'rgba(255, 255, 255, 0.3)' : 'var(--accent)'};
                    background-color: ${checked ? 'var(--accent)' : 'rgba(139, 92, 246, 0.1)'};
                }
                
                .custom-checkbox:active div {
                    transform: scale(0.95);
                }
            `}</style>
        </div>
    );
}

// Mission-specific checkbox for better integration
interface MissionCheckboxProps extends Omit<CheckboxProps, 'size'> {
    variant?: 'daily' | 'todo' | 'subtask';
}

export function MissionCheckbox({ 
    checked, 
    onChange, 
    disabled = false, 
    variant = 'todo',
    className = '',
    style = {}
}: MissionCheckboxProps) {
    const variantStyles = {
        daily: {
            accentColor: '#10b981',
            hoverColor: 'rgba(16, 185, 129, 0.1)'
        },
        todo: {
            accentColor: 'var(--accent)',
            hoverColor: 'rgba(139, 92, 246, 0.1)'
        },
        subtask: {
            accentColor: '#f59e0b',
            hoverColor: 'rgba(245, 158, 11, 0.1)'
        }
    };

    const currentVariant = variantStyles[variant];

    return (
        <div 
            className={`mission-checkbox ${className}`}
            style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '20px',
                height: '20px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                ...style
            }}
        >
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                disabled={disabled}
                style={{
                    position: 'absolute',
                    opacity: 0,
                    width: 0,
                    height: 0,
                    margin: 0
                }}
            />
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    border: `2px solid ${checked ? currentVariant.accentColor : 'rgba(255, 255, 255, 0.3)'}`,
                    borderRadius: '6px',
                    backgroundColor: checked ? currentVariant.accentColor : 'transparent',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: disabled ? 0.5 : 1,
                    boxShadow: checked ? `0 0 0 4px ${currentVariant.accentColor}20` : 'none'
                }}
            >
                {checked && (
                    <svg
                        width="12px"
                        height="12px"
                        viewBox="0 0 20 20"
                        fill="white"
                        style={{
                            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
                            animation: 'checkmark 0.2s ease-out'
                        }}
                    >
                        <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                        />
                    </svg>
                )}
            </div>
            
            <style jsx>{`
                .mission-checkbox:hover div {
                    border-color: ${disabled ? 'rgba(255, 255, 255, 0.3)' : currentVariant.accentColor};
                    background-color: ${checked ? currentVariant.accentColor : currentVariant.hoverColor};
                    transform: translateY(-1px);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                }
                
                .mission-checkbox:active div {
                    transform: scale(0.95) translateY(0);
                }
                
                @keyframes checkmark {
                    0% {
                        transform: scale(0) rotate(-45deg);
                    }
                    50% {
                        transform: scale(1.2) rotate(-45deg);
                    }
                    100% {
                        transform: scale(1) rotate(0deg);
                    }
                }
            `}</style>
        </div>
    );
}

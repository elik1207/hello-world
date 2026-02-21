import { Wallet, Plus, Settings } from 'lucide-react';

interface BottomNavProps {
    currentView: 'wallet' | 'add' | 'settings';
    onChange: (view: 'wallet' | 'add' | 'settings') => void;
}

export function BottomNav({ currentView, onChange }: BottomNavProps) {
    const navItems = [
        { id: 'wallet', icon: Wallet, label: 'Wallet' },
        { id: 'add', icon: Plus, label: 'Add' },
        { id: 'settings', icon: Settings, label: 'Settings' },
    ] as const;

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-brand-bg border-t border-brand-border z-50 pb-safe">
            <div className="flex justify-around items-center h-16 max-w-md mx-auto">
                {navItems.map((item) => {
                    const isActive = currentView === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onChange(item.id)}
                            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive ? 'text-brand-primary' : 'text-text-muted hover:text-text-secondary'
                                }`}
                        >
                            <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                            <span className="text-xs font-medium">{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}

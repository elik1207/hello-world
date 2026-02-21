import { useRef } from 'react';
import { Download, Upload, Trash2, Info } from 'lucide-react';

interface SettingsPageProps {
    onExport: () => void;
    onImport: (file: File) => void;
    onClear: () => void;
}

export function SettingsPage({ onExport, onImport, onClear }: SettingsPageProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onImport(file);
        }
        // Reset inputs
        if (e.target.value) e.target.value = '';
    };

    return (
        <div className="pb-20 pt-6 px-4 max-w-md mx-auto bg-brand-bg">
            <h1 className="text-2xl font-bold text-text-primary mb-6">Settings</h1>

            <div className="bg-brand-surface rounded-xl shadow-sm border border-brand-border overflow-hidden">
                {/* Export */}
                <button
                    onClick={onExport}
                    className="w-full flex items-center justify-between p-4 hover:bg-brand-card transition-colors border-b border-brand-border text-left"
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-brand-primary/10 p-2 rounded-lg text-brand-primary">
                            <Download size={20} />
                        </div>
                        <div>
                            <h3 className="font-medium text-text-primary">Export Data</h3>
                            <p className="text-xs text-text-muted">Download coupons as JSON</p>
                        </div>
                    </div>
                </button>

                {/* Import */}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-between p-4 hover:bg-brand-card transition-colors border-b border-brand-border text-left"
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-status-active/10 p-2 rounded-lg text-status-active">
                            <Upload size={20} />
                        </div>
                        <div>
                            <h3 className="font-medium text-text-primary">Import Data</h3>
                            <p className="text-xs text-text-muted">Restore from JSON backup</p>
                        </div>
                    </div>
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".json"
                    onChange={handleFileChange}
                />

                {/* Clear Data */}
                <button
                    onClick={onClear}
                    className="w-full flex items-center justify-between p-4 hover:bg-status-expired/10 transition-colors text-left group"
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-status-expired/10 p-2 rounded-lg text-status-expired group-hover:bg-status-expired/20">
                            <Trash2 size={20} />
                        </div>
                        <div>
                            <h3 className="font-medium text-text-primary group-hover:text-status-expired">Clear All Data</h3>
                            <p className="text-xs text-text-muted group-hover:text-status-expired/80">Permanently delete everything</p>
                        </div>
                    </div>
                </button>
            </div>

            <div className="mt-8 p-4 bg-brand-surface rounded-xl flex items-start gap-3 border border-brand-border">
                <Info className="text-brand-primary shrink-0 mt-0.5" size={20} />
                <div className="text-sm text-text-secondary">
                    <p className="font-semibold mb-1 text-text-primary">About Coupon Wallet</p>
                    <p>This is a local-only application. Your data is stored securely in your browser's Local Storage and is never sent to any server.</p>
                </div>
            </div>
        </div>
    );
}

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
        <div className="pb-20 pt-6 px-4 max-w-md mx-auto min-h-screen bg-gray-50">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Export */}
                <button
                    onClick={onExport}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors border-b border-gray-100 text-left"
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                            <Download size={20} />
                        </div>
                        <div>
                            <h3 className="font-medium text-gray-900">Export Data</h3>
                            <p className="text-xs text-gray-500">Download coupons as JSON</p>
                        </div>
                    </div>
                </button>

                {/* Import */}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors border-b border-gray-100 text-left"
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-green-50 p-2 rounded-lg text-green-600">
                            <Upload size={20} />
                        </div>
                        <div>
                            <h3 className="font-medium text-gray-900">Import Data</h3>
                            <p className="text-xs text-gray-500">Restore from JSON backup</p>
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
                    className="w-full flex items-center justify-between p-4 hover:bg-red-50 transition-colors text-left group"
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-red-50 p-2 rounded-lg text-red-600 group-hover:bg-red-100 group-hover:text-red-700">
                            <Trash2 size={20} />
                        </div>
                        <div>
                            <h3 className="font-medium text-gray-900 group-hover:text-red-700">Clear All Data</h3>
                            <p className="text-xs text-gray-500 group-hover:text-red-600">Permanently delete everything</p>
                        </div>
                    </div>
                </button>
            </div>

            <div className="mt-8 p-4 bg-blue-50 rounded-xl flex items-start gap-3">
                <Info className="text-blue-600 shrink-0 mt-0.5" size={20} />
                <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">About Coupon Wallet</p>
                    <p>This is a local-only application. Your data is stored securely in your browser's Local Storage and is never sent to any server.</p>
                </div>
            </div>
        </div>
    );
}

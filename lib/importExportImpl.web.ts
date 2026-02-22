import { getCoupons } from './storage';

export async function exportWallet(): Promise<boolean> {
    try {
        const coupons = await getCoupons();
        const data = { version: 1, items: coupons };
        const json = JSON.stringify(data, null, 2);
        const filename = `coupon-wallet-${new Date().toISOString().split('T')[0]}.json`;

        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        return true;
    } catch (error) {
        console.error('Export failed:', error);
        return false;
    }
}

export async function importWalletFile(): Promise<string | null> {
    try {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'application/json';
            input.onchange = (e: any) => {
                const file = e.target?.files?.[0];
                if (!file) {
                    resolve(null);
                    return;
                }
                const reader = new FileReader();
                reader.onload = (event) => {
                    resolve(event.target?.result as string);
                };
                reader.readAsText(file);
            };
            input.click();
        });
    } catch (error) {
        console.error('Import file picking failed:', error);
        return null;
    }
}

/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./app/**/*.{js,jsx,ts,tsx}",
        "./src/**/*.{js,jsx,ts,tsx}",
        "./App.tsx",
    ],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            colors: {
                brand: {
                    bg: '#1a1d38',
                    surface: '#252849',
                    card: '#27305a',
                    border: '#3c4270',
                    primary: '#6366f1',
                    secondary: '#8b5cf6',
                    accent: '#a78bfa',
                },
                status: {
                    active: '#10b981',
                    warn: '#f59e0b',
                    expired: '#ef4444',
                    used: '#64748b',
                },
                text: {
                    primary: '#f8fafc',
                    secondary: '#dde2f4',
                    muted: '#a0aed4',
                },
            },
        },
    },
    plugins: [],
};

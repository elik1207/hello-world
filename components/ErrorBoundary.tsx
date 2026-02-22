import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { trackEvent } from '../lib/analytics';
import * as Sentry from '@sentry/react-native';

interface Props {
    children: React.ReactNode;
    fallbackMessage?: string;
    onReset?: () => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        trackEvent('parse_fail', {
            error: 'ui_crash',
            errorMessage: error.message,
            componentStack: errorInfo.componentStack?.substring(0, 500)
        });

        Sentry.captureException(error);
        console.error('[ErrorBoundary Caught Cash]', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        if (this.props.onReset) {
            this.props.onReset();
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <View style={{ flex: 1, backgroundColor: '#1a1d38', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                    <AlertCircle size={48} color="#f87171" style={{ marginBottom: 16 }} />
                    <Text style={{ fontSize: 20, fontWeight: '700', color: '#f8fafc', marginBottom: 8, textAlign: 'center' }}>
                        Something went wrong
                    </Text>
                    <Text style={{ fontSize: 14, color: '#a0aed4', marginBottom: 24, textAlign: 'center' }}>
                        {this.props.fallbackMessage || 'The AI extraction flow encountered an unexpected error.'}
                    </Text>

                    <Pressable
                        onPress={this.handleReset}
                        style={{ backgroundColor: '#252849', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, borderWidth: 1, borderColor: '#3c4270' }}
                    >
                        <Text style={{ color: '#f8fafc', fontWeight: '600' }}>Go Back</Text>
                    </Pressable>
                </View>
            );
        }

        return this.props.children;
    }
}

import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Switch } from 'react-native';
import { ArrowLeft, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react-native';
import type { Coupon, ItemType, SourceType, GiftOrVoucherDraft } from '../lib/types';
import { extractGiftFromText } from '../lib/ai/extractGiftFromText';
import { LinearGradient } from 'expo-linear-gradient';

interface AddViaAIPageProps {
    onSave: (data: Omit<Coupon, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => void;
    onCancel: () => void;
}

type WizardStep = 'input' | 'clarify' | 'preview';

export function AddViaAIPage({ onSave, onCancel }: AddViaAIPageProps) {
    const [step, setStep] = useState<WizardStep>('input');

    // Input State
    const [rawText, setRawText] = useState('');
    const [sourceType, setSourceType] = useState<SourceType>('whatsapp');

    // Draft State
    const [draft, setDraft] = useState<GiftOrVoucherDraft | null>(null);
    const [clarificationAnswers, setClarificationAnswers] = useState<Record<string, string>>({});

    // Remote fetch state
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analyzeError, setAnalyzeError] = useState<string | null>(null);

    const handleAnalyze = async () => {
        if (!rawText.trim()) return;

        setIsAnalyzing(true);
        setAnalyzeError(null);

        let result: GiftOrVoucherDraft;

        try {
            if (process.env.EXPO_PUBLIC_AI_MODE === 'backend') {
                // Route through the new hybrid fastify/express backend
                const backendUrl = process.env.EXPO_PUBLIC_AI_BACKEND_URL || 'http://localhost:3000';
                const response = await fetch(`${backendUrl}/ai/extract`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sourceText: rawText, sourceType })
                });

                if (!response.ok) {
                    throw new Error(`Backend Error: ${response.status} ${response.statusText}`);
                }
                result = await response.json();
            } else {
                // Fallback to strict offline logic
                result = extractGiftFromText(rawText, sourceType);
            }

            setDraft(result);

            if (result.missingRequiredFields && result.missingRequiredFields.length > 0 && result.questions && result.questions.length > 0) {
                setStep('clarify');
            } else {
                setStep('preview');
            }
        } catch (e: any) {
            console.error('[AI Extract Error]', e);
            setAnalyzeError(e.message || 'Network request failed. Is the backend running?');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleClarifyNext = () => {
        // Apply answers to draft
        if (draft) {
            const updatedDraft = { ...draft };
            for (const [key, val] of Object.entries(clarificationAnswers)) {
                if (val.trim()) {
                    (updatedDraft as any)[key] = val.trim();
                }
            }
            setDraft(updatedDraft);
        }
        setStep('preview');
    };

    const handleSave = () => {
        if (!draft || !draft.title) return; // safety

        const finalItem: Omit<Coupon, 'id' | 'createdAt' | 'updatedAt' | 'status'> = {
            title: draft.title,
            type: draft.merchant ? 'gift_card' : 'voucher', // Best guess based on merchant presence
            store: draft.merchant,
            code: draft.code,
            currency: draft.currency || 'ILS', // fallback
            expiryDate: draft.expirationDate ? draft.expirationDate.split('T')[0] : undefined,
            discountType: 'amount',
            initialValue: draft.amount, // Set amount to initial value
            remainingValue: draft.amount, // Set remaining to initial
            discountValue: draft.amount, // Redundant fallback for voucher/coupon
            event: draft.sourceType === 'whatsapp' ? 'Received via WhatsApp' : undefined,
            description: `Extracted via AI from ${draft.sourceType}.\nOriginal text:\n${draft.sourceText}`,
        };

        onSave(finalItem);
    };

    return (
        <ScrollView style={{ flex: 1, backgroundColor: '#1a1d38' }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, marginTop: 8 }}>
                <Pressable onPress={onCancel} style={{ padding: 8, marginRight: 8, backgroundColor: '#252849', borderRadius: 8 }}>
                    <ArrowLeft size={20} color="#f8fafc" />
                </Pressable>
                <Text style={{ fontSize: 24, fontWeight: '700', color: '#f8fafc' }}>Add via AI</Text>
            </View>

            {step === 'input' && (
                <View>
                    <Text style={{ fontSize: 16, color: '#dde2f4', marginBottom: 12 }}>
                        Paste a message from WhatsApp, SMS, or an email. The AI will extract the details automatically.
                    </Text>

                    <TextInput
                        style={{
                            backgroundColor: '#27305a',
                            color: '#f8fafc',
                            borderRadius: 12,
                            padding: 16,
                            minHeight: 150,
                            borderWidth: 1,
                            borderColor: '#3c4270',
                            textAlignVertical: 'top',
                            marginBottom: 20
                        }}
                        placeholder="e.g. 'Hey! Here is your 200₪ gift card to Zara. Code: ZARA-123. Valid until 12/2025'"
                        placeholderTextColor="#a0aed4"
                        multiline
                        value={rawText}
                        onChangeText={setRawText}
                    />

                    <Text style={{ fontSize: 13, color: '#a0aed4', marginBottom: 8, fontWeight: '600' }}>SOURCE TYPE</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
                        {['whatsapp', 'sms', 'manual', 'other'].map(type => (
                            <Pressable
                                key={type}
                                onPress={() => setSourceType(type as SourceType)}
                                style={{
                                    paddingVertical: 8,
                                    paddingHorizontal: 12,
                                    borderRadius: 8,
                                    backgroundColor: sourceType === type ? '#6366f1' : '#27305a',
                                    borderWidth: 1,
                                    borderColor: sourceType === type ? '#8b5cf6' : '#3c4270',
                                }}
                            >
                                <Text style={{ color: sourceType === type ? '#fff' : '#a0aed4', textTransform: 'capitalize', fontWeight: '500' }}>
                                    {type}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    <Pressable
                        onPress={handleAnalyze}
                        style={{ overflow: 'hidden', borderRadius: 12, opacity: rawText.trim() && !isAnalyzing ? 1 : 0.5 }}
                        disabled={!rawText.trim() || isAnalyzing}
                    >
                        <LinearGradient colors={['#6366f1', '#4e48c0']} style={{ padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            <Sparkles size={20} color="#fff" />
                            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                                {isAnalyzing ? 'Analyzing...' : 'Analyze Text'}
                            </Text>
                        </LinearGradient>
                    </Pressable>

                    {analyzeError && (
                        <View style={{ marginTop: 16, padding: 12, backgroundColor: '#fef2f2', borderRadius: 8, borderWidth: 1, borderColor: '#f87171' }}>
                            <Text style={{ color: '#b91c1c', fontSize: 14, fontWeight: '500' }}>{analyzeError}</Text>
                        </View>
                    )}
                </View>
            )}

            {step === 'clarify' && draft && (
                <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <AlertCircle size={24} color="#f59e0b" />
                        <Text style={{ fontSize: 18, fontWeight: '600', color: '#f59e0b' }}>Missing Information</Text>
                    </View>

                    <Text style={{ fontSize: 15, color: '#dde2f4', marginBottom: 24 }}>
                        We found a coupon but we need a bit more context to save it properly.
                    </Text>

                    {draft.questions.map((q) => (
                        <View key={q.key} style={{ marginBottom: 20 }}>
                            <Text style={{ fontSize: 14, color: '#a0aed4', marginBottom: 8, fontWeight: '600' }}>{q.questionText}</Text>
                            <TextInput
                                style={{
                                    backgroundColor: '#27305a',
                                    color: '#f8fafc',
                                    borderRadius: 12,
                                    padding: 16,
                                    borderWidth: 1,
                                    borderColor: '#3c4270',
                                }}
                                placeholder="Type answer here..."
                                placeholderTextColor="#a0aed4"
                                value={clarificationAnswers[q.key] || ''}
                                onChangeText={(val) => setClarificationAnswers(prev => ({ ...prev, [q.key]: val }))}
                            />
                        </View>
                    ))}

                    <Pressable
                        onPress={handleClarifyNext}
                        style={{ backgroundColor: '#6366f1', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 12 }}
                    >
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Continue</Text>
                    </Pressable>
                </View>
            )}

            {step === 'preview' && draft && (
                <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <CheckCircle2 size={24} color="#10b981" />
                            <Text style={{ fontSize: 18, fontWeight: '600', color: '#10b981' }}>Ready to Save</Text>
                        </View>
                        <Text style={{ fontSize: 13, color: '#a0aed4', fontWeight: '600' }}>
                            Confidence: {Math.round(draft.confidence * 100)}%
                        </Text>
                    </View>

                    <View style={{ backgroundColor: '#252849', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#3c4270', marginBottom: 16 }}>
                        {/* Title Row */}
                        <View style={{ marginBottom: 16 }}>
                            <Text style={{ fontSize: 12, color: '#a0aed4', marginBottom: 4 }}>Title</Text>
                            <TextInput
                                style={{ color: '#f8fafc', fontSize: 18, fontWeight: '600', backgroundColor: '#1a1d38', padding: 10, borderRadius: 8 }}
                                value={draft.title || ''}
                                onChangeText={(val) => setDraft({ ...draft, title: val })}
                            />
                        </View>

                        {/* Store / Merchant */}
                        <View style={{ marginBottom: 16 }}>
                            <Text style={{ fontSize: 12, color: '#a0aed4', marginBottom: 4 }}>Merchant / Store</Text>
                            <TextInput
                                style={{ color: '#f8fafc', fontSize: 16, backgroundColor: '#1a1d38', padding: 10, borderRadius: 8 }}
                                value={draft.merchant || ''}
                                onChangeText={(val) => setDraft({ ...draft, merchant: val })}
                                placeholder="Unknown Store"
                                placeholderTextColor="#64748b"
                            />
                        </View>

                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 12, color: '#a0aed4', marginBottom: 4 }}>Amount ({draft.currency || 'ILS'})</Text>
                                <TextInput
                                    style={{ color: '#f8fafc', fontSize: 16, backgroundColor: '#1a1d38', padding: 10, borderRadius: 8 }}
                                    value={draft.amount !== undefined ? draft.amount.toString() : ''}
                                    onChangeText={(val) => setDraft({ ...draft, amount: parseFloat(val) || undefined })}
                                    keyboardType="numeric"
                                    placeholder="0"
                                    placeholderTextColor="#64748b"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 12, color: '#a0aed4', marginBottom: 4 }}>Expiry Date</Text>
                                <TextInput
                                    style={{ color: '#f8fafc', fontSize: 16, backgroundColor: '#1a1d38', padding: 10, borderRadius: 8 }}
                                    value={draft.expirationDate ? draft.expirationDate.split('T')[0] : ''}
                                    onChangeText={(val) => setDraft({ ...draft, expirationDate: val ? `${val}T00:00:00.000Z` : undefined })}
                                    placeholder="YYYY-MM-DD"
                                    placeholderTextColor="#64748b"
                                />
                            </View>
                        </View>

                        <View style={{ marginBottom: 16 }}>
                            <Text style={{ fontSize: 12, color: '#a0aed4', marginBottom: 4 }}>Coupon Code</Text>
                            <TextInput
                                style={{ color: '#a78bfa', fontSize: 16, fontWeight: '700', backgroundColor: '#1a1d38', padding: 10, borderRadius: 8, letterSpacing: 1 }}
                                value={draft.code || ''}
                                onChangeText={(val) => setDraft({ ...draft, code: val })}
                                placeholder="A1B2-C3D4"
                                placeholderTextColor="#64748b"
                            />
                        </View>
                    </View>

                    {draft.assumptions && draft.assumptions.length > 0 && (
                        <View style={{ backgroundColor: '#27305a', padding: 12, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: '#3c4270' }}>
                            <Text style={{ fontSize: 13, color: '#f8fafc', fontWeight: '600', marginBottom: 6 }}>AI Assumptions:</Text>
                            {draft.assumptions.map((assump, idx) => (
                                <Text key={idx} style={{ fontSize: 12, color: '#a0aed4', marginBottom: 2 }}>• {assump}</Text>
                            ))}
                        </View>
                    )}

                    <Pressable
                        onPress={handleSave}
                        style={{ opacity: draft.title ? 1 : 0.5, borderRadius: 12, overflow: 'hidden' }}
                        disabled={!draft.title}
                    >
                        <LinearGradient colors={['#10b981', '#059669']} style={{ padding: 16, alignItems: 'center' }}>
                            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Save to Wallet</Text>
                        </LinearGradient>
                    </Pressable>
                </View>
            )}

        </ScrollView>
    );
}

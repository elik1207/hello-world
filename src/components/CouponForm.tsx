import React, { useState } from 'react';
import type { Coupon, DiscountType, ItemType } from '../lib/types';

interface CouponFormProps {
    initialData?: Coupon;
    onSave: (data: Omit<Coupon, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => void;
    onCancel: () => void;
}

export function CouponForm({ initialData, onSave, onCancel }: CouponFormProps) {
    const defaultType: ItemType = 'coupon';
    const [formData, setFormData] = useState({
        type: initialData?.type || defaultType,
        title: initialData?.title || '',
        description: initialData?.description || '',
        discountType: initialData?.discountType || 'amount' as DiscountType,
        // For coupons/vouchers
        discountValue: initialData?.discountValue?.toString() || '',
        // For gift cards
        initialValue: initialData?.initialValue?.toString() || '',
        remainingValue: initialData?.remainingValue?.toString() || '',
        currency: initialData?.currency || 'ILS', // Default to ILS
        expiryDate: initialData?.expiryDate || '',
        store: initialData?.store || '',
        category: initialData?.category || '',
        code: initialData?.code || '',
        sender: initialData?.sender || '',
        event: initialData?.event || '',
        imageUrl: initialData?.imageUrl || '',
        barcodeData: initialData?.barcodeData || '',
    });

    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!formData.title.trim()) {
            setError('Title is required');
            return;
        }

        let finalDiscountValue;
        let finalInitialValue;
        let finalRemainingValue;

        if (formData.type === 'gift_card') {
            const initial = Number(formData.initialValue);
            if (!formData.initialValue || isNaN(initial) || initial <= 0) {
                setError('Initial amount is required for gift cards and must be > 0');
                return;
            }
            finalInitialValue = initial;

            const remaining = formData.remainingValue ? Number(formData.remainingValue) : initial;
            if (isNaN(remaining) || remaining < 0 || remaining > initial) {
                setError('Remaining balance must be valid and cannot exceed initial amount');
                return;
            }
            finalRemainingValue = remaining;

        } else {
            // Coupon or Voucher
            const val = Number(formData.discountValue);
            if (!formData.discountValue || isNaN(val) || val <= 0) {
                setError('Value must be greater than 0');
                return;
            }
            if (formData.discountType === 'percent' && val > 100) {
                setError('Percentage cannot exceed 100');
                return;
            }
            finalDiscountValue = val;
        }

        onSave({
            type: formData.type,
            title: formData.title,
            description: formData.description,
            discountType: formData.discountType,
            discountValue: finalDiscountValue,
            initialValue: finalInitialValue,
            remainingValue: finalRemainingValue,
            currency: formData.currency,
            expiryDate: formData.expiryDate,
            store: formData.store,
            category: formData.category,
            code: formData.code,
            sender: formData.sender,
            event: formData.event,
            imageUrl: formData.imageUrl,
            barcodeData: formData.barcodeData,
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 p-1">
            {error && (
                <div className="bg-status-expired/10 text-status-expired border border-status-expired/20 p-3 rounded-lg text-sm font-medium">
                    {error}
                </div>
            )}

            {/* Type Selector */}
            <div className="flex p-1 bg-brand-surface border border-brand-border rounded-lg mb-4">
                {(['coupon', 'gift_card', 'voucher'] as ItemType[]).map(type => (
                    <button
                        key={type}
                        type="button"
                        onClick={() => setFormData({ ...formData, type })}
                        className={`flex-1 py-2 text-sm font-medium rounded-md capitalize transition-all ${formData.type === type ? 'bg-brand-card text-brand-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
                            }`}
                    >
                        {type.replace('_', ' ')}
                    </button>
                ))}
            </div>

            {/* Main Info */}
            <div className="space-y-3">
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Title *</label>
                    <input
                        type="text"
                        required
                        className="w-full px-4 py-2 rounded-lg border border-brand-border bg-brand-surface text-text-primary focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none placeholder-text-muted"
                        placeholder={formData.type === 'gift_card' ? "e.g. Fox Home Birthday Card" : "e.g. 50₪ off at Super-Pharm"}
                        value={formData.title}
                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                    />
                </div>

                {formData.type === 'gift_card' ? (
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-text-secondary mb-1">Initial Value *</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    step="0.01"
                                    className="w-full px-4 py-2 rounded-lg border border-brand-border bg-brand-surface text-text-primary outline-none focus:ring-2 focus:ring-brand-primary placeholder-text-muted"
                                    placeholder="0"
                                    value={formData.initialValue}
                                    onChange={e => setFormData({ ...formData, initialValue: e.target.value })}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted font-medium">
                                    {formData.currency}
                                </span>
                            </div>
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-text-secondary mb-1">Remaining Balance</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="w-full px-4 py-2 rounded-lg border border-brand-border bg-brand-surface text-text-primary outline-none focus:ring-2 focus:ring-brand-primary placeholder-text-muted"
                                    placeholder={formData.initialValue || "0"}
                                    value={formData.remainingValue}
                                    onChange={e => setFormData({ ...formData, remainingValue: e.target.value })}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted font-medium">
                                    {formData.currency}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex gap-4">
                        <div className="w-1/3">
                            <label className="block text-sm font-medium text-text-secondary mb-1">Discount</label>
                            <select
                                className="w-full px-4 py-2 rounded-lg border border-brand-border bg-brand-surface text-text-primary focus:ring-2 focus:ring-brand-primary outline-none"
                                value={formData.discountType}
                                onChange={e => setFormData({ ...formData, discountType: e.target.value as DiscountType })}
                            >
                                <option value="amount">Amount</option>
                                <option value="percent">Percent</option>
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-text-secondary mb-1">Value *</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    step="0.01"
                                    className="w-full px-4 py-2 rounded-lg border border-brand-border bg-brand-surface text-text-primary outline-none focus:ring-2 focus:ring-brand-primary placeholder-text-muted"
                                    placeholder="0"
                                    value={formData.discountValue}
                                    onChange={e => setFormData({ ...formData, discountValue: e.target.value })}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted font-medium">
                                    {formData.discountType === 'percent' ? '%' : formData.currency}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Store / Brand</label>
                    <input
                        className="w-full px-4 py-2 rounded-lg border border-brand-border bg-brand-surface text-text-primary outline-none focus:ring-2 focus:ring-brand-primary placeholder-text-muted"
                        placeholder="e.g. Fox"
                        value={formData.store}
                        onChange={e => setFormData({ ...formData, store: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Category</label>
                    <input
                        className="w-full px-4 py-2 rounded-lg border border-brand-border bg-brand-surface text-text-primary outline-none focus:ring-2 focus:ring-brand-primary placeholder-text-muted"
                        placeholder="e.g. Food"
                        value={formData.category}
                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                    />
                </div>
            </div>

            {/* Gift Info */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">From / Sender</label>
                    <input
                        className="w-full px-4 py-2 rounded-lg border border-brand-border bg-brand-surface text-text-primary outline-none focus:ring-2 focus:ring-brand-primary placeholder-text-muted"
                        placeholder="e.g. Mom & Dad"
                        value={formData.sender}
                        onChange={e => setFormData({ ...formData, sender: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Occasion</label>
                    <input
                        className="w-full px-4 py-2 rounded-lg border border-brand-border bg-brand-surface text-text-primary outline-none focus:ring-2 focus:ring-brand-primary placeholder-text-muted"
                        placeholder="e.g. Birthday"
                        value={formData.event}
                        onChange={e => setFormData({ ...formData, event: e.target.value })}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Expiration Date</label>
                    <input
                        type="date"
                        className="w-full px-4 py-2 rounded-lg border border-brand-border bg-brand-surface text-text-primary outline-none focus:ring-2 focus:ring-brand-primary"
                        value={formData.expiryDate}
                        onChange={e => setFormData({ ...formData, expiryDate: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Coupon Code / PIN</label>
                    <input
                        type="text"
                        className="w-full px-4 py-2 rounded-lg border border-brand-border bg-brand-surface text-text-primary font-mono text-sm outline-none focus:ring-2 focus:ring-brand-primary placeholder-text-muted"
                        placeholder="e.g. SAVE20"
                        value={formData.code}
                        onChange={e => setFormData({ ...formData, code: e.target.value })}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Barcode / QR Data</label>
                    <input
                        type="text"
                        className="w-full px-4 py-2 rounded-lg border border-brand-border bg-brand-surface text-text-primary font-mono text-sm outline-none focus:ring-2 focus:ring-brand-primary placeholder-text-muted"
                        placeholder="e.g. 123456789012"
                        value={formData.barcodeData}
                        onChange={e => setFormData({ ...formData, barcodeData: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Image URL</label>
                    <input
                        type="url"
                        className="w-full px-4 py-2 rounded-lg border border-brand-border bg-brand-surface text-text-primary text-sm outline-none focus:ring-2 focus:ring-brand-primary placeholder-text-muted"
                        placeholder="https://example.com/image.png"
                        value={formData.imageUrl}
                        onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Description / Notes</label>
                <textarea
                    className="w-full px-4 py-2 rounded-lg border border-brand-border bg-brand-surface text-text-primary outline-none focus:ring-2 focus:ring-brand-primary resize-none h-20 placeholder-text-muted"
                    placeholder="Terms & conditions, notes..."
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
            </div>

            <div className="flex gap-3 pt-4 border-t border-brand-border">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 px-4 py-2 text-text-secondary bg-brand-surface border border-brand-border rounded-lg hover:bg-brand-card font-medium transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="flex-1 px-4 py-2 text-white bg-brand-primary rounded-lg hover:bg-brand-primary/90 font-medium shadow-sm transition-colors"
                >
                    Save Item
                </button>
            </div>
        </form>
    );
}

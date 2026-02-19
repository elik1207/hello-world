import React, { useState } from 'react';
import type { Coupon, DiscountType } from '../lib/types';

interface CouponFormProps {
    initialData?: Coupon;
    onSave: (data: Omit<Coupon, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => void;
    onCancel: () => void;
}

export function CouponForm({ initialData, onSave, onCancel }: CouponFormProps) {
    const [formData, setFormData] = useState({
        title: initialData?.title || '',
        description: initialData?.description || '',
        discountType: initialData?.discountType || 'amount' as DiscountType,
        discountValue: initialData?.discountValue || '',
        currency: initialData?.currency || 'ILS', // Default to ILS
        expiryDate: initialData?.expiryDate || '',
        store: initialData?.store || '',
        category: initialData?.category || '',
        code: initialData?.code || '',
    });

    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!formData.title.trim()) {
            setError('Title is required');
            return;
        }

        const val = Number(formData.discountValue);
        if (!formData.discountValue || isNaN(val) || val <= 0) {
            setError('Value must be greater than 0');
            return;
        }

        if (formData.discountType === 'percent' && val > 100) {
            setError('Percentage cannot exceed 100');
            return;
        }

        onSave({
            title: formData.title,
            description: formData.description,
            discountType: formData.discountType,
            discountValue: val,
            currency: formData.currency,
            expiryDate: formData.expiryDate,
            store: formData.store,
            category: formData.category,
            code: formData.code,
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 p-1">
            {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium">
                    {error}
                </div>
            )}

            {/* Main Info */}
            <div className="space-y-3">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                    <input
                        type="text"
                        required
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="e.g. 50₪ off at Super-Pharm"
                        value={formData.title}
                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                    />
                </div>

                <div className="flex gap-4">
                    <div className="w-1/3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                        <select
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white"
                            value={formData.discountType}
                            onChange={e => setFormData({ ...formData, discountType: e.target.value as DiscountType })}
                        >
                            <option value="amount">Amount</option>
                            <option value="percent">Percent</option>
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Value *</label>
                        <div className="relative">
                            <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="0"
                                value={formData.discountValue}
                                onChange={e => setFormData({ ...formData, discountValue: e.target.value })}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                                {formData.discountType === 'percent' ? '%' : formData.currency}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
                    <input
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                        placeholder="e.g. Fox"
                        value={formData.store}
                        onChange={e => setFormData({ ...formData, store: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <input
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                        placeholder="e.g. Food"
                        value={formData.category}
                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date</label>
                <input
                    type="date"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                    value={formData.expiryDate}
                    onChange={e => setFormData({ ...formData, expiryDate: e.target.value })}
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code / Barcode</label>
                <input
                    type="text"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 font-mono text-sm outline-none"
                    placeholder="Promo Code"
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none resize-none h-20"
                    placeholder="Terms & conditions, notes..."
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-medium shadow-sm"
                >
                    Save Coupon
                </button>
            </div>
        </form>
    );
}

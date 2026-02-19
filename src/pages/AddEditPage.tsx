import { CouponForm } from '../components/CouponForm';
import type { Coupon } from '../lib/types';

interface AddEditPageProps {
    initialData?: Coupon;
    onSave: (data: Omit<Coupon, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => void;
    onCancel: () => void;
}

export function AddEditPage({ initialData, onSave, onCancel }: AddEditPageProps) {
    return (
        <div className="pb-20 pt-6 px-4 max-w-md mx-auto bg-white min-h-screen">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">
                {initialData ? 'Edit Coupon' : 'Add New Coupon'}
            </h1>
            <CouponForm
                initialData={initialData}
                onSave={onSave}
                onCancel={onCancel}
            />
        </div>
    );
}

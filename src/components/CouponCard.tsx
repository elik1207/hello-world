import { Edit2, Trash2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import type { Coupon } from '../lib/types';
import { cn, formatCurrency, formatDate, getDaysUntilExpiry } from '../lib/utils';

interface CouponCardProps {
    coupon: Coupon;
    onEdit: (coupon: Coupon) => void;
    onDelete: (coupon: Coupon) => void;
    onToggleStatus: (coupon: Coupon) => void; // Used to mark as used/active
}

export function CouponCard({ coupon, onEdit, onDelete, onToggleStatus }: CouponCardProps) {
    const daysLeft = getDaysUntilExpiry(coupon.expiryDate);
    const isExpired = daysLeft !== null && daysLeft < 0;

    // Determine badge color and label
    let badge = null;
    if (coupon.status === 'used') {
        badge = <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-medium">Used</span>;
    } else if (isExpired) {
        badge = <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1"><AlertCircle size={10} /> Expired</span>;
    } else if (daysLeft !== null && daysLeft <= 3) {
        badge = <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1"><Clock size={10} /> {daysLeft === 0 ? 'Today' : `${daysLeft}d left`}</span>;
    } else if (daysLeft !== null) {
        badge = <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs font-medium">{daysLeft}d left</span>;
    }

    return (
        <div className={cn(
            "bg-white rounded-xl p-4 shadow-sm border transition-all",
            coupon.status === 'used' || isExpired ? "border-gray-100 opacity-75" : "border-gray-200 hover:shadow-md"
        )}>
            <div className="flex justify-between items-start mb-2">
                <div>
                    <h3 className={cn("font-bold text-lg leading-tight", coupon.status === 'used' && "line-through text-gray-500")}>
                        {coupon.title}
                    </h3>
                    <div className="text-sm text-gray-500 mt-1 flex flex-wrap gap-2">
                        {coupon.store && <span className="font-medium text-gray-700">{coupon.store}</span>}
                        {coupon.category && <span className="bg-gray-50 px-1.5 rounded border border-gray-100">{coupon.category}</span>}
                    </div>
                </div>
                <div className="text-right">
                    <div className="font-bold text-xl text-blue-600">
                        {coupon.discountType === 'percent' ? `${coupon.discountValue}%` : formatCurrency(coupon.discountValue, coupon.currency)}
                    </div>
                    <div className="mt-1">{badge}</div>
                </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
                <div className="text-xs text-gray-400">
                    {coupon.expiryDate ? `Exp: ${formatDate(coupon.expiryDate)}` : 'No expiry'}
                </div>
                <div className="flex gap-2">
                    {coupon.status !== 'used' && !isExpired && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleStatus(coupon); }}
                            className="p-2 hover:bg-green-50 text-green-600 rounded-lg transition-colors"
                            title="Mark as Used"
                        >
                            <CheckCircle size={18} />
                        </button>
                    )}
                    {coupon.status === 'used' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleStatus(coupon); }}
                            className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                            title="Mark as Active"
                        >
                            <CheckCircle size={18} className="fill-blue-100" />
                        </button>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(coupon); }}
                        className="p-2 hover:bg-gray-100 text-gray-500 rounded-lg transition-colors"
                    >
                        <Edit2 size={18} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(coupon); }}
                        className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}

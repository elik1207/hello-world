import { Edit2, Trash2, CheckCircle, Clock, AlertCircle, Gift, Tag, Ticket } from 'lucide-react';
import type { Coupon } from '../lib/types';
import { cn, formatCurrency, formatDate, getDaysUntilExpiry } from '../lib/utils';

interface CouponCardProps {
    coupon: Coupon;
    onEdit: (coupon: Coupon) => void;
    onDelete: (coupon: Coupon) => void;
    onToggleStatus: (coupon: Coupon) => void;
}

export function CouponCard({ coupon, onEdit, onDelete, onToggleStatus }: CouponCardProps) {
    const daysLeft = getDaysUntilExpiry(coupon.expiryDate);
    const isExpired = daysLeft !== null && daysLeft < 0;

    let badge = null;
    let urgencyBorder = "border-l-4 border-l-status-active border-y-brand-border border-r-brand-border hover:shadow-md";

    const isGiftCard = coupon.type === 'gift_card';
    const hasRemaining = isGiftCard && coupon.remainingValue !== undefined && coupon.initialValue !== undefined;
    const isFullyUsed = hasRemaining && coupon.remainingValue! <= 0;

    if (coupon.status === 'used' || isFullyUsed) {
        badge = <span className="bg-brand-bg text-text-muted px-2 py-0.5 rounded text-xs font-medium border border-brand-border">Used</span>;
        urgencyBorder = "border-l-4 border-l-text-muted border-y-brand-border border-r-brand-border opacity-60 grayscale-[0.5]";
    } else if (isExpired) {
        badge = <span className="bg-status-expired/20 text-status-expired px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1"><AlertCircle size={10} /> Expired</span>;
        urgencyBorder = "border-l-4 border-l-status-expired border-y-brand-border border-r-brand-border opacity-75";
    } else if (daysLeft !== null && daysLeft <= 7) {
        badge = <span className="bg-status-expired/20 text-status-expired px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1"><Clock size={10} /> {daysLeft === 0 ? 'Today' : `${daysLeft}d left`}</span>;
        urgencyBorder = "border-l-4 border-l-status-expired border-y-status-expired/20 border-r-status-expired/20 hover:shadow-md";
    } else if (daysLeft !== null && daysLeft <= 30) {
        badge = <span className="bg-status-warn/20 text-status-warn px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1"><Clock size={10} /> {daysLeft}d left</span>;
        urgencyBorder = "border-l-4 border-l-status-warn border-y-status-warn/20 border-r-status-warn/20 hover:shadow-md";
    } else if (daysLeft !== null) {
        badge = <span className="bg-status-active/20 text-status-active px-2 py-0.5 rounded text-xs font-medium">{daysLeft}d left</span>;
        urgencyBorder = "border-l-4 border-l-status-active border-y-status-active/20 border-r-status-active/20 hover:shadow-md";
    }

    const Icon = coupon.type === 'gift_card' ? Gift : coupon.type === 'voucher' ? Ticket : Tag;

    return (
        <div className={cn(
            "bg-brand-surface rounded-xl p-4 shadow-sm border transition-all flex flex-col",
            urgencyBorder
        )}>
            {coupon.imageUrl && (
                <div className="w-full h-32 mb-4 bg-gray-100 rounded-lg overflow-hidden shrink-0 border border-gray-100">
                    <img src={coupon.imageUrl} alt={coupon.title} className="w-full h-full object-cover" />
                </div>
            )}

            <div className="flex justify-between items-start mb-2">
                <div className="flex-1 pr-2">
                    <div className="flex items-center gap-2 mb-1 text-text-muted">
                        <Icon size={14} />
                        <span className="text-xs font-medium uppercase tracking-wider">{coupon.type.replace('_', ' ')}</span>
                    </div>
                    <h3 className={cn("font-bold text-lg leading-tight text-text-primary", (coupon.status === 'used' || isFullyUsed) && "line-through text-text-muted")}>
                        {coupon.title}
                    </h3>
                    <div className="text-sm text-text-muted mt-1 flex flex-wrap gap-2">
                        {coupon.store && <span className="font-medium text-text-secondary">{coupon.store}</span>}
                        {coupon.category && <span className="bg-brand-bg px-1.5 rounded border border-brand-border">{coupon.category}</span>}
                    </div>
                </div>
                <div className="text-right shrink-0">
                    {isGiftCard ? (
                        <div className="flex flex-col items-end">
                            <span className="font-bold text-xl text-brand-primary">
                                {formatCurrency(coupon.remainingValue ?? coupon.initialValue ?? 0, coupon.currency)}
                            </span>
                            {hasRemaining && coupon.remainingValue! !== coupon.initialValue! && (
                                <span className="text-xs text-text-muted line-through">
                                    {formatCurrency(coupon.initialValue!, coupon.currency)}
                                </span>
                            )}
                        </div>
                    ) : (
                        <div className="font-bold text-xl text-brand-primary">
                            {coupon.discountType === 'percent' ? `${coupon.discountValue}%` : formatCurrency(coupon.discountValue || 0, coupon.currency)}
                        </div>
                    )}
                    <div className="mt-1 flex justify-end">{badge}</div>
                </div>
            </div>

            {(coupon.sender || coupon.event) && (
                <div className="mt-2 text-xs text-text-secondary flex gap-2 items-center bg-brand-bg p-2 rounded-lg border border-brand-border">
                    {coupon.sender && <span>From: <span className="font-medium text-text-primary">{coupon.sender}</span></span>}
                    {coupon.sender && coupon.event && <span>•</span>}
                    {coupon.event && <span>For: <span className="font-medium text-text-primary">{coupon.event}</span></span>}
                </div>
            )}

            {coupon.barcodeData && (
                <div className="mt-3 py-2 px-3 bg-brand-bg rounded-lg flex flex-col items-center justify-center border border-brand-border">
                    <div className="w-full h-8 flex justify-between space-x-[2px] mb-1 px-4 opacity-50">
                        {/* Fake barcode lines for aesthetic purposes */}
                        {Array.from({ length: 20 }).map((_, i) => (
                            <div key={i} className="flex-1 bg-text-secondary" style={{ opacity: Math.random() > 0.5 ? 1 : 0.3, width: `${Math.random() * 4 + 1}px` }} />
                        ))}
                    </div>
                    <span className="font-mono text-xs tracking-widest text-text-muted font-medium">{coupon.barcodeData}</span>
                </div>
            )}

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-brand-border">
                <div className="text-xs text-text-muted">
                    {coupon.expiryDate ? `Exp: ${formatDate(coupon.expiryDate)}` : 'No expiry'}
                </div>
                <div className="flex gap-2">
                    {coupon.status !== 'used' && !isExpired && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleStatus(coupon); }}
                            className="p-2 hover:bg-status-active/20 text-status-active rounded-lg transition-colors"
                            title="Mark as Used"
                        >
                            <CheckCircle size={18} />
                        </button>
                    )}
                    {coupon.status === 'used' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleStatus(coupon); }}
                            className="p-2 hover:bg-brand-primary/20 text-brand-primary rounded-lg transition-colors"
                            title="Mark as Active"
                        >
                            <CheckCircle size={18} />
                        </button>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(coupon); }}
                        className="p-2 hover:bg-brand-bg text-text-secondary rounded-lg transition-colors"
                    >
                        <Edit2 size={18} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(coupon); }}
                        className="p-2 hover:bg-status-expired/20 text-status-expired rounded-lg transition-colors"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}

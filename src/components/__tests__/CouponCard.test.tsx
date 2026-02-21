import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { CouponCard } from '../CouponCard';
import { Coupon } from '../../lib/types';

// Mock Lucide icons
jest.mock('lucide-react', () => ({
    Edit2: () => 'EditIcon',
    Trash2: () => 'TrashIcon',
    CheckCircle: () => 'CheckIcon',
    Clock: () => 'ClockIcon',
    AlertCircle: () => 'AlertIcon',
    Gift: () => 'GiftIcon',
    Tag: () => 'TagIcon',
    Ticket: () => 'TicketIcon',
}));

// Mock utils
jest.mock('../../lib/utils', () => ({
    cn: (...args: any[]) => args.join(' '),
    formatCurrency: (val: number) => `$${val}`,
    formatDate: (date: string) => date,
    getDaysUntilExpiry: jest.fn(),
}));

import { getDaysUntilExpiry } from '../../lib/utils';

describe('CouponCard', () => {
    const mockCoupon: Coupon = {
        id: '1',
        type: 'coupon',
        currency: 'ILS',
        title: 'Test Coupon',
        code: 'TEST10',
        description: '10% off',
        discountValue: 10,
        discountType: 'percent',
        expiryDate: '2023-12-31',
        status: 'active',
        createdAt: 1234567890,
        updatedAt: 1234567890,
    };

    const mockProps = {
        coupon: mockCoupon,
        onEdit: jest.fn(),
        onDelete: jest.fn(),
        onToggleStatus: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (getDaysUntilExpiry as jest.Mock).mockReturnValue(10);
    });

    it('renders correctly', () => {
        let tree: any;
        act(() => {
            tree = renderer.create(<CouponCard {...mockProps} />);
        });
        expect(tree.toJSON()).toMatchSnapshot();
    });

    it('renders correctly when used', () => {
        const usedCoupon = { ...mockCoupon, status: 'used' as const };
        let tree: any;
        act(() => {
            tree = renderer.create(<CouponCard {...mockProps} coupon={usedCoupon} />);
        });
        expect(tree.toJSON()).toMatchSnapshot();
    });

    it('renders correctly when expired', () => {
        (getDaysUntilExpiry as jest.Mock).mockReturnValue(-1);
        let tree: any;
        act(() => {
            tree = renderer.create(<CouponCard {...mockProps} />);
        });
        expect(tree.toJSON()).toMatchSnapshot();
    });
});

export type {
  Business,
  Offer,
  OfferWithBusiness,
  RegisterBusinessRequest,
  UpdateBusinessProfileRequest,
  CreateOfferRequest,
  UpdateOfferRequest,
  CouponView,
} from '@trentino-quest/shared-types';

/**
 * CouponRedeemInfo — info del coupon restituita all'esercente prima del
 * riscatto (GET /market/business/redeem/{token}).
 *
 * Schema definito in docs/swagger.yaml ma non ancora presente in
 * shared-types: lo dichiariamo localmente finché non viene esportato.
 */
export interface CouponRedeemInfo {
  token: string;
  status: 'active' | 'redeemed' | 'expired';
  expiresAt: string;
  offerTitle: string;
  businessName: string;
  redeemedAt?: string | null;
}

export { BusinessType, OfferStatus, BusinessApprovalStatus } from '@trentino-quest/shared-types';

import { BusinessType } from '@trentino-quest/shared-types';

/** Mappa BusinessType -> etichetta italiana per la UI. */
export const BUSINESS_TYPE_LABEL: Record<BusinessType, string> = {
  [BusinessType.RESTAURANT]: 'Ristorante',
  [BusinessType.MUSEUM]: 'Museo',
  [BusinessType.FARM_STAY]: 'Agriturismo',
  [BusinessType.MOUNTAIN_HUT]: 'Rifugio',
  [BusinessType.OTHER]: 'Altro',
};

export type {
  Business,
  Offer,
  OfferWithBusiness,
  RegisterBusinessRequest,
  UpdateBusinessProfileRequest,
  CreateOfferRequest,
  UpdateOfferRequest,
} from '@trentino-quest/shared-types';

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

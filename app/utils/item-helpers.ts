import { PointAudit } from '@prisma/client';
import { OSRSItem } from '~/services/osrs-wiki-prices-service';
import { untradeableItems } from './untradable-items';
import { toTitleCase } from './string-helpers';

interface AuditWithOsrsItem extends PointAudit {
  osrsData: OSRSItem | null;
}

export const displayItemText = (item: AuditWithOsrsItem): string => {
  if (item?.itemId !== null && item?.itemId !== undefined && !isNaN(item?.itemId)) {
    const untradableItem = untradeableItems[item?.itemId ?? -100];
    if (!untradableItem) {
      console.error(
        `No item name found for itemId: ${item?.itemId} for userId: ${item.destinationDiscordId}`,
      );
      return `Item ID: ${item.itemId}`;
    }

    return toTitleCase(untradableItem);
  }
  return 'No Item ID found';
};

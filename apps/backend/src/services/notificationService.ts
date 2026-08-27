import { db } from '../db/client';
import type { NotificationType } from '../db/types';

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  await db
    .insertInto('notifications')
    .values({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      related_entity_type: input.relatedEntityType ?? null,
      related_entity_id: input.relatedEntityId ?? null,
    })
    .execute();
}

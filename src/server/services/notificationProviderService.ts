import type { ApiResponse } from '$lib/response';
import type {
  CreateNotificationProvider,
  NotificationChannel,
  NotificationProviderType,
  NotificationProviderWithParsedConfig,
  UpdateNotificationProvider
} from '$lib/domain/notification-provider';
import {
  createNotificationProviderSchema,
  notificationProviderConfigSchema,
  notificationProviderChannelsSchema,
  notificationProviderTypeSchema,
  updateNotificationProviderSchema
} from '$lib/domain/notification-provider';
import logger from '$server/config/logger';
import { db } from '$server/db';
import * as schema from '$server/db/schema';
import { AppError, Status } from '$server/exceptions/AppError';
import { decrypt, encrypt } from '$server/utils/encryption';
import { eq } from 'drizzle-orm';
import * as m from '$lib/paraglide/messages';
import { resolveUpdatedConfig } from './notification-provider-service.helper';
import { createSuccessResponse, requireRecord } from './service-response.helper';

type ProviderRecord = typeof schema.notificationProviderTable.$inferSelect;

function parseChannels(rawChannels: string): NotificationChannel[] {
  try {
    return notificationProviderChannelsSchema.parse(JSON.parse(rawChannels));
  } catch (error) {
    logger.error('Failed to parse provider channels', { rawChannels, error });
    throw new AppError(m.notif_error_invalid_channels(), Status.INTERNAL_SERVER_ERROR);
  }
}

function parseProvider(provider: ProviderRecord): NotificationProviderWithParsedConfig {
  try {
    const config = notificationProviderConfigSchema.parse(decrypt(provider.config));
    const channels = parseChannels(provider.channels);
    const type = notificationProviderTypeSchema.parse(provider.type) as NotificationProviderType;

    return {
      ...provider,
      type,
      config,
      channels
    };
  } catch (error) {
    logger.error('Failed to parse provider config', {
      providerId: provider.id,
      error
    });
    throw new AppError(m.notif_error_invalid_config(), Status.INTERNAL_SERVER_ERROR);
  }
}

async function getProviderRecord(providerId: string): Promise<ProviderRecord> {
  const provider = await db.query.notificationProviderTable.findFirst({
    where: (providers, { eq }) => eq(providers.id, providerId)
  });

  return requireRecord(provider, m.notif_error_provider_not_found());
}

export const getProvidersByUserId = async (): Promise<ApiResponse> => {
  const providers = await db.query.notificationProviderTable.findMany({
    orderBy: (providers, { desc }) => [desc(providers.created_at)]
  });

  return createSuccessResponse(providers.map(parseProvider), m.notif_providers_fetched());
};

export const getProviderById = async (providerId: string): Promise<ApiResponse> => {
  const provider = await getProviderRecord(providerId);

  return createSuccessResponse(parseProvider(provider), m.notif_provider_fetched());
};

export const addProvider = async (
  providerData: CreateNotificationProvider
): Promise<ApiResponse> => {
  const validated = createNotificationProviderSchema.parse(providerData);
  const validatedConfig = notificationProviderConfigSchema.parse(validated.config);

  const [provider] = await db
    .insert(schema.notificationProviderTable)
    .values({
      name: validated.name,
      type: validated.type,
      config: encrypt(validatedConfig),
      channels: JSON.stringify(validated.channels),
      isEnabled: validated.isEnabled
    })
    .returning();

  if (!provider) {
    throw new AppError(m.notif_provider_create_failed(), Status.INTERNAL_SERVER_ERROR);
  }

  return createSuccessResponse(parseProvider(provider), m.notif_provider_created());
};

export const updateProvider = async (
  providerId: string,
  providerData: UpdateNotificationProvider
): Promise<ApiResponse> => {
  const validated = updateNotificationProviderSchema.parse(providerData);
  const existingProvider = await getProviderRecord(providerId);

  const updateData: Partial<typeof schema.notificationProviderTable.$inferInsert> = {};

  if (validated.name !== undefined) updateData.name = validated.name;
  if (validated.isEnabled !== undefined) updateData.isEnabled = validated.isEnabled;
  if (validated.channels !== undefined) updateData.channels = JSON.stringify(validated.channels);

  if (validated.config !== undefined) {
    const existingConfig = notificationProviderConfigSchema.parse(decrypt(existingProvider.config));
    const mergedConfig = resolveUpdatedConfig(existingConfig, validated.config);
    updateData.config = encrypt(notificationProviderConfigSchema.parse(mergedConfig));
  }

  const [updatedProvider] = await db
    .update(schema.notificationProviderTable)
    .set(updateData)
    .where(eq(schema.notificationProviderTable.id, providerId))
    .returning();

  if (!updatedProvider) {
    throw new AppError(m.notif_provider_update_failed(), Status.INTERNAL_SERVER_ERROR);
  }

  return createSuccessResponse(parseProvider(updatedProvider), m.notif_provider_updated());
};

export const deleteProvider = async (providerId: string): Promise<ApiResponse> => {
  await getProviderRecord(providerId);

  await db
    .delete(schema.notificationProviderTable)
    .where(eq(schema.notificationProviderTable.id, providerId));

  return createSuccessResponse(null, m.notif_provider_deleted());
};

export const getEnabledProvidersForChannels = async (channels: NotificationChannel[]) => {
  const providers = await db.query.notificationProviderTable.findMany({
    where: (provider, { eq }) => eq(provider.isEnabled, true)
  });

  return providers
    .map(parseProvider)
    .filter((provider) => provider.channels.some((channel) => channels.includes(channel)));
};

export const getEnabledProvidersByType = async (type: string) => {
  const providers = await db.query.notificationProviderTable.findMany({
    where: (provider, { and, eq }) => and(eq(provider.type, type), eq(provider.isEnabled, true))
  });

  return providers.map(parseProvider);
};

export const getEnabledProvidersByIds = async (providerIds: string[]) => {
  if (providerIds.length === 0) {
    return [];
  }

  const providers = await db.query.notificationProviderTable.findMany({
    where: (provider, { and, eq, inArray }) =>
      and(eq(provider.isEnabled, true), inArray(provider.id, providerIds))
  });

  return providers.map(parseProvider);
};

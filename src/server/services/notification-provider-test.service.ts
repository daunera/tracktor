import type {
  EmailProviderConfig,
  GotifyProviderConfig,
  NotificationProviderWithParsedConfig,
  WebhookProviderConfig
} from '$lib/domain/notification-provider';
import { AppError, Status } from '$server/exceptions/AppError';

import { buildWebhookHeaders } from './notification-provider-http.helper';
import { testEmailProvider } from './emailNotificationService';
import * as m from '$lib/paraglide/messages';

export type NotificationProviderTestResult = {
  success: boolean;
  error?: string;
};

type NotificationProviderTestOptions = {
  testEmail?: string;
  testMessage?: string;
};

const DEFAULT_TEST_MESSAGE = m.notif_test_default_message();

async function testWebhookProvider(
  config: WebhookProviderConfig,
  testMessage: string
): Promise<NotificationProviderTestResult> {
  try {
    const response = await fetch(config.url, {
      method: config.method,
      headers: buildWebhookHeaders(config),
      body: JSON.stringify({
        title: m.notif_test_title(),
        message: testMessage,
        timestamp: new Date().toISOString(),
        test: true
      })
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    return { success: true };
  } catch (error) {
    const err = error as Error;

    return {
      success: false,
      error: err.message || m.notif_error_test_webhook_failed()
    };
  }
}

async function testGotifyProvider(
  config: GotifyProviderConfig,
  testMessage: string
): Promise<NotificationProviderTestResult> {
  try {
    const response = await fetch(`${config.serverUrl}/message?token=${config.appToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: m.notif_test_title(),
        message: testMessage,
        priority: config.priority
      })
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    return { success: true };
  } catch (error) {
    const err = error as Error;

    return {
      success: false,
      error: err.message || m.notif_error_test_gotify_failed()
    };
  }
}

export async function testNotificationProvider(
  provider: NotificationProviderWithParsedConfig,
  options: NotificationProviderTestOptions = {}
): Promise<NotificationProviderTestResult> {
  const testMessage = options.testMessage || DEFAULT_TEST_MESSAGE;

  switch (provider.config.type) {
    case 'email':
      return testEmailProvider(provider.config as EmailProviderConfig, options.testEmail);
    case 'webhook':
      return testWebhookProvider(provider.config as WebhookProviderConfig, testMessage);
    case 'gotify':
      return testGotifyProvider(provider.config as GotifyProviderConfig, testMessage);
    default:
      throw new AppError(m.notif_error_test_unsupported(), Status.BAD_REQUEST);
  }
}

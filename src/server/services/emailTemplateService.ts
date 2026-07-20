import type { Notification } from '$lib/domain/notification';
import { env } from '$lib/config/env.server';
import * as m from '$lib/paraglide/messages';

export interface NotificationGroup {
  type: string;
  notifications: Notification[];
  label: string;
  color: string;
}

/**
 * Group notifications by type
 */
export function groupNotifications(notifications: Notification[]): NotificationGroup[] {
  const groups: Record<string, Notification[]> = {};

  notifications.forEach((notification) => {
    if (!groups[notification.type]) {
      groups[notification.type] = [];
    }
    groups[notification.type].push(notification);
  });

  return Object.entries(groups).map(([type, notifs]) => ({
    type,
    notifications: notifs,
    ...getTypeMetadata(type)
  }));
}

/**
 * Get metadata for notification type (label, icon, colors)
 */
function getTypeMetadata(type: string): {
  label: string;
  color: string;
} {
  const metadata: Record<string, { label: string; color: string }> = {
    reminder: {
      label: m.notif_type_label_reminders(),
      color: '#2563eb'
    },
    alert: {
      label: m.notif_type_label_alerts(),
      color: '#dc2626'
    },
    information: {
      label: m.notif_type_label_information(),
      color: '#0284c7'
    },
    maintenance: {
      label: m.notif_type_label_maintenance(),
      color: '#7c3aed'
    },
    insurance: {
      label: m.notif_type_label_insurance(),
      color: '#059669'
    },
    pollution: {
      label: m.notif_type_label_pollution(),
      color: '#0891b2'
    },
    registration: {
      label: m.notif_type_label_registration(),
      color: '#ea580c'
    }
  };

  return (
    metadata[type] || {
      label: type.charAt(0).toUpperCase() + type.slice(1),
      color: '#6b7280'
    }
  );
}

/**
 * Format a date in a human-readable format
 */
function formatDate(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Calculate days until due date
 */
function getDaysUntilDue(dueDate: string | Date): {
  days: number;
  label: string;
  urgent: boolean;
} {
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const now = new Date();
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      days: diffDays,
      label: m.notif_due_overdue({ days: Math.abs(diffDays) }),
      urgent: true
    };
  }

  if (diffDays === 0) {
    return { days: diffDays, label: m.notif_due_today(), urgent: true };
  }

  if (diffDays === 1) {
    return { days: diffDays, label: m.notif_due_tomorrow(), urgent: true };
  }

  if (diffDays <= 7) {
    return {
      days: diffDays,
      label: m.notif_due_remaining({ days: diffDays }),
      urgent: true
    };
  }

  return { days: diffDays, label: m.notif_due_remaining({ days: diffDays }), urgent: false };
}

/**
 * Generate plain text email content for notification digest
 */
export function generatePlainTextDigest(
  notificationGroups: NotificationGroup[],
  totalCount: number
): string {
  let text = `${m.notif_digest_title()}\n`;
  text += `=====================================\n`;
  text += `${m.notif_digest_pending({ count: totalCount })}\n\n`;

  notificationGroups.forEach((group) => {
    text += `${group.label} (${group.notifications.length})\n`;
    text += `${'-'.repeat(40)}\n`;

    group.notifications.forEach((notification, index) => {
      const daysInfo = getDaysUntilDue(notification.dueDate);
      text += `${index + 1}. ${notification.message}\n`;
      text += `   ${m.notif_digest_type({ label: group.label })}\n`;
      text += `   ${m.notif_digest_due({ date: formatDate(notification.dueDate) })}\n`;
      text += `   ${m.notif_digest_status({ status: daysInfo.label })}\n`;
      if (index < group.notifications.length - 1) {
        text += '\n';
      }
    });

    text += '\n\n';
  });

  text += `=====================================\n`;
  text += `${m.notif_digest_footer()}\n`;

  return text;
}

/**
 * Generate HTML email content for notification digest
 * Optimized for mobile email clients (Gmail, Outlook, Apple Mail, etc.)
 */
export function generateHtmlDigest(
  notificationGroups: NotificationGroup[],
  totalCount: number
): string {
  const groupsHtml = notificationGroups
    .map((group) => {
      const notificationsHtml = group.notifications
        .map((notification, index) => {
          const daysInfo = getDaysUntilDue(notification.dueDate);
          return `${index + 1}. ${escapeHtml(notification.message)}<br>${m.notif_digest_due({ date: formatDate(notification.dueDate) })}<br>${m.notif_digest_status({ status: escapeHtml(daysInfo.label) })}`;
        })
        .join('<br><br>');

      return `<strong>${escapeHtml(group.label)} (${group.notifications.length})</strong><br>${notificationsHtml}`;
    })
    .join('<br><br>');

  const appUrl = env.BASE_URL || '';
  const appLinkHtml = appUrl ? `<a href="${escapeHtml(appUrl)}">Open Tracktor</a><br><br>` : '';

  const digestTitle = m.notif_digest_title();

  return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${escapeHtml(digestTitle)}</title>
</head>
<body style="font-family: Arial, Helvetica, sans-serif; color: #111827; line-height: 1.6;">
	<strong>${escapeHtml(digestTitle)}</strong><br>
	${m.notif_digest_pending({ count: totalCount })}<br><br>
	${groupsHtml}<br><br>
	${appLinkHtml}
	${m.notif_digest_auto()}
</body>
</html>`;
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

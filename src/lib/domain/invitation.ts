export interface Invitation {
  id: string;
  email: string;
  invitedBy: string;
  vehicleId: string | null;
  role: 'viewer' | 'editor' | null;
  status: 'pending' | 'fulfilled' | 'expired';
  createdAt: string;
  updatedAt: string;
}

export interface PendingInvitationListItem {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  role: 'viewer' | 'editor';
  createdAt: string;
}

export interface PendingAppInvitationListItem {
  id: string;
  email: string;
  invitedBy: string;
  invitedByName: string | null;
  invitedByUsername: string | null;
  createdAt: string;
}

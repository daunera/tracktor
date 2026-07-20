export interface Invitation {
  id: string;
  email: string;
  invitedBy: string;
  vehicleId: string;
  role: 'viewer' | 'editor';
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

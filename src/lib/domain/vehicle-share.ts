export interface VehicleShare {
  id: string;
  vehicleId: string;
  userId: string;
  role: 'viewer' | 'editor';
  createdAt: string;
  updatedAt: string;
}

export interface VehicleShareWithUser {
  id: string;
  userId: string;
  username: string;
  name: string | null;
  email: string | null;
  role: 'viewer' | 'editor';
  createdAt: string;
}

export interface VehicleShareForUser {
  id: string;
  userId: string;
  role: 'viewer' | 'editor';
  createdAt: string;
}

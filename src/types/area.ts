export interface Area {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder: number;
  archivedAt?: number;
  revision?: number;
  createdAt?: number;
  updatedAt?: number;
}

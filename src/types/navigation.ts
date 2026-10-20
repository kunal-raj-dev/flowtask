import type { ViewId as BaseViewId } from './task';

export type ViewId = BaseViewId | 'dashboard';

export interface NavigationItem {
  id: ViewId;
  label: string;
  icon?: string;
  badgeCount?: number;
}

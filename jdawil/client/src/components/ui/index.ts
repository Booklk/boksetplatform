/**
 * Single entry point for the design-system primitives. Prefer
 *    import { Button, Card, Input } from '@/components/ui';
 * over deep imports — it keeps refactors cheap.
 */

export { Button } from './Button';
export type { ButtonProps } from './Button';

export { Card, CardHeader, CardTitle, CardDescription, CardFooter } from './Card';
export type { CardProps } from './Card';

export { Input } from './Input';
export type { InputProps } from './Input';

export { Badge } from './Badge';
export type { BadgeProps } from './Badge';

export { Stat } from './Stat';
export type { StatProps } from './Stat';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { PageHeader } from './PageHeader';
export type { PageHeaderProps } from './PageHeader';

export { Skeleton, SkeletonText, SkeletonCard, SkeletonTable, SkeletonStat } from './Skeleton';

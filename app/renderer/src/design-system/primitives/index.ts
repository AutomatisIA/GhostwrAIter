/*
 * Barrel des primitives du design system (feature 010).
 * Re-exporte chaque primitive et ses types de props.
 * Le feedback (ToastProvider/useToast) vit dans `../../feedback` : il est
 * re-exporte ici par commodite pour offrir une surface d'import unique.
 */
export { Button } from "./Button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./Button";

export { Card } from "./Card";
export type { CardProps } from "./Card";

export { Field } from "./Field";
export type { FieldProps } from "./Field";

export { Tabs } from "./Tabs";
export type { TabsProps, TabItem } from "./Tabs";

export { Stepper } from "./Stepper";
export type { StepperProps, StepDescriptor, StepState } from "./Stepper";

export { Skeleton } from "./Skeleton";
export type { SkeletonProps } from "./Skeleton";

export { Tooltip } from "./Tooltip";
export type { TooltipProps } from "./Tooltip";

export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";

export { ConfirmDialog } from "./ConfirmDialog";
export type { ConfirmDialogProps } from "./ConfirmDialog";

export { AiProgress } from "./AiProgress";
export type { AiProgressProps } from "./AiProgress";

export {
  CheckCircleIcon,
  AlertTriangleIcon,
  XCircleIcon,
  LightbulbIcon,
  PencilIcon,
  CalendarIcon
} from "./icons";
export type { IconProps } from "./icons";

// Feedback (toasts) : surface unique re-exportee depuis feedback/.
export { ToastProvider } from "../../feedback/ToastProvider";
export { useToast } from "../../feedback/toast-context";
export type { Toast, ToastKind, ToastApi } from "../../feedback/toast-context";

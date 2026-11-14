import {
  ArrowLeft,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CircleX,
  ClipboardList,
  Clock,
  Copy,
  Info,
  Layers,
  LayoutDashboard,
  Loader,
  LogOut,
  Menu,
  Package,
  Pencil,
  Plus,
  Search,
  Send,
  SlidersHorizontal,
  Trash2,
  Truck,
  X,
} from "lucide-react";

/** Ukuran dan garis ikon seragam (Figcraft: 16 px, garis 1.5). Ikon dekoratif disembunyikan dari pembaca layar. */
export const iconProps = { size: 16, strokeWidth: 1.5, "aria-hidden": true } as const;

export const NAV_ICON = {
  dashboard: LayoutDashboard,
  inventory: Layers,
  suppliers: Truck,
  procurement: ClipboardList,
  receiving: Package,
  settings: SlidersHorizontal,
} as const;

export const ACTION_ICON = {
  add: Plus,
  back: ArrowLeft,
  close: X,
  copy: Copy,
  delete: Trash2,
  edit: Pencil,
  expand: ChevronDown,
  next: ChevronRight,
  help: CircleHelp,
  info: Info,
  menu: Menu,
  signOut: LogOut,
} as const;

/** Ikon lencana status procurement request (SUPPLIO.md §2; label di `lib/ui/status.ts`). */
export const REQUEST_STATUS_ICON = {
  CONFIGURATION_REQUIRED: CircleAlert,
  DRAFT: Pencil,
  SOURCING: Search,
  AWAITING_RESPONSES: Clock,
  OPTIMIZING: Loader,
  AWAITING_APPROVAL: Bell,
  APPROVED: CircleCheck,
  ORDERED: Send,
  PARTIALLY_RECEIVED: Package,
  COMPLETED: Check,
  NO_FEASIBLE_SOLUTION: CircleX,
  CANCELLED: X,
  EXPIRED: Clock,
} as const;

export const PO_STATUS_ICON = {
  CREATED: Pencil,
  SENT: Send,
  PARTIALLY_RECEIVED: Package,
  RECEIVED: Check,
  CANCELLED: X,
} as const;

export const PRODUCT_STATUS_ICON = {
  safe: CircleCheck,
  restock: CircleAlert,
  processing: Loader,
  stockout: CircleAlert,
  incomplete: Pencil,
} as const;

export const SUPPLIER_STATUS_ICON = {
  active: CircleCheck,
  inactive: X,
  telegramConnected: Send,
  telegramDisconnected: Send,
} as const;

/**
 * Bookmark icons. Keys are the stored ids (3.x ids stay valid); each maps to a Strapi icon.
 */
import {
  Bell,
  Book,
  Briefcase,
  Calendar,
  ChartPie,
  CheckCircle,
  Clock,
  Code,
  Cog,
  Feather,
  File,
  Filter,
  Folder,
  Gift,
  Globe,
  Heart,
  House,
  Image,
  Lightning,
  Link,
  Mail,
  Pencil,
  PriceTag,
  PuzzlePiece,
  Rocket,
  Search,
  Sparkle,
  Stack,
  Star,
  TrendUp,
  User,
} from '@strapi/icons';
import type { ComponentType, SVGProps } from 'react';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/** Icons offered in the picker, in display order. */
export const ICON_OPTIONS: { key: string; Icon: IconComponent }[] = [
  { key: 'bookmark', Icon: Book },
  { key: 'star', Icon: Star },
  { key: 'heart', Icon: Heart },
  { key: 'bolt', Icon: Lightning },
  { key: 'rocket', Icon: Rocket },
  { key: 'sparkles', Icon: Sparkle },
  { key: 'pencil', Icon: Pencil },
  { key: 'document', Icon: File },
  { key: 'folder', Icon: Folder },
  { key: 'photo', Icon: Image },
  { key: 'link', Icon: Link },
  { key: 'tag', Icon: PriceTag },
  { key: 'filter', Icon: Filter },
  { key: 'search', Icon: Search },
  { key: 'calendar', Icon: Calendar },
  { key: 'clock', Icon: Clock },
  { key: 'bell', Icon: Bell },
  { key: 'check', Icon: CheckCircle },
  { key: 'mail', Icon: Mail },
  { key: 'user', Icon: User },
  { key: 'briefcase', Icon: Briefcase },
  { key: 'gift', Icon: Gift },
  { key: 'globe', Icon: Globe },
  { key: 'home', Icon: House },
  { key: 'flag', Icon: Feather },
  { key: 'fire', Icon: TrendUp },
  { key: 'cube', Icon: Stack },
  { key: 'cog', Icon: Cog },
  { key: 'wrench', Icon: PuzzlePiece },
  { key: 'terminal', Icon: Code },
  { key: 'chart', Icon: ChartPie },
];

/** 3.x ids that share an icon with an offered key. */
const ALIASES: Record<string, string> = { book: 'bookmark', users: 'user' };

const BY_KEY = new Map(ICON_OPTIONS.map((option) => [option.key, option.Icon]));

/**
 * Icon component for a stored key; unknown keys fall back to the bookmark icon.
 * @param key - Stored icon key.
 */
export const getIcon = (key: string | null | undefined): IconComponent =>
  BY_KEY.get(ALIASES[key ?? ''] ?? key ?? '') ?? Book;

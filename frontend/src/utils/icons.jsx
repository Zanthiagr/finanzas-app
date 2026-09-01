// Mapa centralizado: nombre de ícono Tabler (usado antes como clase CSS
// "ti ti-x") → componente lucide-react equivalente. Único punto de verdad
// para la migración de íconos — si hace falta un ícono nuevo, agregarlo
// aquí (no importar lucide-react suelto en cada archivo con nombres
// distintos, para no terminar con 3 formas de referirse al mismo ícono).
import {
  AlertCircle, AlertTriangle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp,
  ArrowUpRight, ArrowLeftRight, Shuffle, BellRing, Brain, Briefcase,
  Landmark, Store, Bus, Calculator, Calendar, CalendarCheck, CalendarClock,
  CalendarDays, CalendarX, CalendarPlus, CalendarSync, CalendarRange, Car,
  Banknote, Award, BarChart3, CandlestickChart, LineChart, Check,
  ChevronLeft, ChevronRight, ChevronUp, Coins, CreditCard, Laptop, Tv,
  MoreHorizontal, Download, Eye, EyeOff, FileDown, Flag, Flame, Hand,
  Heart, HeartPulse, Home, Inbox, Info, LayoutDashboard, Link as LinkIcon,
  Loader2, LogOut, NotebookPen, Pencil, Percent, Plane, Plus, Quote,
  Receipt, RefreshCw, Repeat, Bot, Scale, GraduationCap, Send, Shield,
  Shirt, ShoppingCart, Sparkles, Tag, Target, Trash2, TrendingDown,
  TrendingUp, UserCircle, Wallet, Wifi, X,
} from 'lucide-react';

export const ICONOS = {
  'alert-circle': AlertCircle,
  'alert-triangle': AlertTriangle,
  'arrow-down': ArrowDown,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'arrow-up': ArrowUp,
  'arrow-up-right': ArrowUpRight,
  'arrows-exchange': ArrowLeftRight,
  'arrows-random': Shuffle,
  'bell-ringing': BellRing,
  'brain': Brain,
  'briefcase': Briefcase,
  'building-bank': Landmark,
  'building-store': Store,
  'bus': Bus,
  'calculator': Calculator,
  'calendar': Calendar,
  'calendar-check': CalendarCheck,
  'calendar-event': CalendarClock,
  'calendar-month': CalendarDays,
  'calendar-off': CalendarX,
  'calendar-plus': CalendarPlus,
  'calendar-repeat': CalendarSync,
  'calendar-stats': CalendarRange,
  'car': Car,
  'cash': Banknote,
  'cash-banknote': Banknote,
  'certificate': Award,
  'chart-bar-off': BarChart3,
  'chart-candle': CandlestickChart,
  'chart-line': LineChart,
  'check': Check,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  'coin': Coins,
  'credit-card': CreditCard,
  'device-laptop': Laptop,
  'device-tv': Tv,
  'dots': MoreHorizontal,
  'download': Download,
  'eye': Eye,
  'eye-off': EyeOff,
  'file-download': FileDown,
  'flag': Flag,
  'flame': Flame,
  'hand-stop': Hand,
  'heart': Heart,
  'heart-rate-monitor': HeartPulse,
  'home': Home,
  'inbox': Inbox,
  'info-circle': Info,
  'layout-dashboard': LayoutDashboard,
  'link': LinkIcon,
  'loader': Loader2,
  'logout': LogOut,
  'notebook': NotebookPen,
  'pencil': Pencil,
  'percentage': Percent,
  'plane': Plane,
  'plus': Plus,
  'quote': Quote,
  'receipt': Receipt,
  'refresh': RefreshCw,
  'repeat': Repeat,
  'robot': Bot,
  'scale': Scale,
  'school': GraduationCap,
  'send': Send,
  'shield': Shield,
  'shirt': Shirt,
  'shopping-cart': ShoppingCart,
  'sparkles': Sparkles,
  'tag': Tag,
  'target': Target,
  'trash': Trash2,
  'trending-down': TrendingDown,
  'trending-up': TrendingUp,
  'user-circle': UserCircle,
  'wallet': Wallet,
  'wifi': Wifi,
  'x': X,
};

/**
 * Ícono genérico por nombre (sin el prefijo "ti-"). Reemplaza el patrón
 * viejo `<i className="ti ti-plus"/>`.
 * Uso: <Icon name="plus" className="w-5 h-5"/>
 */
export default function Icon({ name, className = '', size, strokeWidth, style }) {
  const key = (name || '').replace(/^ti-/, '');
  const Cmp = ICONOS[key];
  if (!Cmp) {
    if (import.meta.env?.DEV) console.warn(`Icon: "${name}" no existe en el mapa de iconos.jsx`);
    return null;
  }
  return <Cmp className={className} size={size} strokeWidth={strokeWidth} style={style}/>;
}

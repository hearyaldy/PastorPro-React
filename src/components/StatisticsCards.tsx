import { Activity, CalendarDays, CheckCircle2, Coins, MapPin, Users, type LucideIcon } from 'lucide-react';

export interface StatisticItem {
  label: string;
  value: string | number;
  icon?: 'activity' | 'calendar' | 'check' | 'money' | 'distance' | 'people';
  color?: 'blue' | 'orange' | 'green' | 'purple' | 'teal';
  hint?: string;
}
const icons: Record<NonNullable<StatisticItem['icon']>, LucideIcon> = {
  activity: Activity, calendar: CalendarDays, check: CheckCircle2, money: Coins, distance: MapPin, people: Users,
};
const colors = { blue: '#2563eb', orange: '#ea580c', green: '#16a34a', purple: '#9333ea', teal: '#0d9488' };

/** Mirrors Flutter's rounded cards, centered coloured icons, and prominent totals. */
export function StatisticsCards({ items, featured = false }: { items: StatisticItem[]; featured?: boolean }) {
  return <div className={`statistics-cards ${featured ? 'statistics-featured' : ''}`}>
    {items.map((item) => {
      const Icon = icons[item.icon || 'activity'];
      return <div key={item.label} className="statistics-card" style={{ '--stat-color': colors[item.color || 'blue'] } as React.CSSProperties}>
        <Icon aria-hidden="true" size={28} strokeWidth={1.8} />
        <div className="statistics-value">{item.value}</div>
        <div className="statistics-label">{item.label}</div>
        {item.hint && <div className="statistics-hint">{item.hint}</div>}
      </div>;
    })}
  </div>;
}

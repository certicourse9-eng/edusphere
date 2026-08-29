import styles from './analytics.module.css';

export interface TooltipState {
  x: number;
  y: number;
  value: string;
  label: string;
  swatch?: string;
}

export default function ChartTooltip({ tip }: { tip: TooltipState | null }) {
  if (!tip) return null;
  return (
    <div className={styles.tooltip} style={{ left: tip.x, top: tip.y }}>
      <div className={styles.tooltipRow}>
        {tip.swatch && <span className={styles.tooltipKey} style={{ background: tip.swatch }} />}
        <span className={styles.tooltipValue}>{tip.value}</span>
      </div>
      <div className={styles.tooltipLabel}>{tip.label}</div>
    </div>
  );
}

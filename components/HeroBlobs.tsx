import styles from './HeroBlobs.module.css';

export default function HeroBlobs() {
  return (
    <div className={styles.wrap} aria-hidden="true">
      <span className={`${styles.blob} ${styles.a}`} />
      <span className={`${styles.blob} ${styles.b}`} />
      <span className={`${styles.blob} ${styles.c}`} />
    </div>
  );
}

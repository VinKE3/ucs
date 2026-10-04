'use client';

import React from 'react';
import styles from '@/app/admin/admin.module.css';
import type { StatsData } from '@/types/admin';

interface AdminStatsCardsProps {
  stats: StatsData;
  cursosCount: number;
}

export const AdminStatsCards: React.FC<AdminStatsCardsProps> = ({ stats, cursosCount }) => {
  return (
    <section className={styles.statsGrid}>
      <div className={styles.statCard}>
        <div className={styles.statIconWrapper} style={{ background: 'rgba(0, 180, 216, 0.15)', color: '#00b4d8' }}>
          📍
        </div>
        <div className={styles.statInfo}>
          <span className={styles.statNumber}>{stats.sedes}</span>
          <span className={styles.statLabel}>Sedes</span>
        </div>
      </div>

      <div className={styles.statCard}>
        <div className={styles.statIconWrapper} style={{ background: 'rgba(198, 224, 0, 0.15)', color: '#c6e000' }}>
          📐
        </div>
        <div className={styles.statInfo}>
          <span className={styles.statNumber}>{stats.ambientes}</span>
          <span className={styles.statLabel}>Salas</span>
        </div>
      </div>

      <div className={styles.statCard}>
        <div className={styles.statIconWrapper} style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
          👥
        </div>
        <div className={styles.statInfo}>
          <span className={styles.statNumber}>{stats.usuarios}</span>
          <span className={styles.statLabel}>Personal</span>
        </div>
      </div>

      <div className={styles.statCard}>
        <div className={styles.statIconWrapper} style={{ background: 'rgba(0, 230, 153, 0.15)', color: '#00e699' }}>
          ⚡
        </div>
        <div className={styles.statInfo}>
          <span className={styles.statNumber}>{stats.enCurso}</span>
          <span className={styles.statLabel}>En Turno</span>
        </div>
      </div>

      <div className={styles.statCard}>
        <div className={styles.statIconWrapper} style={{ background: 'rgba(255, 90, 0, 0.15)', color: '#ff5a00' }}>
          📚
        </div>
        <div className={styles.statInfo}>
          <span className={styles.statNumber}>{stats.cursos || cursosCount}</span>
          <span className={styles.statLabel}>Cursos</span>
        </div>
      </div>
    </section>
  );
};

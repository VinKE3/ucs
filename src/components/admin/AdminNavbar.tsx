'use client';

import React from 'react';
import Link from 'next/link';
import styles from '@/app/admin/admin.module.css';
import type { SessionPayload } from '@/lib/auth';
import type { StatsData, AdminTab } from '@/types/admin';
import { ThemeToggle } from '@/components/ThemeToggle';

interface AdminNavbarProps {
  session: SessionPayload;
  onLogout: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  stats: StatsData;
  usuariosCount: number;
  cursosCount: number;
}

export const AdminNavbar: React.FC<AdminNavbarProps> = ({
  session,
  onLogout,
  mobileMenuOpen,
  setMobileMenuOpen,
  activeTab,
  setActiveTab,
  stats,
  usuariosCount,
  cursosCount,
}) => {
  return (
    <>
      {/* HEADER NAVBAR SUPERIOR */}
      <header className={styles.navbar}>
        <div className={styles.navBrand}>
          <img
            src="/logo.png"
            alt="Universidad Científica del Sur"
            className={styles.brandLogoImg}
          />
        </div>

        {/* ACCIONES DE ESCRITORIO */}
        <div className={styles.navActions}>
          <div className={styles.userInfo}>
            <div className={styles.userAvatar}>
              {session.nombres.charAt(0)}
            </div>
            <span className={styles.userName}>{session.nombres} {session.apellidos}</span>
            <span
              className={`${styles.roleBadge} ${
                session.rolSistema === 'super_admin'
                  ? styles.roleSuperAdmin
                  : session.rolSistema === 'administrativo'
                  ? styles.roleAdministrativo
                  : styles.roleAdmin
              }`}
            >
              {session.rolSistema === 'super_admin'
                ? 'Super Admin'
                : session.rolSistema === 'administrativo'
                ? 'Administrativo'
                : 'Admin'}
            </span>
          </div>

          <ThemeToggle />

          <Link href="/" className={styles.kioscoLink} title="Ir a la pantalla de marcación">
            <span>⚡</span> Modo Kiosco
          </Link>

          <button onClick={onLogout} className={styles.logoutBtn}>
            Cerrar Sesión
          </button>
        </div>

        {/* CONTROLES MÓVILES (AVATAR + HAMBURGUESA) */}
        <div className={styles.navMobileControls}>
          <div className={styles.userAvatarMobile} onClick={() => setMobileMenuOpen(true)}>
            {session.nombres.charAt(0)}
          </div>
          <button
            type="button"
            className={styles.hamburgerBtn}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Abrir menú"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      {/* DRAWER MÓVIL SLIDEOUT */}
      <div
        className={`${styles.drawerOverlay} ${mobileMenuOpen ? styles.drawerOverlayVisible : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      />
      <aside className={`${styles.mobileDrawer} ${mobileMenuOpen ? styles.mobileDrawerOpen : ''}`}>
        <div className={styles.drawerHeader}>
          <div className={styles.drawerBrand}>
            <img
              src="/logo.png"
              alt="Universidad Científica del Sur"
              className={styles.drawerLogoImg}
            />
          </div>
          <button
            type="button"
            className={styles.drawerCloseBtn}
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Cerrar menú"
          >
            ✕
          </button>
        </div>

        {/* PERFIL DEL ADMINISTRADOR */}
        <div className={styles.drawerUserCard}>
          <div className={styles.drawerAvatar}>{session.nombres.charAt(0)}</div>
          <div className={styles.drawerUserInfo}>
            <div className={styles.drawerUserName}>{session.nombres} {session.apellidos}</div>
            <div className={styles.drawerUserEmail}>{session.correo || 'admin@cientifica.edu.pe'}</div>
            <span
              className={`${styles.roleBadge} ${
                session.rolSistema === 'super_admin'
                  ? styles.roleSuperAdmin
                  : session.rolSistema === 'administrativo'
                  ? styles.roleAdministrativo
                  : styles.roleAdmin
              }`}
            >
              {session.rolSistema === 'super_admin'
                ? 'Super Admin'
                : session.rolSistema === 'administrativo'
                ? 'Administrativo'
                : 'Admin'}
            </span>
          </div>
        </div>

        {/* SELECTOR DE TEMA EN EL DRAWER */}
        <div className={styles.drawerThemeSection}>
          <span className={styles.drawerThemeTitle}>Apariencia del Sistema</span>
          <ThemeToggle showLabels />
        </div>

        {/* ACCESO RÁPIDO A KIOSCO */}
        <div className={styles.drawerNavList}>
          <Link
            href="/"
            className={styles.drawerKioscoBtn}
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className={styles.drawerKioscoIcon}>⚡</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Modo Kiosco</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Terminal de marcación por DNI</div>
            </div>
          </Link>
        </div>

        {/* RESUMEN DE MÉTRICAS RÁPIDAS EN EL DRAWER */}
        <div className={styles.drawerStatsMini}>
          <div className={styles.drawerStatMiniItem}>
            <span className={styles.drawerStatMiniNum}>{stats.sedes}</span>
            <span className={styles.drawerStatMiniLabel}>Sedes</span>
          </div>
          <div className={styles.drawerStatMiniItem}>
            <span className={styles.drawerStatMiniNum}>{stats.ambientes}</span>
            <span className={styles.drawerStatMiniLabel}>Salas</span>
          </div>
          <div className={styles.drawerStatMiniItem}>
            <span className={styles.drawerStatMiniNum}>{usuariosCount}</span>
            <span className={styles.drawerStatMiniLabel}>Personal</span>
          </div>
          <div className={styles.drawerStatMiniItem}>
            <span className={styles.drawerStatMiniNum}>{cursosCount}</span>
            <span className={styles.drawerStatMiniLabel}>Cursos</span>
          </div>
          <div className={styles.drawerStatMiniItem}>
            <span className={styles.drawerStatMiniNum} style={{ color: '#00e699' }}>{stats.enCurso}</span>
            <span className={styles.drawerStatMiniLabel}>En Turno</span>
          </div>
        </div>

        {/* BOTÓN CERRAR SESIÓN */}
        <div className={styles.drawerFooter}>
          <button onClick={onLogout} className={styles.drawerLogoutBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* BOTTOM NAVIGATION BAR PARA MÓVILES */}
      <nav className={styles.bottomNav}>
        <button
          type="button"
          className={`${styles.bottomNavItem} ${activeTab === 'ambientes' ? styles.bottomNavItemActive : ''}`}
          onClick={() => {
            setActiveTab('ambientes');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <div className={styles.bottomNavIconWrap}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span className={styles.bottomNavBadge}>{stats.sedes}</span>
          </div>
          <span className={styles.bottomNavLabel}>Sedes / Salas</span>
        </button>

        <button
          type="button"
          className={`${styles.bottomNavItem} ${activeTab === 'personal' ? styles.bottomNavItemActive : ''}`}
          onClick={() => {
            setActiveTab('personal');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <div className={styles.bottomNavIconWrap}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className={styles.bottomNavBadge}>{usuariosCount}</span>
          </div>
          <span className={styles.bottomNavLabel}>Personal</span>
        </button>

        <button
          type="button"
          className={`${styles.bottomNavItem} ${activeTab === 'cursos' ? styles.bottomNavItemActive : ''}`}
          onClick={() => {
            setActiveTab('cursos');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <div className={styles.bottomNavIconWrap}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <span className={styles.bottomNavBadge}>{cursosCount}</span>
          </div>
          <span className={styles.bottomNavLabel}>Cursos</span>
        </button>

        <button
          type="button"
          className={`${styles.bottomNavItem} ${activeTab === 'asistencias' ? styles.bottomNavItemActive : ''}`}
          onClick={() => {
            setActiveTab('asistencias');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <div className={styles.bottomNavIconWrap}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {stats.enCurso > 0 && (
              <span className={`${styles.bottomNavBadge} ${styles.bottomNavBadgeActive}`}>
                {stats.enCurso}
              </span>
            )}
          </div>
          <span className={styles.bottomNavLabel}>Asistencias</span>
        </button>
      </nav>
    </>
  );
};

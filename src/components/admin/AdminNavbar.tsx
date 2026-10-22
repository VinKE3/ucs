'use client';

import React, { useState } from 'react';
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
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  return (
    <>
      {/* HEADER NAVBAR SUPERIOR */}
      <header className={styles.navbar}>
        <div className={styles.navBrand}>
          <img
            src="/logoucs.png"
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
              className={`${styles.roleBadge} ${session.rolSistema === 'super_admin'
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
              src="/logoucs.png"
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
              className={`${styles.roleBadge} ${session.rolSistema === 'super_admin'
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

      {/* BOTTOM NAVIGATION BAR PARA MÓVILES (ESTILO MERCADO PAGO: 4 TABS OPERATIVOS + MÁS) */}
      <nav className={styles.bottomNav}>
        {/* 1. SALAS / AMBIENTES */}
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
            <span className={styles.bottomNavBadge}>{stats.ambientes}</span>
          </div>
          <span className={styles.bottomNavLabel}>Salas</span>
        </button>

        {/* 2. PERSONAL CLÍNICA */}
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

        {/* 3. HISTORIAL DE ASISTENCIAS */}
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

        {/* 4. PLANILLA MENSUAL PS */}
        <button
          type="button"
          className={`${styles.bottomNavItem} ${activeTab === 'planilla' ? styles.bottomNavItemActive : ''}`}
          onClick={() => {
            setActiveTab('planilla');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <div className={styles.bottomNavIconWrap}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <span className={styles.bottomNavLabel}>Planilla PS</span>
        </button>

        {/* 5. MENÚ MÁS (3 PUNTITOS •••) */}
        <button
          type="button"
          className={`${styles.bottomNavItem} ${(activeTab === 'sedes' || activeTab === 'cursos' || activeTab === 'gemini_ia' || moreSheetOpen) ? styles.bottomNavItemActive : ''}`}
          onClick={() => setMoreSheetOpen(true)}
          aria-label="Más opciones"
        >
          <div className={styles.bottomNavIconWrap}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              <circle cx="19" cy="12" r="1.5" fill="currentColor" />
              <circle cx="5" cy="12" r="1.5" fill="currentColor" />
            </svg>
            {(activeTab === 'sedes' || activeTab === 'cursos' || activeTab === 'gemini_ia') && (
              <span className={`${styles.bottomNavBadge} ${styles.bottomNavBadgeActive}`} style={{ width: '8px', height: '8px', minWidth: '8px', padding: 0 }} />
            )}
          </div>
          <span className={styles.bottomNavLabel}>
            {activeTab === 'sedes' ? 'Sedes' : activeTab === 'cursos' ? 'Cursos' : activeTab === 'gemini_ia' ? 'Gemini IA' : 'Más'}
          </span>
        </button>
      </nav>

      {/* BOTTOM SHEET MÓVIL (ESTILO MERCADO PAGO / NATIVO) */}
      <div
        className={`${styles.bottomSheetOverlay} ${moreSheetOpen ? styles.bottomSheetOverlayVisible : ''}`}
        onClick={() => setMoreSheetOpen(false)}
      />
      <div className={`${styles.bottomSheet} ${moreSheetOpen ? styles.bottomSheetOpen : ''}`}>
        <div className={styles.bottomSheetHandle} />

        <div className={styles.bottomSheetHeader}>
          <div className={styles.bottomSheetTitle}>
            <span>•••</span> Más Opciones
          </div>
          <button
            type="button"
            className={styles.bottomSheetCloseBtn}
            onClick={() => setMoreSheetOpen(false)}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className={styles.bottomSheetGrid}>
          {/* SEDES */}
          <button
            type="button"
            className={`${styles.bottomSheetItem} ${activeTab === 'sedes' ? styles.bottomSheetItemActive : ''}`}
            onClick={() => {
              setActiveTab('sedes');
              setMoreSheetOpen(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <div className={styles.bottomSheetItemLeft}>
              <div className={styles.bottomSheetItemIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div className={styles.bottomSheetItemTitle}>Sedes Clínicas</div>
                <div className={styles.bottomSheetItemDesc}>Campus y terminales autorizadas de kiosco</div>
              </div>
            </div>
            <span className={styles.bottomSheetItemBadge}>{stats.sedes} sedes</span>
          </button>

          {/* CURSOS */}
          <button
            type="button"
            className={`${styles.bottomSheetItem} ${activeTab === 'cursos' ? styles.bottomSheetItemActive : ''}`}
            onClick={() => {
              setActiveTab('cursos');
              setMoreSheetOpen(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <div className={styles.bottomSheetItemLeft}>
              <div className={styles.bottomSheetItemIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div className={styles.bottomSheetItemTitle}>Cursos y Carreras</div>
                <div className={styles.bottomSheetItemDesc}>Catálogo oficial SimClic y tarifas por hora PS</div>
              </div>
            </div>
            <span className={styles.bottomSheetItemBadge}>{cursosCount} cursos</span>
          </button>

          {/* PROGRAMACIÓN SIMCLIC */}
          <button
            type="button"
            className={`${styles.bottomSheetItem} ${activeTab === 'programacion' ? styles.bottomSheetItemActive : ''}`}
            onClick={() => {
              setActiveTab('programacion');
              setMoreSheetOpen(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <div className={styles.bottomSheetItemLeft}>
              <div className={styles.bottomSheetItemIcon} style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8' }}>
                <span style={{ fontSize: '1.2rem' }}>📅</span>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div className={styles.bottomSheetItemTitle}>Programación SimClic</div>
                <div className={styles.bottomSheetItemDesc}>Línea de tiempo Gantt, radar de aulas y ausentismo</div>
              </div>
            </div>
            <span className={styles.bottomSheetItemBadge}>360°</span>
          </button>

          {/* CONTROL GEMINI IA (EXCLUSIVO SUPER ADMIN) */}
          {(session.rolSistema === 'super_admin' || session.dni === '00000001') && (
            <button
              type="button"
              className={`${styles.bottomSheetItem} ${activeTab === 'gemini_ia' ? styles.bottomSheetItemActive : ''}`}
              onClick={() => {
                setActiveTab('gemini_ia');
                setMoreSheetOpen(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <div className={styles.bottomSheetItemLeft}>
                <div className={styles.bottomSheetItemIcon} style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
                  <span style={{ fontSize: '1.2rem' }}>🤖</span>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div className={styles.bottomSheetItemTitle}>Control Gemini IA</div>
                  <div className={styles.bottomSheetItemDesc}>Consumo de tokens, switch de activación y auditoría</div>
                </div>
              </div>
              <span className={styles.bottomSheetItemBadge} style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: '#fff' }}>Super Admin</span>
            </button>
          )}

          {/* KIOSCO */}
          <Link
            href="/"
            className={styles.bottomSheetItem}
            onClick={() => setMoreSheetOpen(false)}
          >
            <div className={styles.bottomSheetItemLeft}>
              <div className={styles.bottomSheetItemIcon} style={{ background: 'rgba(0, 230, 153, 0.12)', color: '#00e699' }}>
                <span style={{ fontSize: '1.2rem' }}>⚡</span>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div className={styles.bottomSheetItemTitle}>Modo Kiosco</div>
                <div className={styles.bottomSheetItemDesc}>Terminal táctil de marcación por DNI</div>
              </div>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>➔</span>
          </Link>
        </div>

        <div className={styles.bottomSheetFooter}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.25rem 0' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Apariencia</span>
            <ThemeToggle showLabels />
          </div>
        </div>
      </div>
    </>
  );
};

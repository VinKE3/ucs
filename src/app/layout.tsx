import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PwaServiceWorkerRegistrar } from "@/components/PwaServiceWorkerRegistrar";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UCS - Sistema de Asistencias",
  description: "Registro de asistencias de docentes, técnicos y pacientes simulados en la clínica de simulación de la Universidad Científica del Sur",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "UCS Simulación",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script
          id="ucs-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('ucs_theme');var m=window.matchMedia('(prefers-color-scheme: dark)');var r=(s==='light'||s==='dark')?s:(m.matches?'dark':'light');document.documentElement.setAttribute('data-theme',r);}catch(e){}})();`,
          }}
        />
        <ThemeProvider>
          <PwaServiceWorkerRegistrar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

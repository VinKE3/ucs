import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { desc, eq, and, or, ilike, gte, lte } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/apiSecurity';

export const dynamic = 'force-dynamic';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function formatLimaTimestamp(dateVal: Date | string): string {
  try {
    return new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(dateVal));
  } catch {
    return String(dateVal);
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdminSession(['super_admin', 'admin']);
    if (!auth.authorized && auth.response) {
      return auth.response;
    }

    const { searchParams } = new URL(request.url);
    const modulo = searchParams.get('modulo')?.trim();
    const q = searchParams.get('q')?.trim();
    const fechaDesde = searchParams.get('fechaDesde')?.trim();
    const fechaHasta = searchParams.get('fechaHasta')?.trim();
    const exportFormat = searchParams.get('export')?.trim().toLowerCase();
    const limitParam = parseInt(searchParams.get('limit') || '100', 10);
    const isExcelExport = exportFormat === 'xlsx';
    const limit = isExcelExport
      ? 3000
      : Math.min(200, Math.max(10, isNaN(limitParam) ? 100 : limitParam));

    const conditions = [];

    if (modulo && modulo !== 'todos') {
      conditions.push(eq(auditLogs.modulo, modulo));
    }

    if (fechaDesde && ISO_DATE_RE.test(fechaDesde)) {
      conditions.push(gte(auditLogs.createdAt, new Date(`${fechaDesde}T00:00:00-05:00`)));
    }

    if (fechaHasta && ISO_DATE_RE.test(fechaHasta)) {
      conditions.push(lte(auditLogs.createdAt, new Date(`${fechaHasta}T23:59:59.999-05:00`)));
    }

    if (q) {
      const pattern = `%${q}%`;
      conditions.push(
        or(
          ilike(auditLogs.actorNombre, pattern),
          ilike(auditLogs.resumen, pattern),
          ilike(auditLogs.accion, pattern),
          ilike(auditLogs.entidadId, pattern)
        )
      );
    }

    const rows = await db
      .select()
      .from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);

    if (isExcelExport) {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'UCS Clínica de Simulación';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Bitácora de Auditoría', {
        views: [{ state: 'frozen', ySplit: 1 }],
      });

      sheet.columns = [
        { header: 'ID', key: 'id', width: 9 },
        { header: 'Fecha y Hora (Lima)', key: 'fechaHora', width: 22 },
        { header: 'Módulo', key: 'modulo', width: 16 },
        { header: 'Acción', key: 'accion', width: 28 },
        { header: 'Actor', key: 'actorNombre', width: 28 },
        { header: 'Rol', key: 'actorRol', width: 16 },
        { header: 'Entidad', key: 'entidadTipo', width: 16 },
        { header: 'ID / Ref', key: 'entidadId', width: 16 },
        { header: 'Resumen del Evento', key: 'resumen', width: 52 },
        { header: 'IP Origen', key: 'ipAddress', width: 18 },
        { header: 'Detalles JSON', key: 'detalles', width: 42 },
      ];

      const headerRow = sheet.getRow(1);
      headerRow.height = 24;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF0F294A' },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FF38BDF8' } },
        };
      });

      rows.forEach((row, idx) => {
        const excelRow = sheet.addRow({
          id: row.id,
          fechaHora: formatLimaTimestamp(row.createdAt),
          modulo: row.modulo,
          accion: row.accion,
          actorNombre: row.actorNombre,
          actorRol: row.actorRol,
          entidadTipo: row.entidadTipo || '',
          entidadId: row.entidadId || '',
          resumen: row.resumen,
          ipAddress: row.ipAddress || '',
          detalles: row.detalles ? JSON.stringify(row.detalles) : '',
        });

        excelRow.alignment = { vertical: 'top', wrapText: true };
        if (idx % 2 === 1) {
          excelRow.eachCell((cell) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF8FAFC' },
            };
          });
        }
      });

      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(1, rows.length + 1), column: 11 },
      };

      const arrayBuffer = await workbook.xlsx.writeBuffer();
      const todayStamp = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
      const fileName = `UCS_Auditoria_${todayStamp}.xlsx`;

      return new NextResponse(Buffer.from(arrayBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        total: rows.length,
        logs: rows,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Error en GET /api/admin/audit-logs:', error);
    return NextResponse.json(
      { success: false, error: 'Error al consultar la bitácora de auditoría.' },
      { status: 500 }
    );
  }
}

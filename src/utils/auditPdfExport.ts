// utils/auditPdfExport.ts
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export interface AuditFilter {
  startDate: Date;
  endDate: Date;
  actionTypes: string[];
  users: string[];
  tables: string[];
}

export interface AuditLog {
  id: string;
  user_email: string;
  action_type: string;
  table_name?: string;
  record_id?: string;
  description: string;
  created_at: string;
  ip_address?: string;
}

export const exportAuditToPDF = async (
  auditLogs: AuditLog[],
  filters: AuditFilter,
  fileName: string = 'audit-report.pdf'
): Promise<boolean> => {
  try {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text('AUDIT REPORT', 105, 15, { align: 'center' });
    
    // Date range
    doc.setFontSize(10);
    doc.text(`Date Range: ${filters.startDate.toLocaleDateString()} to ${filters.endDate.toLocaleDateString()}`, 14, 25);
    
    // Filters applied
    let filterText = 'Filters: ';
    if (filters.actionTypes.length > 0) filterText += `Actions: ${filters.actionTypes.join(', ')} `;
    if (filters.users.length > 0) filterText += `Users: ${filters.users.join(', ')} `;
    if (filters.tables.length > 0) filterText += `Tables: ${filters.tables.join(', ')}`;
    
    doc.text(filterText, 14, 32);
    
    // Generated timestamp
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 39);
    
    // Table data
    const tableData = auditLogs.map(log => [
      new Date(log.created_at).toLocaleString(),
      log.user_email,
      log.action_type,
      log.table_name || 'N/A',
      log.description,
      log.ip_address || 'N/A'
    ]);

    // AutoTable
    (doc as any).autoTable({
      startY: 45,
      head: [['Timestamp', 'User', 'Action', 'Table', 'Description', 'IP Address']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
      columnStyles: {
        0: { cellWidth: 25 }, // Timestamp
        1: { cellWidth: 25 }, // User
        2: { cellWidth: 20 }, // Action
        3: { cellWidth: 15 }, // Table
        4: { cellWidth: 60 }, // Description
        5: { cellWidth: 20 }  // IP Address
      }
    });

    // Summary
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text('SUMMARY', 14, finalY);
    
    doc.setFontSize(10);
    const actionCounts = auditLogs.reduce((acc, log) => {
      acc[log.action_type] = (acc[log.action_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    let summaryY = finalY + 8;
    Object.entries(actionCounts).forEach(([action, count]) => {
      doc.text(`${action}: ${count} events`, 20, summaryY);
      summaryY += 5;
    });
    
    doc.text(`Total Events: ${auditLogs.length}`, 20, summaryY + 5);

    // Save PDF
    doc.save(fileName);
    return true;
  } catch (error) {
    console.error('Error generating audit PDF:', error);
    return false;
  }
};

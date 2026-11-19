// src/utils/shiftBiddingPdfExport.ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ShiftBiddingRound, ShiftBiddingQueueItem, ShiftTypeAllowedPosition } from '@/hooks/useShiftBidding';

export const exportSeniorityQueueToPDF = (
  round: ShiftBiddingRound | undefined,
  queue: ShiftBiddingQueueItem[]
) => {
  if (!round) return;

  const doc = new jsPDF();

  // Title
  doc.setFontSize(18);
  doc.text('ANNUAL SENIORITY SHIFT BIDDING QUEUE', 105, 15, { align: 'center' });

  // Subtitle / Metadata
  doc.setFontSize(11);
  doc.text(`Division: ${round.division} | Bidding Year: ${round.year} | Status: ${round.status.toUpperCase()}`, 14, 23);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

  // Table Data
  const tableData = queue.map((item) => {
    const officer = item.profiles;
    const isCompleted = item.status === 'completed';
    const isActive = item.status === 'active';

    let selectionText = 'Pending';
    if (isCompleted && item.shift_types) {
      selectionText = `${item.shift_types.name} — ${item.selected_position_name || 'Assigned'}`;
    } else if (isActive) {
      selectionText = 'Currently Picking...';
    }

    return [
      `#${item.turn_index + 1}`,
      officer?.full_name || 'Unknown Officer',
      officer?.rank || 'Officer',
      officer?.badge_number ? `#${officer.badge_number}` : 'N/A',
      item.status.toUpperCase(),
      selectionText,
    ];
  });

  // AutoTable
  autoTable(doc, {
    startY: 36,
    head: [['Turn', 'Officer / Supervisor', 'Rank', 'Badge #', 'Status', 'Selection']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [41, 128, 185] },
    columnStyles: {
      0: { cellWidth: 15 },
      1: { cellWidth: 45 },
      2: { cellWidth: 30 },
      3: { cellWidth: 20 },
      4: { cellWidth: 25 },
      5: { cellWidth: 55 },
    },
  });

  // Summary section
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(11);
  doc.text('SUMMARY', 14, finalY);

  doc.setFontSize(9);
  const completedCount = queue.filter(q => q.status === 'completed').length;
  const pendingCount = queue.filter(q => q.status === 'pending').length;
  const activeCount = queue.filter(q => q.status === 'active').length;

  doc.text(`Total Officers in Queue: ${queue.length}`, 14, finalY + 6);
  doc.text(`Completed Selections: ${completedCount}`, 14, finalY + 12);
  doc.text(`Active Turn: ${activeCount}`, 14, finalY + 18);
  doc.text(`Pending: ${pendingCount}`, 14, finalY + 24);

  const fileName = `shift-bidding-queue-${round.year}-div-${round.division}.pdf`;
  doc.save(fileName);
};

export const exportShiftAvailabilityToPDF = (
  round: ShiftBiddingRound | undefined,
  shiftType: any,
  allowedPositions: ShiftTypeAllowedPosition[],
  queue: ShiftBiddingQueueItem[]
) => {
  if (!shiftType) return;

  const doc = new jsPDF();

  // Title
  doc.setFontSize(18);
  doc.text(`POSITION AVAILABILITY: ${shiftType.name.toUpperCase()}`, 105, 15, { align: 'center' });

  // Subtitle / Metadata
  doc.setFontSize(11);
  doc.text(`Time: ${shiftType.start_time} - ${shiftType.end_time} | Division: ${round?.division || 'N/A'} (${round?.year || new Date().getFullYear()})`, 14, 23);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

  const shiftPositions = allowedPositions.filter(p => p.shift_type_id === shiftType.id);

  const tableData = shiftPositions.map((pos) => {
    const claimedItem = queue.find(
      q => q.selected_shift_type_id === shiftType.id && q.selected_position_name === pos.position_name
    );
    const officer = claimedItem?.profiles;
    const status = claimedItem ? 'CLAIMED' : 'AVAILABLE';
    const officerName = officer ? officer.full_name : '—';
    const badge = officer?.badge_number ? `#${officer.badge_number}` : '—';
    const selectedAt = claimedItem?.selected_at
      ? new Date(claimedItem.selected_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
      : '—';

    return [
      pos.position_name,
      pos.allowed_rank || 'Any',
      status,
      officerName,
      badge,
      selectedAt,
    ];
  });

  // AutoTable
  autoTable(doc, {
    startY: 36,
    head: [['Position / Assignment', 'Allowed Rank', 'Status', 'Claimed By Officer', 'Badge #', 'Selected At']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [41, 128, 185] },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 30 },
      2: { cellWidth: 25 },
      3: { cellWidth: 40 },
      4: { cellWidth: 20 },
      5: { cellWidth: 30 },
    },
  });

  // Summary section
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(11);
  doc.text('SUMMARY', 14, finalY);

  doc.setFontSize(9);
  const totalPositions = shiftPositions.length;
  const claimedCount = shiftPositions.filter(pos =>
    queue.some(q => q.selected_shift_type_id === shiftType.id && q.selected_position_name === pos.position_name)
  ).length;
  const availableCount = totalPositions - claimedCount;

  doc.text(`Total Configured Positions: ${totalPositions}`, 14, finalY + 6);
  doc.text(`Claimed Positions: ${claimedCount}`, 14, finalY + 12);
  doc.text(`Available Positions: ${availableCount}`, 14, finalY + 18);

  const sanitizedShiftName = shiftType.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const fileName = `shift-availability-${sanitizedShiftName}-${round?.year || 'current'}.pdf`;
  doc.save(fileName);
};

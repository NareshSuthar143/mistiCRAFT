/* ============================================================
   mistiCRAFT — custom shipping label (client-side PDF)
   Requires jsPDF (UMD build) loaded before this file:
   <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/4.0.0/jspdf.umd.min.js"></script>

   A fallback for when a courier's own label/packing-slip API isn't
   available (e.g. Delhivery's Packing Slip API needs a separate
   permission some accounts don't have yet) — this generates a
   self-contained 4x6" shipping label straight from the order data
   already on file, no external API call needed. It has no scannable
   barcode (jsPDF has none built in), just a large printed waybill
   number for manual lookup at the courier's hub/pickup.
   ============================================================ */
(function (root) {
  function esc(s) { return String(s == null ? '' : s); }

  function buildDoc(order, settings) {
    if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
      console.error('mistiCRAFT label: jsPDF did not load — check your network connection.');
      return null;
    }
    settings = settings || {};
    var jsPDF = window.jspdf.jsPDF;
    // Standard 4x6" shipping label.
    var doc = new jsPDF({ unit: 'mm', format: [101.6, 152.4] });
    var pageW = doc.internal.pageSize.getWidth();
    var marginX = 6;
    var y = 10;

    function line(y1) { doc.setDrawColor(0); doc.setLineWidth(0.4); doc.line(marginX, y1, pageW - marginX, y1); }

    // Header: store + payment mode
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text('mistiCRAFT', marginX, y);
    doc.setFontSize(10);
    doc.text('PREPAID', pageW - marginX, y, { align: 'right' });
    y += 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    var fromLine = settings.delhivery_pickup_location || 'Pickup location not set';
    doc.text('From: ' + esc(fromLine), marginX, y);
    y += 3.5;
    var fromContact = [settings.store_phone, settings.store_email].filter(Boolean).join('  ·  ');
    if (fromContact) { doc.text(esc(fromContact), marginX, y); y += 3.5; }

    y += 2;
    line(y); y += 6;

    // Ship To
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('SHIP TO', marginX, y); y += 5;
    doc.setFontSize(11);
    var addr = order.address || {};
    var contact = order.contact || {};
    if (addr.name) { doc.text(esc(addr.name), marginX, y, { maxWidth: pageW - marginX * 2 }); y += 5.5; }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    if (addr.street) { doc.text(esc(addr.street), marginX, y, { maxWidth: pageW - marginX * 2 }); y += 5; }
    var cityLine = [addr.city, addr.state, addr.pin].filter(Boolean).join(', ');
    if (cityLine) { doc.text(cityLine, marginX, y, { maxWidth: pageW - marginX * 2 }); y += 5; }
    if (addr.country) { doc.text(esc(addr.country), marginX, y); y += 5; }
    if (contact.phone) { doc.setFont('helvetica', 'bold'); doc.text('Ph: ' + esc(contact.phone), marginX, y); doc.setFont('helvetica', 'normal'); y += 5; }

    y += 2;
    line(y); y += 8;

    // Waybill — the big, scannable-by-eye number since there's no barcode.
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('WAYBILL / TRACKING ID', pageW / 2, y, { align: 'center' }); y += 7;
    doc.setFontSize(20);
    doc.text(esc(order.trackingId || '—'), pageW / 2, y, { align: 'center' }); y += 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(esc(order.transporter || ''), pageW / 2, y, { align: 'center' });
    y += 6;

    line(y); y += 6;

    // Order + item summary
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('Order: ' + esc(order.orderNumber), marginX, y);
    var dateStr = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
    if (dateStr) doc.text(dateStr, pageW - marginX, y, { align: 'right' });
    y += 5;
    var items = order.items || [];
    var qty = items.reduce(function (sum, it) { return sum + (Number(it.qty) || 1); }, 0);
    doc.text(qty + ' item' + (qty === 1 ? '' : 's') + (items.length ? (': ' + items.map(function (it) { return it.name; }).filter(Boolean).join(', ')) : ''), marginX, y, { maxWidth: pageW - marginX * 2 });

    return doc;
  }

  function generate(order, settings) {
    var doc = buildDoc(order, settings);
    if (!doc) return false;
    doc.save('mistiCRAFT-Label-' + (order.orderNumber || 'order') + '.pdf');
    return true;
  }

  function generateBlob(order, settings) {
    var doc = buildDoc(order, settings);
    return doc ? doc.output('blob') : null;
  }

  root.mistiLabel = { generate: generate, generateBlob: generateBlob };
})(window);

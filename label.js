/* ============================================================
   mistiCRAFT — custom shipping label (client-side PDF)
   Requires, loaded before this file:
   <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/4.0.0/jspdf.umd.min.js"></script>
   <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3/dist/JsBarcode.all.min.js"></script>

   A fallback for when a courier's own label/packing-slip API isn't
   available (e.g. Delhivery's Packing Slip API needs a separate
   permission some accounts don't have yet) — this generates a
   self-contained 4x6" shipping label straight from the order data
   already on file, no external API call needed. Styled after a
   real courier label: bordered sections, a big destination pincode
   for hub sorters, and a scannable Code128 barcode of the waybill
   (rendered via JsBarcode to a canvas, then embedded as an image —
   jsPDF has no barcode support of its own). If JsBarcode didn't
   load, it degrades gracefully to just the printed waybill number.
   ============================================================ */
(function (root) {
  function esc(s) { return String(s == null ? '' : s); }

  function barcodeDataUrl(text) {
    if (typeof window.JsBarcode === 'undefined' || !text) return null;
    try {
      var canvas = document.createElement('canvas');
      window.JsBarcode(canvas, text, { format: 'CODE128', displayValue: false, margin: 0, height: 70, width: 2 });
      return canvas.toDataURL('image/png');
    } catch (e) {
      console.error('mistiCRAFT label: barcode render failed', e);
      return null;
    }
  }

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
    var pageH = doc.internal.pageSize.getHeight();
    var marginX = 5;
    var innerW = pageW - marginX * 2;
    var y = 8;

    function hr(y1) { doc.setDrawColor(0); doc.setLineWidth(0.4); doc.line(marginX, y1, pageW - marginX, y1); }
    function section(label) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
      doc.setTextColor(90);
      doc.text(label, marginX, y);
      doc.setTextColor(0);
      y += 4;
    }

    // Outer border, like a real courier label.
    doc.setDrawColor(0); doc.setLineWidth(0.6);
    doc.rect(2, 2, pageW - 4, pageH - 4);

    // Header: store + payment mode badge
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text('mistiCRAFT', marginX, y);
    doc.setDrawColor(0); doc.setLineWidth(0.4);
    doc.rect(pageW - marginX - 26, y - 5, 26, 6.5);
    doc.setFontSize(9);
    doc.text('PREPAID', pageW - marginX - 13, y - 0.7, { align: 'center' });
    y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    var fromLine = settings.delhivery_pickup_location || 'Pickup location not set';
    doc.text('From: ' + esc(fromLine), marginX, y);
    y += 3.3;
    var fromContact = [settings.store_phone, settings.store_email].filter(Boolean).join('  ·  ');
    if (fromContact) { doc.text(esc(fromContact), marginX, y); y += 3.3; }

    y += 1.5;
    hr(y); y += 5;

    // Destination pincode — big, for quick hub sorting, like real labels.
    var addr = order.address || {};
    var contact = order.contact || {};
    if (addr.pin) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.text('DESTINATION PIN', pageW / 2, y, { align: 'center' }); y += 8;
      doc.setFontSize(26);
      doc.text(esc(addr.pin), pageW / 2, y, { align: 'center' }); y += 5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      doc.text([addr.city, addr.state].filter(Boolean).join(', '), pageW / 2, y, { align: 'center' });
      y += 5;
      hr(y); y += 5;
    }

    // Barcode of the waybill.
    var waybill = String(order.trackingId || '').trim();
    var barcode = barcodeDataUrl(waybill);
    if (barcode) {
      var bw = innerW - 14, bh = 14;
      doc.addImage(barcode, 'PNG', (pageW - bw) / 2, y, bw, bh);
      y += bh + 2;
    }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(barcode ? 11 : 20);
    doc.text(waybill || '—', pageW / 2, y, { align: 'center' });
    y += barcode ? 4 : 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.text(esc(order.transporter || ''), pageW / 2, y, { align: 'center' });
    y += 4;

    hr(y); y += 5;

    // Ship To
    section('SHIP TO');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    if (addr.name) { doc.text(esc(addr.name), marginX, y, { maxWidth: innerW }); y += 5.5; }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    if (addr.street) { doc.text(esc(addr.street), marginX, y, { maxWidth: innerW }); y += 5; }
    var cityLine = [addr.city, addr.state, addr.pin].filter(Boolean).join(', ');
    if (cityLine) { doc.text(cityLine, marginX, y, { maxWidth: innerW }); y += 5; }
    if (addr.country) { doc.text(esc(addr.country), marginX, y); y += 5; }
    if (contact.phone) { doc.setFont('helvetica', 'bold'); doc.text('Ph: ' + esc(contact.phone), marginX, y); doc.setFont('helvetica', 'normal'); y += 5; }

    y += 1;
    hr(y); y += 5;

    // Order + item summary
    section('ORDER DETAILS');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('Order: ' + esc(order.orderNumber), marginX, y);
    var dateStr = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
    if (dateStr) doc.text(dateStr, pageW - marginX, y, { align: 'right' });
    y += 5;
    var items = order.items || [];
    var qty = items.reduce(function (sum, it) { return sum + (Number(it.qty) || 1); }, 0);
    doc.text(qty + ' item' + (qty === 1 ? '' : 's') + (items.length ? (': ' + items.map(function (it) { return it.name; }).filter(Boolean).join(', ')) : ''), marginX, y, { maxWidth: innerW });

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

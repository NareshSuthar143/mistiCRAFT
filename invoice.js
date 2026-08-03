/* ============================================================
   mistiCRAFT — auto-generated order invoices (client-side PDF)
   Requires jsPDF (UMD build) loaded before this file:
   <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/4.0.0/jspdf.umd.min.js"></script>
   PDF's standard fonts don't include the ₹ glyph, so amounts in the
   PDF itself use "Rs." — on-screen amounts elsewhere keep using ₹.
   ============================================================ */
(function (root) {
  function money(n) {
    n = Math.round(Number(n) || 0);
    return 'Rs. ' + n.toLocaleString('en-IN');
  }
  function esc(s) { return String(s == null ? '' : s); }

  function generate(order, settings) {
    if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
      console.error('mistiCRAFT invoice: jsPDF did not load — check your network connection.');
      return false;
    }
    settings = settings || {};
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'mm', format: 'a4' });
    var pageW = doc.internal.pageSize.getWidth();
    var marginX = 18;
    var y = 20;

    function line(y1) { doc.setDrawColor(200); doc.line(marginX, y1, pageW - marginX, y1); }
    function ensureRoom(nextLines) {
      if (y + nextLines * 6 > 280) { doc.addPage(); y = 20; }
    }

    // Header
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
    doc.text('mistiCRAFT', marginX, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text('Handcrafted goods', marginX, y + 6);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text('TAX INVOICE', pageW - marginX, y, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text('Invoice #: ' + esc(order.orderNumber), pageW - marginX, y + 6, { align: 'right' });
    var dateStr = new Date(order.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    doc.text('Date: ' + dateStr, pageW - marginX, y + 11, { align: 'right' });
    if (settings.store_email || settings.store_phone) {
      doc.text(esc(settings.store_email) + (settings.store_email && settings.store_phone ? '  |  ' : '') + esc(settings.store_phone), pageW - marginX, y + 16, { align: 'right' });
    }

    y += 24;
    line(y); y += 8;

    // Bill To
    var addr = order.address || {};
    var contact = order.contact || {};
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('Bill To', marginX, y); y += 6;
    doc.setFont('helvetica', 'normal');
    if (addr.name) { doc.text(esc(addr.name), marginX, y); y += 5; }
    if (addr.street) { doc.text(esc(addr.street), marginX, y); y += 5; }
    var cityLine = [addr.city, addr.state, addr.pin].filter(Boolean).join(', ');
    if (cityLine) { doc.text(cityLine, marginX, y); y += 5; }
    if (addr.country) { doc.text(esc(addr.country), marginX, y); y += 5; }
    var contactLine = [contact.email, contact.phone].filter(Boolean).join('   ·   ');
    if (contactLine) { doc.text(contactLine, marginX, y); y += 5; }

    y += 4;
    line(y); y += 8;

    // Items table header
    var col = { item: marginX, qty: pageW - marginX - 62, price: pageW - marginX - 42, total: pageW - marginX };
    doc.setFont('helvetica', 'bold');
    doc.text('Item', col.item, y);
    doc.text('Qty', col.qty, y, { align: 'right' });
    doc.text('Price', col.price, y, { align: 'right' });
    doc.text('Total', col.total, y, { align: 'right' });
    y += 3;
    line(y); y += 6;
    doc.setFont('helvetica', 'normal');

    (order.items || []).forEach(function (it) {
      ensureRoom(1);
      var label = esc(it.name) + (it.size ? (' (Size ' + esc(it.size) + ')') : '');
      doc.text(label, col.item, y, { maxWidth: pageW - marginX * 2 - 70 });
      doc.text(String(it.qty), col.qty, y, { align: 'right' });
      doc.text(money(it.price), col.price, y, { align: 'right' });
      doc.text(money(it.price * it.qty), col.total, y, { align: 'right' });
      y += 7;
    });

    y += 2;
    line(y); y += 8;

    // Totals
    ensureRoom(4);
    doc.text('Subtotal', col.price, y, { align: 'right' });
    doc.text(money(order.subtotal), col.total, y, { align: 'right' });
    y += 6;
    doc.text('Shipping', col.price, y, { align: 'right' });
    doc.text(money(order.shipping), col.total, y, { align: 'right' });
    y += 7;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('TOTAL', col.price, y, { align: 'right' });
    doc.text(money(order.total), col.total, y, { align: 'right' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');

    y += 12;
    ensureRoom(3);
    var payMethod = (order.payment && order.payment.method) ? order.payment.method.toUpperCase() : '—';
    doc.text('Payment Method: ' + payMethod, marginX, y); y += 6;
    doc.text('Order Status: ' + esc(order.status), marginX, y); y += 6;
    if (order.transporter) {
      doc.text('Transporter: ' + esc(order.transporter) + (order.trackingId ? ('   ·   Tracking ID: ' + esc(order.trackingId)) : ''), marginX, y);
      y += 6;
    }

    y += 10;
    ensureRoom(3);
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text('Thank you for shopping with mistiCRAFT.', marginX, y); y += 5;
    doc.text('This is a system-generated invoice and does not require a signature.', marginX, y);

    doc.save('mistiCRAFT-Invoice-' + (order.orderNumber || 'order') + '.pdf');
    return true;
  }

  root.mistiInvoice = { generate: generate };
})(window);

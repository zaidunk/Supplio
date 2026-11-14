const workflowSteps = [
  {
    title: "Cek kebutuhan restock",
    desc: "Supplio menghitung kapan dan berapa banyak stok perlu diisi ulang.",
  },
  {
    title: "Minta penawaran supplier",
    desc: "Supplier dihubungi lewat Telegram untuk harga, ketersediaan, dan ongkir.",
  },
  {
    title: "Bandingkan total biaya",
    desc: "Tinjau pilihan supplier berdasarkan harga barang dan ongkir.",
  },
  {
    title: "Setujui pembelian",
    desc: "Pilih penawaran dan setujui pesanan sebelum surat pesanan dibuat.",
  },
];

export function WorkflowSection() {
  return (
    <section className="supplio-workflow-section" id="alur-kerja">
      <div className="supplio-shell">
        <h2 className="supplio-workflow-h2">Empat langkah dari stok menipis ke pesanan disetujui</h2>
        <ol className="supplio-workflow-rows" aria-label="Empat langkah pengadaan dengan Supplio">
          {workflowSteps.map((step, index) => (
            <li key={step.title} className="supplio-workflow-li">
              <div className="supplio-workflow-row">
                <span className="supplio-workflow-index tabular" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="supplio-workflow-title">{step.title}</h3>
                <p className="supplio-workflow-desc">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

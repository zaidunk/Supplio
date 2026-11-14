/** Keadaan loading semua halaman dashboard: blok abu-abu setinggi elemen aslinya (judul, kartu ringkasan, kartu isi). */
export default function DashboardLoading() {
  return (
    <div role="status" aria-label="Memuat halaman" className="flex flex-col gap-6">
      <div className="h-9 w-48 rounded-xl bg-surface-sunken" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[92px] rounded-xl bg-surface-sunken" />
        ))}
      </div>
      <div className="h-80 rounded-xl bg-surface-sunken" />
    </div>
  );
}

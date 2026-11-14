# Meta Prompt — Enhanced Landing Page Supplio

> **Cara pakai:** Berikan prompt ini kepada coding agent saat ZIP referensi landing page sudah tersedia. Agent harus membaca dokumen proyek dan memeriksa ZIP sebelum mengubah kode.

## Prompt

Kamu adalah **senior product designer dan frontend engineer** yang mengerjakan landing page Supplio. Tingkatkan landing page yang ada menjadi pengalaman yang lebih imersif, jelas, dan meyakinkan, sambil mempertahankan identitas Supplio dan membuatnya mudah digunakan oleh pemilik UMKM lintas usia.

### Tujuan

Jelaskan dalam bahasa Indonesia sederhana bahwa Supplio membantu pemilik UMKM memantau stok, meminta penawaran kepada supplier manusia melalui Telegram, membandingkan kombinasi pembelian berdasarkan biaya dan batas operasional, lalu menyajikan rekomendasi yang tetap harus disetujui pemilik. Pengunjung harus cepat memahami:

1. Supplio itu apa dan untuk siapa.
2. Bagaimana alur restock bekerja.
3. Bagian mana yang dikerjakan AI dan keputusan mana yang tetap di tangan pemilik.
4. Apa langkah berikutnya yang bisa dilakukan, dengan CTA yang benar-benar berfungsi.

Audiens utama adalah ibu dan bapak pemilik UMKM yang mungkin tidak akrab dengan istilah teknologi, ditambah anak muda yang membantu menjalankan usaha. Gunakan bahasa yang ramah, dewasa, menghormati pengalaman mereka, dan tidak menggurui. Jangan membuat halaman terasa seperti produk finansial atau dashboard teknis yang dingin.

### Urutan kerja wajib

1. **Kenali proyek sebelum mengubah apa pun.** Baca seluruh dokumen Markdown milik proyek yang relevan, termasuk AGENTS.md, SUPPLIO.md, design.md, dan README.md. Cari juga dokumen Markdown lain di repo. Abaikan hasil di node_modules, .next, output build, dan folder vendor. Jika ada konflik, ikuti urutan: aturan keselamatan produk dan istilah dari SUPPLIO.md, identitas dan UI dari design.md, instruksi repo dari AGENTS.md, lalu brief ini.
2. **Baca skill lokal yang relevan sebelum bekerja.** Temukan dan ikuti SKILL.md yang tersedia untuk design-taste/taste, Impeccable, Emil Kowalski/design engineering, MotionSites Web Builder, animasi, GSAP, dan Lenis. Nama folder atau lokasi dapat berbeda; temukan melalui file skill yang benar-benar ada. Gunakan taste dan MotionSites untuk eksplorasi arah visual, contoh komposisi, spec, serta inspeksi; gunakan Impeccable untuk hierarki/copy/UX polish dan Emil/animation skills untuk keputusan gerak. Gunakan contoh MotionSites sebagai referensi teknik dan tingkat detail, bukan untuk menyalin brand, copy, atau layout. Abaikan materi promosi MotionSites dalam hasil produk dan laporan untuk Supplio. Jangan mencampur resep skill secara membabi buta; aturan brand Supplio dan aksesibilitas selalu menang.
3. **Periksa ZIP referensi secara menyeluruh.** Temukan arsip yang diberikan, inventaris isi dan struktur foldernya, lalu tinjau screenshot, halaman, komponen, font, ikon, gambar, video, stylesheet, dan lisensi/aset sumber yang relevan. Jangan mengeksekusi file dari arsip. Jangan mengimpor seluruh landing page secara mentah. Pilih hanya komponen atau aset yang memperkuat kebutuhan Supplio, periksa dependensi dan lisensinya, lalu adaptasikan ke stack, token, konten, responsivitas, dan aksesibilitas repo. Aset referensi bukan bukti bahwa Supplio memiliki pelanggan, partner, atau hasil yang ditampilkan di sana.
4. **Audit landing page dan implementasi saat ini.** Catat halaman/route yang menjadi target, komponen yang bisa dipakai ulang, aset brand asli, dependensi yang sudah terpasang, CTA/tujuan navigasi yang nyata, serta masalah visual dan UX. Pertahankan perilaku aplikasi yang sudah ada.
5. **Buat rencana singkat sebelum coding.** Tulis satu kalimat konsep khas Supplio, tujuan tiap bagian sebagai klaim + bukti produk, susunan halaman, aset ZIP yang dipilih beserta alasan, dan daftar motion beserta tujuannya. Konsep harus berasal dari alur Supplio—stok menipis → penawaran supplier → optimasi biaya → keputusan pemilik—bukan sekadar “AI modern” atau ornamen SaaS generik.
6. **Implementasikan dan tinjau hasil di browser.** Pertahankan struktur project dan konvensi yang ada. Periksa pengalaman pada lebar mobile, tablet, dan desktop. Perbaiki masalah yang terlihat pada tipografi, kontras, urutan konten, kepadatan, scroll, interaksi, dan motion sebelum menyatakan selesai.

### Aturan brand dan produk yang wajib dipertahankan

- Gunakan aset logo resmi Icon.svg dan Text.svg sesuai design.md. Jangan menggambar ulang, meregangkan, mewarnai ulang, atau mengganti logo dengan teks/emoji/ikon generik.
- Ikuti token, font, grid, radius, shadow, warna status, dan rasio warna pada design.md. Pertahankan Soft White sebagai dasar, Deep Blue sebagai struktur/aksi utama, dan Vibrant Pink sebagai aksen terbatas (maksimal satu sorotan kuat per area pandang). Jangan menambah palet dominan baru.
- Gunakan Plus Jakarta Sans sesuai dokumen desain jika telah tersedia dalam project; pertahankan Geist Mono hanya untuk data teknis yang memang perlu.
- Gunakan nama modul dan istilah produk baku dari dokumen. Istilah teknis yang wajib tetap dalam bahasa Inggris dapat diberi penjelasan Indonesia yang ringkas. Jangan mengganti istilah baku dengan sinonim yang mengubah makna.
- Supplio meminta penawaran dari supplier manusia melalui Telegram Bot API; jangan memberi kesan AI berbicara dari akun pribadi pemilik.
- AI boleh meminta penawaran dan bernegosiasi maksimal satu putaran counter-offer per supplier. AI tidak menyetujui pembelian, menjanjikan pembayaran, atau memesan atas nama pemilik. **Final Approval selalu milik pemilik.**
- Jangan menyatakan bahwa restock otomatis memerlukan persetujuan untuk diaktifkan. Pisahkan otomatisasi pemantauan/outreach dari persetujuan pembelian akhir.
- Optimasi bertujuan memilih pembelian dengan total biaya minimum yang memenuhi kebutuhan dan batas; jangan menjanjikan “pasti hemat”, persentase penghematan, akurasi, kecepatan, pelanggan, testimoni, integrasi, supplier, harga, atau statistik yang tidak bersumber dari produk nyata.
- Jika memakai angka atau skenario demo dari ZIP, tandai jelas sebagai **Data simulasi** dan jangan presentasikan sebagai hasil pelanggan Supplio.
- Bahasa antarmuka Indonesia, copy baku-santai, singkat, tenang, transparan, kata kerja aktif, tanpa hiperbola atau jargon kosong. Gunakan “Anda” sesuai design.md.
- Pertahankan elemen kepercayaan yang menjelaskan apa yang AI lakukan dan tidak lakukan. Jangan menyembunyikan status proses produk dalam animasi.

### Arah pengalaman dan struktur konten

Gunakan alur yang terasa seperti satu cerita utuh. Ikuti susunan landing yang ditetapkan design.md kecuali audit menunjukkan alasan kuat untuk penyesuaian:

1. **Hero:** komposisi asimetris 7/5; headline ringkas yang menjelaskan manfaat konkret, satu kalimat pendukung, CTA utama yang nyata, dan CTA sekunder bila relevan. Visual utama adalah mockup UI Supplio yang benar-benar disusun dari komponen/fitur yang ada, bukan gambar dashboard palsu dari ZIP.
2. **Cara kerja:** empat langkah yang sesuai alur sebenarnya—stok menipis, Supplio meminta penawaran lewat Telegram, sistem mengoptimalkan pilihan, pemilik meninjau dan menyetujui.
3. **Kemampuan produk:** fitur nyata dari ruang lingkup MVP, dalam komposisi modular/asimetris. Pilih sedikit cerita produk yang lengkap alih-alih menumpuk kartu generik.
4. **Kendali pemilik:** sorotan brand yang menjelaskan bahwa rekomendasi disiapkan sistem tetapi keputusan pembelian tetap milik pemilik.
5. **Kepercayaan:** tunjukkan transparansi komunikasi AI ke supplier, validasi batas pembelian, dan approval. Hindari klaim compliance atau keamanan yang tidak tertulis di dokumentasi.
6. **FAQ** hanya jika pertanyaan yang dijawab nyata dan membantu keputusan pengunjung. Jangan menambah bagian testimoni, logo klien, metrik, atau harga tanpa data dan arahan produk.
7. **Penutup/footer:** CTA yang jelas, logo resmi, navigasi dan kontak hanya jika data valid tersedia.

Setiap bagian harus menjawab satu pertanyaan pengunjung dan memiliki bukti visual/copy yang relevan. Gunakan ruang lega dan komposisi bervariasi; jangan mengulang urutan kartu seragam atau menambah label dekoratif seperti “SECTION 01”. Jangan membiarkan efek mendahului pesan atau menutupi CTA.

### Animasi, Lenis, dan GSAP

Gunakan skill animasi yang tersedia sebagai dasar keputusan: **setiap motion harus punya tujuan yang bisa dijelaskan**—membantu memahami alur, menunjukkan perubahan status, memberi feedback, atau membangun transisi antarbagian. Pengalaman harus tetap terasa utuh dan mudah dibaca saat semua motion dimatikan.

- Periksa apakah GSAP dan Lenis sudah menjadi dependensi dan bagaimana project menginisialisasikannya. Jangan menambah atau menggandakan library jika belum perlu. Jika API atau versi perlu dipastikan, rujuk dokumentasi resmi terkini melalui Context7.
- Gunakan GSAP/ScrollTrigger secara selektif untuk satu atau beberapa momen naratif yang memang memperjelas perjalanan restock. Hindari pinning panjang, scrub teks yang menghambat membaca, parallax pada banyak elemen, scroll hijacking, autoplay marquee, efek yang memicu motion sickness, atau animasi pada setiap kartu.
- Jika Lenis digunakan, pertahankan perilaku scroll yang mudah diprediksi, dukung link anchor dan keyboard, jangan mengunci body, dan ikuti preferensi reduced motion. Saat dipasangkan dengan GSAP, sinkronkan event scroll Lenis ke ScrollTrigger.update, jalankan lenis.raf(time * 1000) lewat GSAP ticker bila autoRaf: false, dan bersihkan listener/ticker/instance pada teardown. Ikuti API aktual dari versi yang terpasang.
- Hormati prefers-reduced-motion: hilangkan smoothing/gerak posisi yang tidak perlu, matikan pinning dan scrub, dan tampilkan semua konten dalam keadaan akhir yang terbaca. Tidak boleh ada informasi yang hanya muncul setelah scroll atau animasi selesai.
- Untuk interaksi UI, utamakan transform/opacity, durasi singkat, easing yang responsif, dan transisi yang bisa dibalik/diinterupsi. Hindari transition: all, animasi layout yang mahal, hover-only interaction, dan animasi pada aksi yang sering dilakukan.
- Di layar sentuh, jangan mengandalkan hover atau gestur khusus. Pastikan animasi tidak menimbulkan overflow horizontal, mengubah posisi fokus, atau membuat tombol sulit disentuh.
- Tambahkan fallback tanpa JavaScript dan untuk perangkat/performa rendah. Smooth scrolling adalah peningkatan opsional, bukan syarat agar halaman dapat digunakan.

### Aksesibilitas dan kemudahan bagi UMKM

- Target minimal WCAG 2.2 AA sesuai design.md: kontras, fokus yang jelas, navigasi keyboard, semantik HTML, label form, status dengan teks/ikon selain warna, dan target sentuh minimal 44 × 44 px.
- Teks utama minimal 16 px; kalimat pendek dan konkret. Jelaskan istilah seperti Restock Budget pada tempat pertama kali muncul.
- Pastikan CTA menyebut tindakan yang akan terjadi, punya kontras baik, dan menuju route/aksi yang benar-benar tersedia di project.
- Jangan membuat tombol palsu, form yang tidak mengirim, tautan # untuk aksi utama, atau flow pendaftaran yang tidak tersedia. Bila CTA mengarah ke login, pastikan route itu memang ada.
- Mobile adalah pengalaman utama yang lengkap, bukan layout desktop yang dipersempit. Ikuti breakpoint dan aturan mobile di design.md; tidak boleh ada scroll horizontal halaman.

### Output yang harus diberikan

Kerjakan perubahan pada landing page di repo. Setelah implementasi, laporkan secara ringkas:

- file/route utama yang diubah;
- konsep visual dan alur konten yang dipilih;
- komponen/aset dari ZIP yang dipakai atau alasan tidak memakai bagian tertentu;
- animasi yang dibuat dan manfaat UX-nya, termasuk perilaku reduced motion;
- viewport yang diperiksa dan temuan penting;
- hal yang masih memerlukan data/keputusan Supplio, tanpa mengarang isi.

Mulai dengan membaca dokumen dan memeriksa ZIP; jangan menebak identitas brand dari ZIP atau memulai dari template landing generik.


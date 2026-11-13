# SUPPLIO.md

> **Supplio — AI-Assisted Inventory & Procurement for UMKM**  
> **Status:** Source of truth implementasi MVP  
> **Ditetapkan:** 12 November 2026  
> **Bahasa antarmuka utama:** Indonesia | **Mata uang:** IDR | **Zona waktu:** `Asia/Jakarta`

## 1. Tujuan dan batas produk

Supplio membantu **UMKM kuliner** mendeteksi kebutuhan restock, meminta penawaran dan bernegosiasi dengan **supplier manusia melalui Telegram**, lalu merekomendasikan **kombinasi pembelian dengan total biaya terendah** yang memenuhi kebutuhan operasional dan batas keuangan. Pemilik UMKM tetap menjadi pihak yang **menyetujui pembelian akhir** (*human-in-the-loop*).

**Target demo MVP:** satu UMKM dengan beberapa barang dan **tiga supplier manusia** yang telah terhubung ke Telegram Bot Supplio. Arsitektur data tetap memakai `businessId` untuk pemisahan data dan memungkinkan perluasan ke beberapa UMKM.

**Prinsip yang tidak boleh dilanggar:**

1. Trigger restock dan proses permintaan penawaran **otomatis**; tidak ada persetujuan terpisah untuk mengaktifkannya.
2. AI dapat menanyakan harga, stok, MOQ, ongkir, lead time, serta melakukan **maksimal satu putaran counter-offer per supplier per procurement request**.
3. AI **tidak boleh** menyetujui pesanan, menjanjikan pembayaran, atau membuat komitmen transaksi atas nama pemilik.
4. Hanya pemilik yang dapat melakukan **Final Approval**; backend membuat/mengirim purchase order setelah approval terverifikasi.
5. Batas keuangan dan perhitungan optimasi ditegakkan oleh **kode deterministik**, bukan oleh kepatuhan LLM pada prompt.
6. Supplier adalah orang sungguhan. Identitas pengirim AI harus jelas; jangan menyamar sebagai manusia.

## 2. Terminologi dan variabel baku

Gunakan nama berikut secara **konsisten** di UI, API, database, prompt, dan kode. Jangan membuat sinonim field untuk konsep yang sama.

| Istilah resmi | Field TypeScript/Prisma | Makna dan lokasi data |
|---|---|---|
| **Restock Budget** | `restockBudget` | Batas total pengeluaran **satu** `ProcurementRequest`, termasuk seluruh barang dan ongkir; integer IDR, > 0. Disalin dari `defaultRestockBudget` saat request dibuat, lalu menjadi snapshot request. |
| **Maximum Unit Price** | `maximumUnitPrice` | Batas opsional harga beli **per satuan dasar suatu Product**, sebelum ongkir; integer IDR. Harga penawaran di atasnya tidak memenuhi syarat. |
| **Current Stock** | `currentStock` | Kuantitas fisik yang tersedia saat ini, menggunakan `unit` produk. |
| **Incoming Quantity** | `incomingQuantity` | Total kuantitas dari PO yang sudah disetujui tetapi belum diterima; dihitung dari outstanding PO, bukan input terpisah. |
| **Inventory Position** | `inventoryPosition` | `currentStock + incomingQuantity`; digunakan untuk menghindari restock ganda. Reservasi stok tidak masuk scope MVP. |
| **Daily Consumption** | `dailyConsumption` | Rata-rata pemakaian harian, input manual UMKM pada MVP. |
| **Manual Threshold** | `manualThreshold` | Batas minimum stok yang diinput pengguna; *floor* untuk batas restock efektif. |
| **Planned Lead Time** | `plannedLeadTimeDays` | Estimasi waktu pengadaan untuk perencanaan stok pada Product; input manual, bukan AI adaptif. |
| **Safety Stock** | `safetyStock` | Persediaan cadangan yang ditentukan pemilik. |
| **Target Coverage** | `targetCoverageDays` | Berapa hari tambahan konsumsi yang ingin dicakup setelah lead time. |
| **Reorder Point** | `reorderPoint` | Batas stok hasil perhitungan: `max(manualThreshold, dailyConsumption × plannedLeadTimeDays + safetyStock)`. |
| **Target Stock** | `targetStock` | Sasaran posisi stok setelah pengadaan: `dailyConsumption × (plannedLeadTimeDays + targetCoverageDays) + safetyStock`. |
| **Required Quantity** | `requiredQuantity` | `max(0, targetStock - inventoryPosition)`, dibulatkan ke presisi kuantitas `unit` produk. |
| **Quotation** | `Quotation` | Penawaran aktual supplier: item, harga, stok tersedia, MOQ, ongkir, lead time, masa berlaku, dan status konfirmasi. |
| **Final Approval** | `approvedByOwner` / approval action | Otorisasi pembelian oleh pemilik setelah rekomendasi selesai; bukan restock activation. |

**Aturan angka:** nominal uang disimpan sebagai integer IDR; kuantitas/konversi satuan memakai tipe decimal, bukan float untuk perhitungan penting. Harga per unit harus dinormalisasi ke satuan dasar Product (mis. Rp/kg), termasuk ketika supplier menawarkan per dus/kemasan. Gunakan format angka rupiah hanya di lapisan presentasi.

## 3. Lingkup fitur

### 3.1 MVP wajib — non-AI

| Modul | Kemampuan minimum |
|---|---|
| **Inventory** | CRUD produk (`name`, `unit`, `currentStock`, harga beli referensi/terakhir), catat stock in/out/adjustment dengan riwayat, input `dailyConsumption`, `manualThreshold`, `plannedLeadTimeDays`, `safetyStock`, `targetCoverageDays`, dan `maximumUnitPrice` opsional. |
| **Restock Monitoring** | Hitung `inventoryPosition`, `reorderPoint`, `targetStock`, `requiredQuantity`; trigger setelah perubahan stok atau konfigurasi; buat request otomatis; deduplikasi barang yang masih memiliki kebutuhan aktif/PO incoming. |
| **Supplier Management** | CRUD supplier utama/alternatif, item yang disuplai, harga referensi, MOQ, stok referensi, lead time, biaya pengiriman referensi, dan status koneksi Telegram. Satu produk dapat memiliki banyak supplier dan sebaliknya. |
| **Procurement Settings** | Input `defaultRestockBudget` (disalin ke `restockBudget` tiap request) dan konfigurasi AI; tanpa pengaturan approval untuk memulai restock. |
| **Dashboard** | Stok dan barang berisiko, procurement request aktif, percakapan/penawaran supplier, rekomendasi biaya, serta approval. Status harus terlihat, bukan proses AI tersembunyi. |
| **Purchase Workflow** | Final Approval, buat satu PO per supplier terpilih, catat status, konfirmasi penerimaan sebagian/penuh, dan update stok **hanya saat barang diterima**. |

### 3.2 MVP wajib — AI dan optimasi

| Modul | Kemampuan minimum |
|---|---|
| **AI Context** | Backend membentuk context snapshot untuk satu procurement request dari PostgreSQL. LLM tidak diberi seluruh database. |
| **Telegram Outreach** | AI mengirim permintaan penawaran ke supplier yang telah onboarding; balasan manusia masuk melalui webhook Telegram dan disimpan. |
| **AI Negotiation** | LLM memahami balasan bahasa natural, meminta klarifikasi, menegosiasikan harga/ongkir/MOQ dengan maksimum **satu counter-offer**, dan tidak mengonfirmasi pembelian. |
| **Quotation Extraction** | Ekstraksi menjadi data terstruktur tervalidasi (Zod), dengan status `NEEDS_CLARIFICATION` apabila harga/satuan/ketentuan belum tegas. |
| **Procurement Optimizer** | Solver menentukan pembagian pembelian lintas supplier dengan minimum **total harga item + ongkir**, tunduk pada `restockBudget`, `maximumUnitPrice`, kebutuhan, stok penawaran, MOQ, kelipatan kemasan, dan batas waktu kedatangan. |
| **Explainable Recommendation** | Tampilkan supplier, barang, kuantitas, harga, ongkir, total, sisa budget, dan alasan pemilihan; tampilkan `NO_FEASIBLE_SOLUTION` jika tidak ada hasil valid. |
| **AI Personalization** | Pemilik mengatur `communicationTone`, `negotiationStyle`, `customInstructions`; hanya memengaruhi gaya dan pendekatan komunikasi, **bukan** aturan keamanan atau keuangan. |

### 3.3 Fitur lanjutan — bukan MVP

- **Adaptive Threshold:** menyesuaikan restock berdasarkan fluktuasi konsumsi, ketepatan supplier, risiko keterlambatan, daya simpan, dan kapasitas penyimpanan.
- **Advanced Supplier Decision-Making:** mempertimbangkan reliabilitas pengiriman, kualitas aktual, pembatalan, dan risiko operasional; seluruh penilaian harus memiliki data pendukung.
- Demand forecasting, integrasi POS/marketplace, analitik penghematan lintas periode, integrasi kanal selain Telegram, dan supplier performance analytics.

**Tidak digunakan pada MVP:** RAG/vector database, multi-agent, LangGraph sebagai orchestrator, automated payment, Telegram personal-account/MTProto automation, pembelian tanpa approval, dan optimasi kualitas berbasis skor AI yang tidak terverifikasi.

## 4. Business rules dan perhitungan

### 4.1 Deteksi restock

Per Product, hitung:

```text
inventoryPosition = currentStock + incomingQuantity
reorderPoint      = max(manualThreshold,
                        dailyConsumption * plannedLeadTimeDays + safetyStock)
targetStock       = dailyConsumption * (plannedLeadTimeDays + targetCoverageDays)
                    + safetyStock
requiredQuantity  = max(0, targetStock - inventoryPosition)
triggerRestock    = inventoryPosition <= reorderPoint AND requiredQuantity > 0
```

- `manualThreshold` merupakan batas minimum, **bukan alternatif nama** dari `reorderPoint`.
- `plannedLeadTimeDays` merupakan estimasi perencanaan yang dikonfigurasi, tidak berubah otomatis mengikuti penawaran pada MVP.
- Jika ada kebutuhan aktif yang sudah tercakup dalam procurement request atau PO, **jangan mengirim outreach ulang** untuk jumlah yang sama.
- `requiredQuantity` dihitung ulang ketika request akan dibuat; simpan snapshot di `ProcurementRequestItem` untuk audit. `maxDeliveryDays` default sama dengan `plannedLeadTimeDays`, dapat disesuaikan pemilik **sebelum** outreach. Jika estimasi stok habis lebih cepat dari batas tersebut, tampilkan peringatan risiko stockout.
- Restock bisa berisi beberapa barang: pada satu evaluasi inventaris, kumpulkan seluruh barang yang memenuhi trigger dalam **satu `ProcurementRequest`** menggunakan satu `restockBudget`.
- Batasi satu proses sourcing aktif per bisnis pada MVP. Jika ada trigger baru ketika proses berlangsung, tandai untuk evaluasi selanjutnya; jangan menambah item diam-diam ke negosiasi yang sudah berjalan.
- Bila konfigurasi wajib (`dailyConsumption`, lead time, target coverage, budget, supplier) belum lengkap, tampilkan `CONFIGURATION_REQUIRED`, bukan memanggil AI.

### 4.2 Aturan pembelian dan optimasi

**Tujuan tunggal MVP:** minimalkan total biaya pembelian yang memenuhi kebutuhan operasional:

```text
min totalCost = sum(purchasedQuantity_ij * quotedUnitPrice_ij)
                + sum(shippingFee_j for each selected supplier j)
```

Dengan ketentuan:

1. Total unit setiap produk yang dibeli >= `requiredQuantity` produk tersebut.
2. `totalCost <= restockBudget` pada level request, bukan per supplier/per barang.
3. `quotedUnitPrice <= maximumUnitPrice` bila batas per produk ditetapkan.
4. Kuantitas tidak melampaui `availableQuantity` supplier, mengikuti `minimumOrderQuantity` (MOQ), dan kelipatan `packSize` bila ada.
5. Penawaran harus masih berlaku (`validUntil`) dan memenuhi `maxDeliveryDays` kebutuhan produk; jangan gunakan penawaran ambigu/belum dikonfirmasi.
6. Ongkir dihitung **sekali per supplier yang digunakan**; jika suatu supplier memberikan tarif berbeda untuk kombinasi tertentu, gunakan ongkir hasil quotation final.
7. Hindari overbuy: penawaran yang mengharuskan pembelian melampaui `requiredQuantity` hanya boleh dipakai jika pemilik menyediakan batas kelebihan pembelian (`allowedOverbuyQuantity` per produk); nilai default `0`, kecuali penyesuaian kemasan yang disetujui pengguna.
8. Optimizer boleh memilih lebih dari satu supplier dan membagi satu produk jika diperlukan.
9. Hasil yang tidak feasible **tidak boleh** dipaksakan; jelaskan constraint yang membuatnya gagal dan alternatif yang memerlukan keputusan manual, tanpa otomatis melanggar budget.

Gunakan **mixed-integer linear programming (MILP)** melalui `javascript-lp-solver` (jsLPSolver); implementasikan integer pack quantity, binary supplier selection untuk ongkir, serta variable pengaktif MOQ. LLM **bukan** optimizer dan tidak menentukan sendiri nilai total final. Setelah rekomendasi dihasilkan, backend menghitung ulang semua angka secara independen sebelum approval.

### 4.3 Final Approval dan order

- Trigger, outreach, klarifikasi, dan negosiasi berjalan tanpa izin per pesan.
- Halaman rekomendasi menyediakan **Approve** atau **Reject/Cancel**; hanya owner terautentikasi boleh melakukan approval.
- Approval memverifikasi ulang status quotation, jumlah, harga, masa berlaku, `restockBudget`, dan `maximumUnitPrice` dalam transaksi database. Jika berubah, kembali ke review/optimasi; **jangan** memesan.
- Setelah approval, buat `PurchaseOrder` terpisah untuk tiap supplier terpilih. Pesan konfirmasi pemesanan baru boleh dikirim **setelah** PO sah; pengiriman dibuat idempotent.
- Pembuatan PO tidak menambah `currentStock`. Catatan `GoodsReceipt` menambahkan stok sebesar jumlah aktual yang diterima dan mengurangi outstanding incoming quantity.

## 5. Komunikasi supplier melalui Telegram

**Kanal resmi MVP:** Telegram **Bot API** untuk percakapan AI-agent-ke-manusia. Ini **bukan** pesan dari akun Telegram personal pemilik UMKM. Supplier menerima pesan dari bot Supplio dan membalas sebagai manusia.

**Onboarding:**

1. Owner mendaftarkan supplier dan memilih produk terkait.
2. Backend membuat token deep link acak, sekali pakai, dan kedaluwarsa: `https://t.me/<BOT_USERNAME>?start=<token>`.
3. Supplier membuka tautan dan mengirim `/start`; bot mengidentifikasi supplier dan meminta konfirmasi koneksi/izin menerima penawaran.
4. Backend menyimpan `telegramChatId`, `telegramUserId`, serta `telegramVerifiedAt` untuk supplier tersebut. Bot tidak dapat mengawali private chat sebelum supplier melakukan interaksi pertama.

**Pertukaran pesan:**

- Saat sourcing, kirim kebutuhan spesifik (barang, unit, jumlah, waktu kedatangan yang dibutuhkan); ungkapkan bahwa pesan dibuat AI Supplio atas nama UMKM. Jangan mengirim `restockBudget` internal kecuali pengguna mengizinkan—AI memakai batas tersebut untuk kebijakan negosiasi, bukan untuk dibocorkan otomatis.
- Webhook `POST /api/telegram/webhook` menerima pesan, memeriksa header `X-Telegram-Bot-Api-Secret-Token`, deduplikasi `update_id`, mencatat raw message, lalu memicu pekerjaan asynchronous. Segera balas HTTP 2xx setelah tersimpan; jangan menjalankan LLM lama di webhook.
- Relasikan setiap pesan dengan supplier dan `NegotiationSession` aktif. **Satu sesi aktif per chat supplier** pada MVP agar balasan tidak salah konteks. Pesan di luar sesi dicatat/ditanggapi secara aman tanpa menjalankan proses pengadaan baru.
- Supplier boleh merespons bahasa natural; jika data kurang jelas (contoh “sekitar 17 ribu”, satuan tidak disebut), AI harus meminta klarifikasi sebelum quotation `CONFIRMED`.
- Batasi satu counter-offer per supplier; klarifikasi bukan counter-offer tetapi tetap tunduk pada batas pesan yang wajar. Sediakan `responseTimeoutMinutes` (default demo: 20) dan fallback bila tidak ada balasan.
- Jangan menganggap respons supplier sama dengan menerima PO; hanya konfirmasi pembelian pasca-approval yang boleh menyampaikan order.
- Outbound Telegram dan pemrosesan update harus idempotent serta menangani retry, rate limit, pesan di luar urutan, dan kegagalan jaringan.

## 6. AI architecture, konteks, dan prompt

**Tidak memakai RAG untuk MVP.** Konteks bersifat terstruktur dan diperoleh dari PostgreSQL menggunakan Prisma. Backend menyusun `ProcurementContext` hanya untuk `requestId` milik `businessId` yang sah; LLM menerima snapshot awal dan dapat menggunakan **tool calling** untuk data terbaru.

**Pembagian tanggung jawab:**

- **Core Instructions (immutable, server-side):** identitas AI; larangan komitmen transaksi; aturan jujur, privasi data, satu counter-offer, dan batas penggunaan tool.
- **Business Communication Instructions (editable):** `communicationTone`, `negotiationStyle`, `customInstructions`. Dikompilasi sebagai instruksi dengan prioritas **di bawah** Core Instructions; batasi panjang dan sanitasi input. Tidak boleh mengubah hak akses, budget, approval, tujuan optimasi, atau jumlah putaran negosiasi.
- **Dynamic ProcurementContext (backend-generated):** request items, jumlah, satuan, supplier eligible, waktu kebutuhan, kebijakan negosiasi, dan batas harga yang diperlukan. Data yang diperlukan AI dikirim secara selektif.
- **Supplier messages (untrusted):** dianggap data percakapan, tidak boleh menjalankan instruksi tersembunyi, mengakses data bisnis lain, atau memodifikasi tools/aturan.

**Tool agent yang diizinkan:** `getProcurementContext`, `getEligibleSuppliers`, `sendSupplierMessage`, `saveQuotation`, dan `getConversationHistory` (opsional untuk resume sesi). Semua tool mengikat `businessId`, `requestId`, dan supplier yang valid dari backend; model tidak boleh memasukkan ID sembarang untuk membaca data milik orang lain. `approvePurchase` dan `updateRestockBudget` **tidak tersedia** sebagai tool AI.

**AISettings:** konfigurasi gaya memiliki versi/snapshot untuk sesi baru. Mengubah pengaturan saat negosiasi berlangsung tidak mengubah pesan/sesi yang sudah aktif secara diam-diam. Output ekstraksi quotation wajib lolos validasi Zod dan normalisasi satuan sebelum disimpan; simpan pesan mentah untuk audit.

## 7. Tech stack yang diputuskan

| Layer | Stack baku | Alasan |
|---|---|---|
| Full-stack | **Next.js (App Router) + TypeScript + React** | Satu repo untuk frontend, backend, dan domain logic; backend memakai Route Handlers. |
| UI | **Tailwind CSS + shadcn/ui** | Dashboard, form, tabel, status, dan approval cepat dibuat. |
| Database | **Supabase PostgreSQL** | Penyimpanan inventaris, penawaran, pesan, status workflow, dan audit. |
| ORM | **Prisma** | Query terstruktur dan migrasi schema. |
| Auth | **Supabase Auth** | Autentikasi owner; otorisasi seluruh request berdasarkan `businessId`. |
| AI | **LangChain.js + `@langchain/openai` + OpenAI API** | Single agent untuk memahami, membuat, dan menegosiasikan pesan; structured output dan tool calling. Model dipilih lewat `OPENAI_MODEL`. |
| Validation | **Zod** | Validasi request API, keluaran LLM, dan quotation. |
| Optimization | **`javascript-lp-solver` (jsLPSolver)** | MILP untuk kombinasi pembelian dan batasan deterministik. |
| Messaging | **Telegram Bot API via HTTPS** | Negosiasi dua arah dengan supplier manusia dan webhook. |
| Async jobs | **Inngest** | Menjalankan workflow/outreach/retry/timeout yang bertahan saat supplier membalas belakangan; jangan menahan satu HTTP request. |
| Testing | **Vitest** | Unit/integration tests untuk business rules dan optimizer; mock Telegram/OpenAI dalam CI. |
| Deployment | **Vercel + Supabase + Inngest Cloud** | Next.js hosting, database terkelola, durable workflow. |

**Tidak membuat** Express/Python backend terpisah, microservices, Redis, RAG, atau LangGraph untuk MVP. Semua kode bisnis berada di server Next.js; token dan API key **tidak pernah** dikirim ke browser.

## 8. Data model konseptual

Implementasikan Prisma schema dengan relasi dan constraint unik yang tepat; ini adalah daftar entitas dan field penting, **bukan** DDL final.

| Entity | Field utama |
|---|---|
| `Business` | `id`, `ownerUserId`, `name`, `defaultRestockBudget` |
| `AISettings` | `businessId`, `communicationTone`, `negotiationStyle`, `customInstructions`, `version`, `updatedAt` |
| `Product` | `id`, `businessId`, `name`, `unit`, `currentStock`, `lastPurchaseUnitPrice`, `dailyConsumption`, `manualThreshold`, `plannedLeadTimeDays`, `safetyStock`, `targetCoverageDays`, `maximumUnitPrice?`, `allowedOverbuyQuantity` |
| `InventoryMovement` | `id`, `productId`, `type` (`IN`/`OUT`/`ADJUSTMENT`), `quantity`, `note`, `createdAt`, `referenceId?` |
| `Supplier` | `id`, `businessId`, `name`, `telegramChatId?`, `telegramUserId?`, `telegramVerifiedAt?`, `isActive` |
| `SupplierProduct` | `supplierId`, `productId`, `referenceUnitPrice`, `minimumOrderQuantity`, `packSize`, `referenceAvailableQuantity?`, `referenceLeadTimeDays`, `referenceShippingFee?`, `isPrimary`, `updatedAt` |
| `ProcurementRequest` | `id`, `businessId`, `restockBudget`, `status`, `aiSettingsVersion`, `createdAt`, `expiresAt?`, `approvedByOwnerAt?` |
| `ProcurementRequestItem` | `requestId`, `productId`, `requiredQuantity`, `maxDeliveryDays`, `allowedOverbuyQuantity` (snapshot) |
| `NegotiationSession` | `id`, `requestId`, `supplierId`, `status`, `negotiationRound`, `lastActivityAt`, `expiresAt` |
| `ConversationMessage` | `id`, `sessionId`, `direction`, `content`, `telegramMessageId?`, `telegramUpdateId?`, `createdAt` |
| `Quotation` | `id`, `sessionId`, `supplierId`, `status`, `shippingFee`, `leadTimeDays`, `validUntil?`, `confirmedAt?` |
| `QuotationItem` | `quotationId`, `productId`, `quotedUnitPrice`, `availableQuantity`, `minimumOrderQuantity`, `packSize` |
| `ProcurementRecommendation` | `id`, `requestId`, `totalCost`, `remainingBudget`, `solverStatus`, `explanation`, `createdAt` |
| `RecommendationItem` | `recommendationId`, `supplierId`, `productId`, `quantity`, `unitPrice`, `quotationItemId` |
| `PurchaseOrder` / `PurchaseOrderItem` | `requestId`, `supplierId`, `status`, `totalCost`; per item `productId`, `quantity`, `unitPrice` |
| `GoodsReceipt` / `GoodsReceiptItem` | `purchaseOrderId`, `receivedAt`; item `productId`, `receivedQuantity`, `note?` |

**Constraints dan audit:** seluruh child data harus konsisten dengan `businessId` parent. Unik-kan `SupplierProduct(supplierId, productId)`, update Telegram `update_id`, dan kunci idempotensi untuk trigger, approval, pengiriman PO, serta penerimaan barang. Simpan created/updated timestamps dan status transition history minimal pada procurement request; gunakan DB transactions untuk perubahan finansial dan stok. `isPrimary` berada pada `SupplierProduct` karena supplier utama dapat berbeda per produk.

## 9. Status lifecycle

**ProcurementRequest:**

```text
CONFIGURATION_REQUIRED (needs owner setup; no AI call)
DRAFT -> SOURCING -> AWAITING_RESPONSES -> OPTIMIZING
      -> AWAITING_APPROVAL -> APPROVED -> ORDERED
      -> PARTIALLY_RECEIVED -> COMPLETED

Alternative terminal/review outcomes:
NO_FEASIBLE_SOLUTION | CANCELLED | EXPIRED
```

- `SOURCING`: outreach disiapkan/dikirim; `AWAITING_RESPONSES`: menunggu manusia sampai semua sesi selesai atau timeout.
- `OPTIMIZING`: hanya quotation tervalidasi dan masih berlaku yang dikirim ke solver.
- `AWAITING_APPROVAL`: hasil final terlihat oleh owner; belum ada komitmen order.
- `NO_FEASIBLE_SOLUTION`: tampilkan penyebab dan opsi tindakan manual tanpa melanggar constraint.

**NegotiationSession:** `PENDING` → `CONTACTED` → `AWAITING_REPLY` → `CLARIFYING`/`NEGOTIATING` → `CONFIRMED`/`DECLINED`/`TIMED_OUT`.  
**Quotation:** `DRAFT` → `NEEDS_CLARIFICATION` → `CONFIRMED` atau `REJECTED`/`EXPIRED`.

Setiap transisi status divalidasi server; event/job yang terlambat tidak boleh memundurkan status atau membuat order ganda.

## 10. End-to-end workflow

1. **Setup:** owner mengisi inventaris, pola konsumsi, supplier, Telegram onboarding, `defaultRestockBudget`, dan `AISettings`.
2. **Stock movement:** input stok memicu evaluasi; jika `inventoryPosition <= reorderPoint` dan kebutuhan baru valid, backend membuat `ProcurementRequest` beserta item snapshot secara otomatis.
3. **Sourcing:** Inngest menjalankan job; LangChain menerima `ProcurementContext`, lalu mengirim permintaan penawaran kepada supplier terverifikasi melalui bot Telegram.
4. **Human reply:** supplier membalas Telegram; webhook menyimpan update, mengaitkannya ke sesi, dan mengirim event ke workflow. AI meminta klarifikasi dan/atau melakukan satu counter-offer sesuai batas.
5. **Quotation closing:** ketika semua supplier selesai atau timeout, backend menyimpan penawaran yang dikonfirmasi. Supplier yang tidak membalas tidak otomatis dianggap menawarkan harga referensi.
6. **Optimization:** solver memilih supplier dan kuantitas paling ekonomis dengan constraint lengkap. Jika tidak feasible, hentikan otomatisasi dengan penjelasan.
7. **Review:** dashboard menampilkan pilihan, quote, biaya total, selisih terhadap budget, dan riwayat pesan relevan; owner **Approve** atau **Reject**.
8. **Order:** backend memvalidasi ulang dan membuat PO per supplier; hanya setelah itu bot boleh mengirim konfirmasi order dengan nomor PO.
9. **Receiving:** owner mencatat kuantitas diterima (termasuk parsial); database mencatat `InventoryMovement` dan memperbarui `currentStock` serta outstanding PO.

## 11. API dan struktur project

### 11.1 HTTP endpoints minimal

| Method | Endpoint | Tanggung jawab |
|---|---|---|
| `GET/POST` | `/api/products` | Daftar/tambah produk. |
| `PATCH/DELETE` | `/api/products/[id]` | Ubah/hapus produk sesuai relasi dan izin. |
| `POST` | `/api/inventory/movements` | Mutasi stok, evaluasi threshold, trigger idempotent. |
| `GET/POST` | `/api/suppliers` | Daftar/tambah supplier dan relasi produk. |
| `PATCH` | `/api/suppliers/[id]` | Ubah supplier/produk/harga referensi. |
| `POST` | `/api/suppliers/[id]/telegram-link` | Buat deep link onboarding sekali pakai. |
| `POST` | `/api/telegram/webhook` | Verifikasi, persist, dan dispatch update Telegram. |
| `GET` | `/api/procurement` | Daftar request dan status. |
| `GET` | `/api/procurement/[id]` | Detail context, sesi, quote, rekomendasi, PO. |
| `POST` | `/api/procurement/[id]/approve` | Owner-only, validasi ulang dan buat PO. |
| `POST` | `/api/procurement/[id]/reject` | Owner-only, batalkan rekomendasi/request. |
| `GET/PUT` | `/api/settings` | `defaultRestockBudget` dan konfigurasi perencanaan. |
| `GET/PUT` | `/api/settings/ai` | Baca/perbarui `AISettings`. |
| `POST` | `/api/purchase-orders/[id]/receipts` | Catat penerimaan aktual. |
| `GET/POST/PUT` | `/api/inngest` | Handler internal yang diperlukan oleh SDK Inngest. |

Semua owner endpoints melakukan autentikasi dan otorisasi `businessId` di server. Webhook Telegram tidak menggunakan owner session, melainkan secret Telegram dan validasi supplier yang sudah terikat.

### 11.2 Struktur direktori yang disarankan

```text
src/
  app/
    (dashboard)/dashboard/page.tsx
    (dashboard)/inventory/page.tsx
    (dashboard)/suppliers/page.tsx
    (dashboard)/procurement/page.tsx
    (dashboard)/procurement/[id]/page.tsx
    (dashboard)/settings/page.tsx
    api/                          # Next.js Route Handlers
  components/                     # UI reusable
  lib/
    auth/                         # current business + authorization
    db/                           # Prisma client
    inventory/                    # stock math + trigger
    procurement/                  # lifecycle, approval, PO, receiving
    optimization/                 # MILP model + validation
    ai/                           # LangChain agent, prompts, tools, schemas
    telegram/                     # API client, webhook, onboarding
    validation/                   # Zod schemas
  inngest/                        # durable functions + event client
prisma/
  schema.prisma
  seed.ts
  migrations/
tests/
  unit/
  integration/
```

**Environment variables** minimum: `DATABASE_URL`, konfigurasi Supabase Auth, `OPENAI_API_KEY`, `OPENAI_MODEL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_BOT_USERNAME`, dan kredensial Inngest untuk lingkungan deployment. Jangan menaruh nilai rahasia di `NEXT_PUBLIC_*`.

## 12. UI/UX minimum

1. **Dashboard:** jumlah barang perlu restock, proses aktif, status penawaran, estimasi biaya, notifikasi keputusan owner.
2. **Inventory:** daftar dan form produk, stock movement, konsumsi harian, `manualThreshold`/`reorderPoint`, `targetStock`/`requiredQuantity`.
3. **Suppliers:** daftar per produk, supplier utama dan alternatif, data harga/MOQ/lead time, status Telegram terhubung, aksi generate link.
4. **Procurement Detail:** timeline status, ringkasan permintaan, percakapan dan quotation per supplier, perbandingan penawaran, hasil optimizer, rincian total biaya, aksi Approve/Reject.
5. **Settings:** `defaultRestockBudget` serta AI personalization (`communicationTone`, `negotiationStyle`, `customInstructions`) dengan penjelasan bahwa instruksi pengguna tidak mengubah kebijakan pembelian.
6. **Receiving:** daftar PO dan input kuantitas barang yang benar-benar diterima.

Dashboard dapat menggunakan polling berkala untuk MVP; WebSocket/realtime infrastructure tidak diwajibkan.

## 13. Error handling, security, dan quality gates

- **Supplier tidak membalas:** timeout → supplier dikecualikan dari optimasi; proses tetap lanjut bila ada quotation valid lain.
- **Data balasan ambigu:** tandai `NEEDS_CLARIFICATION`, jangan mengasumsikan harga, stok, MOQ, satuan, ongkir, atau persetujuan.
- **Budget tidak cukup / stok supplier tidak mencukupi:** hasil `NO_FEASIBLE_SOLUTION` beserta constraint penyebab, tanpa auto-override.
- **Prompt injection:** pesan supplier dan `customInstructions` tidak boleh mengubah izin tool, core instructions, `restockBudget`, harga maksimum, atau workflow approval.
- **Telegram/webhook:** verifikasi secret, dedup `update_id`, onboarding token sekali pakai, otorisasi chat, retry idempotent, log error tanpa membocorkan token.
- **Approval race:** lakukan validasi dan perubahan status dalam transaction; dua klik approval tidak boleh menghasilkan dua PO.
- **Receiving:** jangan menerima kuantitas melebihi outstanding tanpa proses penyesuaian yang eksplisit.
- **Observability:** log setiap transisi request, pemanggilan AI (tanpa mengumbar data rahasia), pesan keluar/masuk, quotation, solver result, approval, dan error.

### Acceptance tests wajib

1. Stok berkurang hingga `reorderPoint` → request dibuat otomatis **sekali** dengan `requiredQuantity` benar.
2. `incomingQuantity` dari PO aktif mencegah trigger ganda; penerimaan barang memperbarui stok hanya sesuai yang diterima.
3. Tiga supplier manusia dapat onboarding bot dan menjawab; pesan masuk dipetakan ke supplier/sesi yang tepat.
4. AI memakai gaya `AISettings` tanpa mengubah aturan budget; satu counter-offer dipatuhi.
5. Negosiasi menghasilkan quotation tersimpan; balasan ambigu diklarifikasi, bukan langsung dipakai.
6. Supplier termurah tidak memenuhi MOQ/lead time → optimizer memilih kombinasi valid lain.
7. Optimizer bisa memecah pembelian ke beberapa supplier dan menghitung ongkir hanya untuk supplier yang dipakai.
8. Penawaran melewati `maximumUnitPrice` atau total melewati `restockBudget` ditolak oleh kode.
9. Tidak ada solusi valid → `NO_FEASIBLE_SOLUTION`, tanpa order otomatis.
10. Tanpa Final Approval tidak ada PO/konfirmasi order; double approval tidak menggandakan PO.
11. PO yang disetujui masuk status pengiriman, penerimaan parsial/penuh tercatat benar.
12. Webhook berulang, supplier timeout, atau worker retry tidak menggandakan pesan/order/stock movement.

## 14. Urutan implementasi untuk coding agent

1. **Foundation:** scaffold Next.js/TypeScript, styling, Prisma + Supabase, Auth, schema, migration, dan seed tiga supplier + beberapa barang.
2. **Business logic sebelum AI:** CRUD inventory/supplier, mutasi stok, perhitungan ROP/target, trigger idempotent, procurement lifecycle, dan unit tests.
3. **Optimizer:** model MILP dari quotation terstruktur; uji MOQ, budget, harga maksimum, split supplier, ongkir, dan infeasible case.
4. **Telegram:** bot, deep link onboarding, webhook HTTPS/secret, korelasi sesi, persist pesan, Inngest event handling.
5. **LangChain:** context builder, core + business instructions, tools terbatas, ekstraksi quotation Zod, klarifikasi, satu counter-offer, timeout.
6. **Owner workflow:** rekomendasi, review percakapan, approval, PO, goods receiving, UI status.
7. **End-to-end demo:** tiga supplier manusia bernegosiasi di Telegram; hasilnya mengubah rekomendasi optimizer; pemilik menyetujui dan mencatat penerimaan barang.

**Prioritas penyederhanaan jika waktu sempit:** jangan menambah fitur lanjutan. Kurangi polish UI, jumlah skenario demo, dan analitik terlebih dahulu; **jangan** menghilangkan Telegram real-human reply, constraint optimizer, atau Final Approval sebagai diferensiasi dan batas keselamatan sistem.

## 15. Aturan kerja agent

- Dokumen ini **mengungguli asumsi/ide lama** ketika ada pertentangan. Jangan mengembalikan Supplier Simulator sebagai kanal utama, RAG, Python backend, atau pembelian tanpa approval.
- Sebelum coding, turunkan setiap modul menjadi interface TypeScript, Zod schema, Prisma relation, dan test case. Ikuti istilah/field pada §2.
- Pisahkan `LLM output` (tidak tepercaya) dari `validated domain data` (boleh masuk solver/DB) dan dari `owner-authorized actions` (boleh menghasilkan PO).
- Jangan membuat fakta harga, stok, supplier, kualitas, ataupun quotation. Data demo harus diberi label **seed/simulasi**; harga dari supplier manusia harus berasal dari percakapan aktual.
- Pilih implementasi paling sederhana yang konsisten dengan kebutuhan, dapat diuji, dan aman. Jika keputusan teknis kecil belum ditentukan, dokumentasikan default-nya tanpa mengubah kontrak produk.

## 16. Dokumentasi resmi

- Next.js Route Handlers: https://nextjs.org/docs/app/getting-started/route-handlers
- LangChain.js agents/tools: https://docs.langchain.com/oss/javascript/langchain/agents
- Telegram Bot API & webhook: https://core.telegram.org/bots/api
- Telegram deep linking: https://core.telegram.org/bots/features#deep-linking
- Inngest + Next.js: https://www.inngest.com/docs/getting-started/nextjs-quick-start
- jsLPSolver: https://github.com/JWally/jsLPSolver
- Prisma: https://www.prisma.io/docs
- Supabase: https://supabase.com/docs

---

**Definisi keberhasilan MVP:** Supplio mendeteksi restock secara otomatis, memperoleh dan menegosiasikan penawaran **supplier manusia melalui Telegram**, menghitung **pembelian paling ekonomis yang valid**, memperoleh **Final Approval dari pemilik**, kemudian mencatat PO dan penerimaan barang secara konsisten.

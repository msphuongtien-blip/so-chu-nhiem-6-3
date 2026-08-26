# Sổ chủ nhiệm 6/3 – V5

## 1. Mục đích

Bộ mã nguồn này là phiên bản V5 của Sổ chủ nhiệm 6/3, được tách frontend khỏi database để dữ liệu học sinh và dữ liệu thi đua được lấy trực tiếp từ Supabase.

Website không nhúng danh sách 44 học sinh hoặc lịch sử thi đua cố định trong `index.html`.

## 2. Cấu trúc thư mục

```text
SO_CHU_NHIEM_V5_FINAL_SPLIT/
├── index.html
├── app.js
├── styles.css
├── README.md
└── supabase/
    └── competition_module_v5.sql
```

### `index.html`

Chứa cấu trúc giao diện của website. Không phải nơi lưu dữ liệu học sinh hoặc lịch sử thi đua.

### `app.js`

Chứa logic ứng dụng và kết nối Supabase.

Luồng đọc dữ liệu chính:

```text
Supabase.students
        ↓
      app.js
        ↓
Danh sách học sinh / tính toán / hiển thị
```

và:

```text
Supabase.competition_records
        ↓
      app.js
        ↓
Lịch sử thi đua → Điểm tuần/tháng → Xếp hạng
```

Trong mã nguồn hiện tại, `app.js` có các hàm đọc dữ liệu từ Supabase theo hướng cache:

- `loadStudentsFromSupabase()`
- `loadCompetitionHistoryFromSupabase()`
- `refreshSupabaseData()`

Frontend dùng dữ liệu đã đọc để dựng các phần giao diện liên quan.

### `styles.css`

Chứa CSS giao diện, tách khỏi HTML.

### `supabase/competition_module_v5.sql`

Migration/schema dành riêng cho module **Thi đua – Xếp hạng**.

File này không phải file dữ liệu Excel và không chứa danh sách 44 học sinh. Nó mở rộng bảng `competition_records` đang có, thêm constraint, index, function, trigger và RLS cần thiết.

## 3. Database hiện tại

Website sử dụng Supabase project hiện tại của hệ thống.

Các bảng chính liên quan đến module này:

- `public.students`: danh sách học sinh hiện có. Không tạo lại danh sách và không đổi `student_id`.
- `public.competition_records`: nguồn dữ liệu gốc của lịch sử thi đua.
- `public.competition_criteria`: các tiêu chí thi đua.
- `public.profiles`: hồ sơ tài khoản và vai trò giáo viên/học sinh.

Danh sách học sinh hiện tại được giữ nguyên; module sử dụng dữ liệu trực tiếp từ bảng `students`.

## 4. Kiến trúc Thi đua – Xếp hạng

### 5 nhóm tiêu chí

1. Giờ giấc – chuyên cần
2. Nội quy – trật tự
3. Vệ sinh – môi trường
4. Tác phong – trang phục
5. Trách nhiệm – ứng xử

### Thang điểm

Chỉ chấp nhận:

```text
-5, -4, -3, -2, -1,
+1, +2, +3, +4, +5
```

Giá trị `0` không hợp lệ.

Constraint được đặt ở PostgreSQL để frontend không phải là lớp bảo vệ duy nhất.

## 5. Nguyên tắc tính điểm

Lịch sử thi đua là **Source of Truth**.

Không dùng cách:

```text
Điểm hiện tại + điểm mới
```

để làm nguồn dữ liệu gốc.

Thay vào đó:

```text
competition_records
        ↓
calculate_weekly_score()
        ↓
Điểm tuần
        ↓
Xếp hạng / Nhóm / Xu hướng
```

Điểm tuần khởi tạo là `81`.

Cơ chế chuyển điểm sang tuần sau đã chốt:

- `91–100` → `91`
- `81–90` → `81`
- `66–80` → `71`
- `50–65` → `61`
- `< 50` → `51`

Điểm được giới hạn trong khoảng `0–100`.

## 6. Khi sửa hoặc xóa lịch sử

Mọi thay đổi lịch sử phải dẫn tới tính lại dữ liệu.

### Sửa bản ghi

Có thể thay đổi:

- học sinh;
- tuần;
- ngày;
- nhóm tiêu chí;
- điểm;
- ghi chú.

Hệ thống tính lại từ lịch sử thay vì cộng/trừ chênh lệch vào điểm tổng.

### Đổi học sinh A → B

Phải tính lại cả:

```text
old_student_id → recalculate
new_student_id → recalculate
```

### Xóa bản ghi

Bản ghi bị xóa khỏi `competition_records`, sau đó điểm học sinh được tính lại từ lịch sử còn lại.

### Xóa ghi chú

Xóa riêng `note` không xóa bản ghi và không thay đổi điểm.

## 7. RLS

Bảng `competition_records` bật Row Level Security.

Mô hình quyền:

- Học sinh: chỉ được đọc bản ghi thuộc về chính mình.
- GVCN: được CRUD theo `is_teacher()`.

Không tắt RLS để giải quyết lỗi giao diện.

Các function tính toán nội bộ được hạn chế quyền `EXECUTE` để tránh người dùng gọi trực tiếp các hàm `SECURITY DEFINER` qua API.

## 8. Giao diện Thi đua – Xếp hạng

Module được thiết kế theo các khu vực:

### A. Bộ lọc

- Tuần
- Tháng
- Học sinh
- Nhóm tiêu chí

### B. Tổng quan

- Điểm tuần
- Điểm tháng
- Xếp hạng
- Tổng điểm cộng
- Tổng điểm trừ

### C. Xếp hạng

Bảng sử dụng toàn bộ danh sách học sinh hiện có, không chỉ các học sinh có bản ghi thi đua.

Học sinh chưa có lịch sử trong tuần được tính từ điểm khởi tạo `81`.

### D. Lịch sử thi đua

Hiển thị:

```text
Ngày | Học sinh | Nhóm tiêu chí | Tiêu chí | Điểm | Ghi chú | Người tạo | Thao tác
```

Thao tác:

```text
Sửa | Xóa
```

## 9. Cách chạy website

Không nên mở trực tiếp bằng:

```text
file://...
```

Nên chạy bằng web server hoặc deploy lên Vercel.

Ví dụ với static server:

```bash
python3 -m http.server 8080
```

sau đó mở:

```text
http://localhost:8080
```

## 10. Deploy lên Vercel

Repository nên giữ cấu trúc tách file như trên.

Entry point của website là:

```text
index.html
```

Các file `app.js` và `styles.css` phải nằm đúng vị trí tương ứng để `index.html` tải được.

## 11. Cập nhật database

Khi cần thay đổi schema/logic PostgreSQL, sử dụng file migration trong:

```text
supabase/competition_module_v5.sql
```

Không nhúng SQL trực tiếp vào `index.html`.

Không tạo database mới nếu project Supabase hiện tại đã có sẵn.

Không tạo lại hoặc xóa danh sách học sinh hiện tại.

## 12. Nguyên tắc bảo trì

Khi phát triển tiếp V5:

1. Database là nguồn dữ liệu gốc.
2. Frontend chỉ đọc/ghi qua Supabase API theo quyền RLS.
3. Không hard-code danh sách học sinh vào HTML/JavaScript.
4. Không cộng/trừ bù vào điểm tổng khi sửa hoặc xóa lịch sử.
5. Mọi thay đổi lịch sử phải dẫn tới `recalculate`.
6. Không tắt RLS để sửa lỗi chức năng.
7. Giữ `student_id` hiện tại của học sinh.

## 13. Kiểm tra nhanh trước khi phát hành

- Đọc được danh sách học sinh từ Supabase.
- Đủ 44 học sinh.
- Đọc được `competition_records`.
- Điểm không nhận `0`.
- Điểm chỉ nhận -5..-1 hoặc +1..+5.
- Thêm bản ghi cập nhật điểm.
- Sửa bản ghi cập nhật lại điểm từ lịch sử.
- Xóa bản ghi cập nhật lại điểm từ lịch sử.
- Đổi học sinh trong bản ghi cập nhật cả học sinh cũ và mới.
- Xóa ghi chú giữ nguyên điểm.
- Học sinh không thể sửa/xóa dữ liệu thi đua của người khác.
- GVCN có thể CRUD theo policy.

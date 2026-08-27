# Sổ Chủ Nhiệm 6/3 – V5 — Phase 1 Refactor

## Mục đích

Đây là bản **Giai đoạn 1: Chuẩn hóa source**. Mục tiêu của giai đoạn này là làm code dễ đọc, dễ bảo trì và dễ mở rộng mà **không thay đổi chức năng nghiệp vụ hiện tại**.

Source gốc của quá trình refactor là bộ `FINAL SPLIT`.

## Quy tắc bất biến

- Không tạo database mới.
- Không tạo lại hoặc đổi `student_id`.
- Không tắt RLS.
- Không tự ý xóa dữ liệu.
- Giai đoạn 1 không triển khai các yêu cầu mới của Giai đoạn 2/3.
- Mỗi file code có comment đầu file giải thích mục đích và phạm vi trách nhiệm.
- Code được xuống dòng để ưu tiên readability.

## Cấu trúc hiện tại

```text
SO_CHU_NHIEM_V5/
├── index.html
├── app.js
├── styles.css
├── README.md
└── supabase/
    └── competition_module_v5.sql
```

## Vai trò của từng file

### `index.html`

Entry point của website. Chứa cấu trúc DOM cho màn hình đăng nhập, navigation, dashboard và các page. Không phải nơi lưu dữ liệu.

### `app.js`

Logic ứng dụng: authentication, session, đọc/ghi Supabase, render, form và các thao tác module.

### `styles.css`

Toàn bộ styling của website: biến CSS, layout, card, table, form, modal, badge và responsive.

### `supabase/competition_module_v5.sql`

Migration/schema PostgreSQL của module Thi đua hiện tại. Giai đoạn 1 chỉ bổ sung comment đầu file, không thay đổi nghiệp vụ SQL.

## Quy chuẩn comment

Mỗi file code phải nói rõ:

- File này dùng để làm gì.
- File không chịu trách nhiệm phần nào.
- Dữ liệu đầu vào/đầu ra chính.
- File hoặc module liên quan.
- Gợi ý thứ tự đọc cho người mới.

Mỗi function trong các lần mở rộng tiếp theo nên có JSDoc mô tả mục đích, parameter, return và luồng xử lý.

## Kiến trúc mục tiêu

```text
UI
 ↓
Service
 ↓
Business Logic / Calculator
 ↓
Repository
 ↓
Supabase
```

Trong Phase 1, cấu trúc được chuẩn hóa từng bước; chưa tách thành quá nhiều file nếu việc tách đó chưa tạo ra lợi ích thực tế.

## Thi đua hiện tại

`competition_records` được xem là lịch sử thi đua. Các quy tắc điểm vẫn giữ nguyên ở Phase 1: điểm khởi tạo tuần 81; điểm phát sinh chỉ có `-5..-1` hoặc `+1..+5`; rollover vẫn theo quy tắc đã chốt.

**Lưu ý kỹ thuật:** source hiện tại vẫn có các trường dẫn xuất như `students.competition_score`/`score_history` ở một số luồng cũ. Phase 1 phải xác định rõ chúng là derived/cache nếu còn giữ, và không để UI xem chúng như nguồn sự thật độc lập.

## Cách chạy

Không mở trực tiếp bằng `file://`. Dùng static server:

```bash
python3 -m http.server 8080
```

Sau đó mở `http://localhost:8080`.

## Step-by-step test — Giai đoạn 1

### Test 1 — Static load

1. Chạy static server.
2. Mở website.
3. Mở DevTools → Console.
4. Không có lỗi JavaScript do refactor.

### Test 2 — Login

1. Đăng nhập GVCN.
2. Sidebar GVCN hiển thị đúng.
3. Đăng xuất.
4. Đăng nhập tài khoản học sinh.
5. Sidebar học sinh không hiển thị chức năng GVCN.

### Test 3 — Students

1. Mở `Học sinh & hồ sơ`.
2. Kiểm tra danh sách tải được từ Supabase.
3. Tìm một học sinh.
4. Mở chỉnh sửa.
5. Đóng form không lưu.
6. Kiểm tra dữ liệu không đổi.

### Test 4 — Attendance

1. Chọn ngày.
2. Đổi trạng thái một học sinh.
3. Lưu.
4. Reload dữ liệu.
5. Kiểm tra trạng thái vẫn đúng.

### Test 5 — Competition

1. Mở `Thi đua – xếp hạng`.
2. Kiểm tra bảng học sinh hiện tại.
3. Kiểm tra lịch sử hiện có.
4. Không kiểm thử nghiệp vụ mới ở Phase 1.

### Test 6 — Module regression

Kiểm tra nhanh:

`Gọi tên → Thi đua → Nề nếp → Học tập → Danh dự → Tổ → Báo cáo → Cảnh báo → Phản hồi → Tin nhắn → Cài đặt`.

### Test 7 — Database integrity

Sau test, kiểm tra Supabase không xuất hiện record ngoài những thao tác chị vừa thực hiện.

### Test 8 — Source readability

1. Mở `index.html`: thấy comment giải thích file.
2. Mở `app.js`: thấy comment giải thích file.
3. Mở `styles.css`: thấy comment giải thích file.
4. Mở SQL: thấy comment giải thích file.
5. Code không còn bị dồn thành các dòng quá dài ở các phần đã format.

## Kết quả Phase 1 cần đạt

- Website vẫn chạy với chức năng hiện tại.
- Source dễ đọc hơn.
- File có trách nhiệm rõ hơn.
- Không thay đổi dữ liệu database chỉ để phục vụ refactor.
- Có checkpoint để tiếp tục Giai đoạn 2.

## Ghi chú về GitHub

Repository `msphuongtien-blip/so-chu-nhiem-6-3` hiện chưa được GitHub connector của phiên làm việc này truy cập được (404/không thấy repository). Vì vậy bản Phase 1 này được tạo trong workspace trước; **chưa claim là đã push lên GitHub**. Khi repository được cấp quyền, bản này có thể được đưa vào cùng repository chính.


## Giai đoạn 2 — Loại bỏ dữ liệu ngày sinh và phụ huynh

Giai đoạn 2 đã được triển khai trên database hiện tại. Bảng `students` không còn hai cột `birth_date` và `parent_phone`. Danh sách học sinh vẫn giữ nguyên 44 bản ghi và `student_id` không thay đổi.

Frontend cũng đã loại bỏ:
- Cột Ngày sinh trong danh sách học sinh.
- Cột PHHS/SĐT phụ huynh.
- Trường ngày sinh và SĐT phụ huynh trong form thêm/sửa học sinh.
- Ngày sinh khỏi hồ sơ học sinh.
- Hai trường khỏi dữ liệu CSV xuất ra.

Edge Function `admin-create-student` đã được cập nhật để không nhận/lưu hai trường này.

### Kiểm tra Phase 2

1. Mở trang `Học sinh & hồ sơ`: không còn cột Ngày sinh/PHHS.
2. Bấm `Thêm học sinh`: form không còn trường ngày sinh/phụ huynh.
3. Mở/sửa một học sinh: không có hai trường này.
4. Mở hồ sơ học sinh: không hiển thị ngày sinh.
5. Xuất CSV: header không có Ngày sinh/SĐT PHHS.
6. Supabase → `students`: xác nhận hai cột `birth_date`, `parent_phone` không còn.
7. Kiểm tra số học sinh: vẫn là 44.
8. Kiểm tra đăng nhập và các module khác để bảo đảm không bị ảnh hưởng.

## Lưu ý về các cảnh báo database

Các cảnh báo Security/Performance đã tồn tại trước Phase 2 không được tự ý thay đổi vì chúng không thuộc phạm vi loại bỏ dữ liệu học sinh. Việc thay đổi RLS hoặc các SECURITY DEFINER function sẽ được xử lý riêng khi có yêu cầu/contract tương ứng.

# Sổ chủ nhiệm 6/3

Bộ mã nguồn web tĩnh kết nối Supabase cho project Vercel `so-chu-nhiem-6-3`.

## Cấu trúc

- `index.html` — màn hình đăng nhập và khung ứng dụng
- `styles.css` — giao diện responsive
- `app.js` — đăng nhập Supabase, dashboard và các module
- `README.md` — hướng dẫn triển khai

## Các module hiện có

1. Tổng quan
2. Học sinh
3. Điểm danh
4. Học tập
5. Nề nếp & kỷ luật
6. Phản hồi

## Cơ sở dữ liệu

Mã nguồn dùng các bảng public hiện có trong Supabase:

- `profiles`
- `students`
- `attendance`
- `learning_records`
- `discipline_records`
- `feedback`

Không cần tạo lại các bảng này nếu chúng đã tồn tại trong project Supabase.

## Triển khai

Upload toàn bộ 4 file lên repository GitHub:

`msphuongtien-blip/so-chu-nhiem-6-3`

Commit vào branch `main`.

Vercel đã kết nối repository nên sẽ tự tạo deployment mới.

## Đăng nhập

Tài khoản GVCN phải tồn tại trong Supabase Authentication. Không đặt mật khẩu trong mã nguồn.

## Lưu ý

Khóa Supabase dùng ở frontend là publishable/anon key. Quyền truy cập dữ liệu phải được kiểm soát bằng Row Level Security (RLS) ở Supabase.

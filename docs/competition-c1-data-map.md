# C1.1–C1.4 — Competition Data Map

## Mục đích

Tài liệu này ghi lại hiện trạng database đã được kiểm tra trực tiếp trên Supabase trước khi tiếp tục hoàn thiện module Thi đua.

## Số dòng hiện tại

| Bảng | Số dòng |
|---|---:|
| `students` | 44 |
| `competition_categories` | 6 |
| `competition_criteria` | 14 |
| `competition_records` | 15 |

C1.1–C1.4 không tạo dữ liệu mẫu mới.

## Quan hệ chính

```text
students.id
    ↓
competition_records.student_id
    ↓
competition_records.criteria_id
    ↓
competition_criteria.category_id
    ↓
competition_categories.id
```

`competition_records` là nguồn lịch sử ghi nhận. Các phép tính điểm/xếp hạng ở các task sau phải đọc lại từ lịch sử, không tạo một nguồn điểm tổng độc lập rồi cộng/trừ bù.

## Sáu category

Database hiện có **6 category**. Category 6 là **Học tập** và không được xóa.

Criteria liên kết với category bằng `competition_criteria.category_id`.

## Quan hệ học sinh → dữ liệu nghiệp vụ

| Bảng con | Cột tham chiếu | ON DELETE |
|---|---|---|
| `attendance` | `student_id` | CASCADE |
| `competition_records` | `student_id` | CASCADE |
| `competition_data_issues` | `student_id` | RESTRICT |
| `competition_weekly_snapshots` | `student_id` | RESTRICT |
| `discipline_records` | `student_id` | CASCADE |
| `honors` | `student_id` | CASCADE |
| `learning_records` | `student_id` | CASCADE |

Do một số bảng dùng `CASCADE`, chức năng Xóa học sinh trong UI không được phép xóa học sinh đã có dữ liệu nghiệp vụ. Chỉ học sinh chưa có bản ghi phụ thuộc mới được hard-delete, phù hợp với nhu cầu tạo/xóa học sinh test.

## RLS

`students` hiện có:

- `students_self`: SELECT cho học sinh theo `user_id = auth.uid()`.
- `students_teacher`: `ALL` cho GVCN khi `is_teacher()` đúng.

C1 không tắt, bypass hoặc nới RLS.

## Source-of-truth

Dữ liệu nghiệp vụ phải có một nguồn gốc rõ ràng:

- Học sinh: `students`.
- Lịch sử thi đua: `competition_records`.
- Cấu hình nhóm: `competition_categories`.
- Cấu hình tiêu chí: `competition_criteria`.
- Tổng hợp/xếp hạng: tính từ nguồn dữ liệu trên trong các task sau.

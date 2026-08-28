# V6 Code Documentation Standard

## File-level documentation

Mỗi file code mới hoặc được sửa phải có comment đầu file gồm: tên file, mục đích, trách nhiệm, phần không chịu trách nhiệm và dependency chính.

## Function-level documentation

Function mới hoặc được sửa phải có JSDoc khi logic không hiển nhiên. Với function có tham số hoặc giá trị trả về quan trọng, ghi rõ `@param`, `@returns` và `@throws` khi phù hợp.

## Database and advanced syntax

Các câu lệnh hoặc syntax dễ gây nhầm phải có comment tại nơi sử dụng, đặc biệt:

- Supabase query chaining.
- `single()` và `maybeSingle()`.
- `Promise.all()`.
- `Map` và `Set`.
- Optional chaining `?.`.
- Nullish coalescing `??`.
- `MutationObserver`.
- RPC, database function và trigger liên quan.

## Readability

Không gộp nhiều câu lệnh lên một dòng chỉ để rút ngắn file. Query, điều kiện, object payload và callback phải được xuống dòng rõ ràng.

## Refactor rule

C1 áp dụng đầy đủ chuẩn này cho Core và code mới hoặc được sửa. Các function legacy chỉ được chỉnh comment khi được chuyển hoặc sửa trong một task cụ thể, tránh tạo một thay đổi hàng loạt không có test bao phủ.

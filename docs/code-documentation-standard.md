# V6 Code Documentation Standard

## File-level documentation

Mỗi file code mới hoặc được sửa phải có comment đầu file gồm:

1. FILE;
2. mục đích;
3. trách nhiệm;
4. phần không chịu trách nhiệm;
5. dependency chính.

## Function-level documentation

Function mới hoặc function được sửa phải có JSDoc khi logic không hiển nhiên. Với function phức tạp nên nêu rõ parameter, return và tác động dữ liệu.

```js
/**
 * Mô tả mục đích.
 *
 * @param {Type} value Ý nghĩa parameter.
 * @returns {Type} Ý nghĩa kết quả.
 */
```

## Advanced syntax

Các API/syntax dễ gây nhầm phải có comment tại nơi sử dụng, đặc biệt:

- Supabase query chaining;
- `single()` / `maybeSingle()`;
- `Promise.all()`;
- `Map` / `Set`;
- optional chaining `?.`;
- nullish coalescing `??`;
- `MutationObserver`;
- RPC/database functions.

## Readability

Không gộp nhiều statement lên một dòng chỉ để rút ngắn file. Các block query, điều kiện và object payload phải xuống dòng rõ ràng.

## Refactor rule

C1 áp dụng đầy đủ chuẩn này cho Core, code mới và code được sửa. Các function legacy chỉ được document khi chuyển sang module tương ứng, thay vì thay đổi hàng loạt mà không có test bao phủ.

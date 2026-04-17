# Zalo Send Message Node

Node `Zalo Send Message` dùng `api.sendMessage(message, threadId[, type])` của `zca-js` để gửi tin nhắn tới user hoặc group.

## Hỗ trợ

- Gửi text thường hoặc payload JSON đầy đủ
- `urgency`
- `quote`
- `mentions`
- `styles`
- `attachments`
- `ttl`

## Chế độ nhập

### Fields

Phù hợp khi muốn cấu hình trực tiếp trên UI của n8n.

Các trường chính:

- `Thread ID`: ID người nhận hoặc nhóm
- `Type`: `User` hoặc `Group`
- `Message`: nội dung text
- `Urgency`: mức độ ưu tiên
- `Quote Message`: thông tin tin nhắn cần trích dẫn
- `Mentions`: cấu hình tag người dùng
- `Styles`: định dạng nội dung
- `TTL`: thời gian tồn tại của tin nhắn
- `Attachments`: URL công khai của ảnh hoặc file

### JSON

Phù hợp khi bạn đã có sẵn payload theo đúng format của `zca-js`.

Ví dụ:

```json
{
	"msg": "Xin chào @An",
	"mentions": [
		{
			"uid": "0000000000000000",
			"pos": 9,
			"len": 3
		}
	],
	"styles": [
		{
			"start": 0,
			"len": 12,
			"st": "b"
		},
		{
			"start": 0,
			"len": 12,
			"st": "c_db342e"
		}
	]
}
```

Lưu ý: ở chế độ `JSON`, bạn vẫn phải chọn đúng `Type`. Nếu có `mentions`, `Type` phải là `Group`.

## Định dạng màu sắc và styles

Theo `zca-js`, mỗi style có dạng:

```json
{
	"start": 0,
	"len": 5,
	"st": "c_db342e"
}
```

- `start`: vị trí bắt đầu trong chuỗi `Message`
- `len`: số ký tự cần áp dụng style
- `st`: mã style

### Các style text được hỗ trợ

| Style          | Mã `st`    | Ý nghĩa                        |
| -------------- | ---------- | ------------------------------ |
| Bold           | `b`        | In đậm                         |
| Italic         | `i`        | In nghiêng                     |
| Underline      | `u`        | Gạch chân                      |
| Strikethrough  | `s`        | Gạch ngang                     |
| Red            | `c_db342e` | Màu đỏ                         |
| Orange         | `c_f27806` | Màu cam                        |
| Yellow         | `c_f7b503` | Màu vàng                       |
| Green          | `c_15a85f` | Màu xanh lá                    |
| Small          | `f_13`     | Chữ nhỏ                        |
| Big            | `f_18`     | Chữ lớn                        |
| Unordered List | `lst_1`    | Danh sách đầu dòng             |
| Ordered List   | `lst_2`    | Danh sách đánh số              |
| Indent         | `ind_$`    | Thụt lề, cần thêm `indentSize` |

### Cách dùng màu

Màu trong Zalo không phải field riêng, mà là một `style` với mã `st` dạng `c_xxxxxx`.

Ví dụ muốn tô đỏ chữ `@An` trong câu `Xin chào @An`:

- `Message`: `Xin chào @An`
- `@An` bắt đầu ở vị trí `9`
- độ dài là `3`

```json
[
	{
		"start": 9,
		"len": 3,
		"st": "c_db342e"
	}
]
```

Bạn có thể chồng nhiều styles lên cùng một đoạn text, ví dụ vừa `Bold` vừa `Red` vừa `Big`.

Ví dụ:

```json
[
	{ "start": 0, "len": 15, "st": "b" },
	{ "start": 0, "len": 15, "st": "c_db342e" },
	{ "start": 0, "len": 15, "st": "f_18" }
]
```

### Ví dụ nhanh theo từng màu

```json
[
	{ "start": 0, "len": 4, "st": "c_db342e" },
	{ "start": 5, "len": 3, "st": "c_f27806" },
	{ "start": 9, "len": 4, "st": "c_f7b503" },
	{ "start": 14, "len": 5, "st": "c_15a85f" }
]
```

## Mention người dùng

`mentions` chỉ hoạt động khi gửi vào nhóm.

### Cách 1: Mention theo tên xuất hiện trong Message

Đây là cách mới, thuận tiện hơn trong UI.

Ví dụ muốn gửi:

```text
Xin chào @An, kiểm tra giúp mình nhé
```

Cấu hình:

- `Type`: `Group`
- `Message`: `Xin chào @An, kiểm tra giúp mình nhé`
- `Mentions > Add Mention`
- `Mode`: `By Mention Text`
- `User ID`: ID Zalo của người cần tag
- `Mention Text`: `@An`
- `Occurrence`: `1`

Node sẽ tự tìm vị trí của `@An` trong `Message` và tự suy ra:

```json
{
	"uid": "0000000000000000",
	"pos": 9,
	"len": 3
}
```

Nếu cùng một chuỗi xuất hiện nhiều lần, tăng `Occurrence` lên `2`, `3`, ...

### Cách 2: Nhập tay vị trí mention

Nếu bạn đã tự tính `pos` và `len`, dùng:

- `Mode`: `Manual Position`
- `Position`: vị trí bắt đầu
- `Length`: độ dài đoạn mention

Ví dụ:

```json
{
	"msg": "Xin chào @An",
	"mentions": [
		{
			"uid": "0000000000000000",
			"pos": 9,
			"len": 3
		}
	]
}
```

## Ví dụ kết hợp style màu và mention

Message:

```text
Xin chào @An
```

Mentions:

```json
[
	{
		"uid": "0000000000000000",
		"pos": 9,
		"len": 3
	}
]
```

Styles:

```json
[
	{
		"start": 9,
		"len": 3,
		"st": "b"
	},
	{
		"start": 9,
		"len": 3,
		"st": "c_db342e"
	}
]
```

Kết quả mong muốn: `@An` vừa được tag, vừa in đậm, vừa có màu đỏ.

## Lưu ý quan trọng

- `mentions` chỉ dùng được với `Type = Group`
- `Mention Text` phải xuất hiện đúng trong `Message`
- `Occurrence` dùng khi cùng một tên xuất hiện nhiều lần
- `styles.start` và `mentions.pos` đều tính theo vị trí trong chuỗi `Message`
- Có thể kết hợp nhiều style trên cùng một đoạn text
- `attachments` trong node hiện nhận URL công khai, node sẽ tải tạm file trước khi gửi

## Tham chiếu

- Tài liệu `zca-js`: https://zca-js.tdung.com/vi/apis/sendMessage.html

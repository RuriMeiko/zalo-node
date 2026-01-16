# sendMessage

## api.sendMessage(message, threadId\[, type])

### Parameters

* message `string` | `MessageContent`
* threadId `string`
  * Id của người dùng/nhóm
* type `ThreadType?`
  * loại thread: người dùng/nhóm, mặc định là người dùng

### Return

`Promise<SendMessageResponse>`

### Types

```typescript
export type MessageContent = {
    /**
     * Nội dung văn bản
     */
    msg: string;
    /**
     * Định dạng nội dung văn bản
     */
    styles?: Style[];
    /**
     * Mức độ quan trọng của tin nhắn
     */
    urgency?: Urgency;
    /**
     * Tin nhắn trích dẫn
     */
    quote?: SendMessageQuote;
    /**
     * Đề cập người dùng trong nhóm
     */
    mentions?: Mention[];
    /**
     * Tệp đính kèm
     */
    attachments?: AttachmentSource | AttachmentSource[];
    /**
     * Thời gian tồn tại của tin nhắn, mili giây
     */
    ttl?: number;
};

export enum TextStyle {
    Bold = "b",
    Italic = "i",
    Underline = "u",
    StrikeThrough = "s",
    Red = "c_db342e",
    Orange = "c_f27806",
    Yellow = "c_f7b503",
    Green = "c_15a85f",
    Small = "f_13",
    Big = "f_18",
    UnorderedList = "lst_1",
    OrderedList = "lst_2",
    Indent = "ind_$",
};

export type Style =
    | {
          start: number; // vị trí bắt đầu định dạng
          len: number; // độ dài văn bản tính từ vị trí bắt đầu
          st: Exclude<TextStyle, TextStyle.Indent>; // định dạng
      }
    | {
          start: number; // vị trí bắt đầu định dạng
          len: number; // độ dài văn bản tính từ vị trí bắt đầu
          st: TextStyle.Indent;
          /**
           * Độ dài thục lề
           */
          indentSize?: number;
      };

export enum Urgency {
    Default,
    Important,
    Urgent,
};

export type Mention = {
    /**
     * vị trí bắt đầu chuỗi đề cập
     */
    pos: number;
    /**
     * độ dài chuỗi đề cập
     */
    len: number;
    /**
     * id người dùng cần đề cập
     */
    uid: string;
};

export type SendMessageQuote = {
    content: TMessage["content"];
    msgType: TMessage["msgType"];
    propertyExt: TMessage["propertyExt"];

    uidFrom: TMessage["uidFrom"];
    msgId: TMessage["msgId"];
    cliMsgId: TMessage["cliMsgId"];
    ts: TMessage["ts"];
    ttl: TMessage["ttl"];
};

export type SendMessageResult = {
    msgId: number;
};

export type SendMessageResponse = {
    message: SendMessageResult | null;
    attachment: SendMessageResult[];
};
```

### Examples

Gửi tin nhắn văn bản đến nhóm

```javascript
import { ThreadType } from "zca-js";

api.sendMessage("Xin chào", "0000000000000000", ThreadType.Group);
```

Gửi tin nhắn với định dạng và mức độ quan trọng tùy chỉnh

```typescript
import { ThreadType, Urgency, TextStyle } from "zca-js";

const text = "TIN QUAN TRỌNG!!!";

api
    .sendMessage(
        {
            msg: text,
            urgency: Urgency.Important,
            styles: [
                {
                    start: 0,
                    len: text.length,
                    st: TextStyle.Bold // in đậm
                },
                {
                    start: 0,
                    len: text.length,
                    st: TextStyle.Red // màu đỏ
                },
                {
                    start: 0,
                    len: text.length,
                    st: TextStyle.Big // cỡ chữ lớn
                }
            ]
        },
        "0000000000000000",
        ThreadType.Group
    )
    .then(console.log)
    .catch(console.error);
```

Gửi tin nhắn văn bản và đề cập người dùng khác

```typescript
import { ThreadType } from "zca-js";

api
    .sendMessage(
        {
            msg: "Xin chào @ZCA",
            mentions: [
                {
                    pos: 9,
                    uid: "0000000000000000",
                    len: 4
                }
            ]
        },
        "0000000000000000",
        ThreadType.Group
    )
    .then(console.log)
    .catch(console.error);
```

Gửi tin nhắn văn bản kèm trích dẫn

```typescript
// phản hồi kèm trích dẫn lại mọi tin nhắn của người khác
api.listener.on("message", (message) => {
    if (!message.isSelf) {
        api
            .sendMessage(
                {
                    msg: "ok",
                    quote: message
                },
                message.threadId,
                message.type
            )
            .then(console.log)
            .catch(console.error);
    }
});
```

Gửi tệp đính kèm

```typescript
import path from "path";

// gửi file chỉ định vào nhóm mỗi khi có ai nhắn "file"
api.listener.on("message", (message) => {
    const isPlainText = typeof message.data.content == "string";
    if (isPlainText && message.data.content == "file") {
        api
            .sendMessage(
                {
                    msg: "",
                    attachments: [path.resolve("./file.txt")]
                },
                message.threadId,
                message.type
            )
            .then(console.log)
            .catch(console.error);
    }
});
```

### Related

* [ThreadType](https://tdung.gitbook.io/zca-js/models/enum)
* [AttachmentSource](https://tdung.gitbook.io/zca-js/models/attachment)

import {
	ApplicationError,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';
import { API, ThreadType, Zalo } from 'zca-js';
import { saveFile, removeFile } from '../utils/helper';

let api: API | undefined;

type MentionInput = {
	uid?: string;
	mode?: 'text' | 'manual';
	text?: string;
	occurrence?: number;
	pos?: number;
	len?: number;
};

type MentionInputLike = MentionInput & {
	userId?: string;
	id?: string;
	start?: number;
	offset?: number;
	length?: number;
};

function parseMentionsInput(mentions: unknown): MentionInput[] {
	if (!mentions) {
		return [];
	}

	let normalized: unknown = mentions;

	if (typeof normalized === 'string') {
		try {
			normalized = JSON.parse(normalized);
		} catch {
			return [];
		}
	}

	if (Array.isArray(normalized)) {
		return normalized.map((mention) => normalizeMentionInput(mention));
	}

	if (typeof normalized === 'object') {
		const candidate = normalized as {
			mention?: unknown;
			mentions?: unknown;
		};

		if (Array.isArray(candidate.mention)) {
			return candidate.mention.map((mention) => normalizeMentionInput(mention));
		}

		if (Array.isArray(candidate.mentions)) {
			return candidate.mentions.map((mention) => normalizeMentionInput(mention));
		}

		return [normalizeMentionInput(candidate)];
	}

	return [];
}

function normalizeMentionInput(mention: unknown): MentionInput {
	const candidate = (mention ?? {}) as MentionInputLike;

	return {
		uid: candidate.uid ?? candidate.userId ?? candidate.id,
		mode: candidate.mode,
		text: candidate.text,
		occurrence: candidate.occurrence,
		pos: candidate.pos ?? candidate.start ?? candidate.offset,
		len: candidate.len ?? candidate.length,
	};
}

function findNthOccurrence(message: string, mentionText: string, occurrence: number): number {
	let fromIndex = 0;

	for (let currentOccurrence = 1; currentOccurrence <= occurrence; currentOccurrence++) {
		const matchIndex = message.indexOf(mentionText, fromIndex);

		if (matchIndex === -1) {
			return -1;
		}

		if (currentOccurrence === occurrence) {
			return matchIndex;
		}

		fromIndex = matchIndex + mentionText.length;
	}

	return -1;
}

function buildMentionsFromFields(
	message: string,
	mentions: unknown,
) {
	const mentionEntries = parseMentionsInput(mentions);

	return mentionEntries.map((mention, index) => {
		const userId = mention.uid?.trim();

		if (!userId) {
			throw new ApplicationError(`Mention #${index + 1}: thiếu User ID`);
		}

		const manualPos = mention.pos;
		const manualLen = mention.len;
		const hasManualPosition = manualPos !== undefined || manualLen !== undefined;
		if (mention.mode === 'manual' && hasManualPosition) {
			const pos = Number(manualPos ?? 0);
			const len = Number(manualLen ?? 0);

			if (pos < 0) {
				throw new ApplicationError(`Mention #${index + 1}: Position phải lớn hơn hoặc bằng 0`);
			}

			if (len <= 0) {
				throw new ApplicationError(`Mention #${index + 1}: Length phải lớn hơn 0`);
			}

			return {
				pos,
				uid: userId,
				len,
			};
		}

		if (hasManualPosition) {
			const pos = Number(manualPos ?? 0);
			const len = Number(manualLen ?? 0);

			if (pos < 0) {
				throw new ApplicationError(`Mention #${index + 1}: Position phải lớn hơn hoặc bằng 0`);
			}

			if (len <= 0) {
				throw new ApplicationError(`Mention #${index + 1}: Length phải lớn hơn 0`);
			}

			return {
				pos,
				uid: userId,
				len,
			};
		}

		const mentionText = mention.text?.trim() ?? '';
		if (mentionText.length > 0) {
			const occurrence = Math.max(1, Number(mention.occurrence ?? 1));
			const pos = findNthOccurrence(message, mentionText, occurrence);

			if (pos === -1) {
				throw new ApplicationError(
					`Mention #${index + 1}: không tìm thấy "${mentionText}" lần thứ ${occurrence} trong Message`,
				);
			}

			return {
				pos,
				uid: userId,
				len: mentionText.length,
			};
		}

		return {
			uid: userId,
		};
	});
}

export class ZaloSendMessage implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Zalo Send Message',
		name: 'zaloSendMessage',
		icon: 'file:../shared/zalo.svg',
		group: ['Zalo' as any],
		version: 4,
		description: 'Gửi tin nhắn qua API Zalo sử dụng kết nối đăng nhập bằng cookie',
		defaults: {
			name: 'Zalo Send Message',
		},
		// @ts-ignore
		inputs: ['main'],
		// @ts-ignore
		outputs: ['main'],
		credentials: [
			{
				name: 'zaloApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Input Style',
				name: 'messageInputStyle',
				type: 'options',
				options: [
					{
						name: 'Fields',
						value: 'fields',
					},
					{
						name: 'JSON',
						value: 'json',
					},
				],
				default: 'fields',
				description: 'Chọn cách nhập nội dung tin nhắn',
			},
			{
				displayName: 'Thread ID',
				name: 'threadId',
				type: 'string',
				default: '',
				required: true,
				description: 'ID của thread để gửi tin nhắn',
			},
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				options: [
					{
						name: 'User',
						value: 0,
					},
					{
						name: 'Group',
						value: 1,
					},
				],
				default: 0,
				description: 'Loại thread nhận tin nhắn (user hoặc group)',
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						messageInputStyle: ['fields'],
					},
				},
				description:
					'Nội dung tin nhắn cần gửi. Nếu dùng mention theo tên, hãy nhập đúng chuỗi xuất hiện trong tin nhắn, ví dụ @An.',
			},
			{
				displayName: 'Message JSON',
				name: 'messageJson',
				type: 'json',
				default: '',
				required: true,
				displayOptions: {
					show: {
						messageInputStyle: ['json'],
					},
				},
				description: 'Nội dung tin nhắn dạng JSON theo tài liệu Zalo API',
			},
			{
				displayName: 'Urgency',
				name: 'urgency',
				type: 'options',
				displayOptions: {
					show: {
						messageInputStyle: ['fields'],
					},
				},
				options: [
					{
						name: 'Default',
						value: 0,
					},
					{
						name: 'Important',
						value: 1,
					},
					{
						name: 'Urgent',
						value: 2,
					},
				],
				default: 0,
				description: 'Mức độ khẩn cấp của tin nhắn',
			},
			{
				displayName: 'Quote Message',
				name: 'quote',
				type: 'collection',
				placeholder: 'Add Quote',
				default: {},
				options: [
					{
						displayName: 'CLI Message ID',
						name: 'cliMsgId',
						type: 'string',
						default: '',
						description: 'ID tin nhắn client của tin nhắn trích dẫn',
					},
					{
						displayName: 'Content',
						name: 'content',
						type: 'string',
						default: '',
						description: 'Nội dung tin nhắn trích dẫn',
					},
					{
						displayName: 'Message ID',
						name: 'msgId',
						type: 'string',
						default: '',
						description: 'ID của tin nhắn cần trích dẫn',
					},
					{
						displayName: 'Message Type',
						name: 'msgType',
						type: 'number',
						default: 1,
						description: 'Loại tin nhắn trích dẫn',
					},
					{
						displayName: 'Property Ext',
						name: 'propertyExt',
						type: 'string',
						default: '',
						description: 'Mở rộng thuộc tính của tin nhắn trích dẫn',
					},
					{
						displayName: 'Sender ID',
						name: 'uidFrom',
						type: 'string',
						default: '',
						description: 'ID của người gửi tin nhắn trích dẫn',
					},
					{
						displayName: 'Timestamp',
						name: 'ts',
						type: 'string',
						default: '',
						description: 'Thời gian của tin nhắn trích dẫn',
					},
					{
						displayName: 'TTL',
						name: 'ttl',
						type: 'number',
						default: 0,
						description: 'Thời gian sống của tin nhắn trích dẫn',
					},
				],
				displayOptions: {
					show: {
						messageInputStyle: ['fields'],
					},
				},
			},
			{
				displayName: 'Mentions',
				name: 'mentions',
				type: 'fixedCollection',
				displayOptions: {
					show: {
						messageInputStyle: ['fields'],
					},
				},
				typeOptions: {
					multipleValues: true,
				},
				placeholder: 'Add Mention',
				default: {},
				description:
					'Chỉ áp dụng cho Type = Group. Có thể nhập nhiều mention để tag nhiều người; hỗ trợ cả mảng mention chuẩn hoặc object từ UI.',
				options: [
					{
						name: 'mention',
						displayName: 'Mention',
						values: [
							{
								displayName: 'Mode',
								name: 'mode',
								type: 'options',
								options: [
									{
										name: 'By Mention Text',
										value: 'text',
									},
									{
										name: 'Manual Position',
										value: 'manual',
									},
								],
								default: 'text',
								description: 'Chọn cách xác định vị trí mention',
							},
							{
								displayName: 'User ID',
								name: 'uid',
								type: 'string',
								default: '',
								description: 'ID của người dùng được mention',
							},
							{
								displayName: 'Mention Text',
								name: 'text',
								type: 'string',
								default: '',
								displayOptions: {
									show: {
										mode: ['text'],
									},
								},
								description: 'Chuỗi xuất hiện trong Message để mention, ví dụ @An',
							},
							{
								displayName: 'Occurrence',
								name: 'occurrence',
								type: 'number',
								default: 1,
								typeOptions: {
									minValue: 1,
								},
								displayOptions: {
									show: {
										mode: ['text'],
									},
								},
								description: 'Lần xuất hiện thứ N của Mention Text trong Message',
							},
							{
								displayName: 'Position',
								name: 'pos',
								type: 'number',
								default: 0,
								displayOptions: {
									show: {
										mode: ['manual'],
									},
								},
								description: 'Vị trí mention trong tin nhắn',
							},
							{
								displayName: 'Length',
								name: 'len',
								type: 'number',
								default: 0,
								displayOptions: {
									show: {
										mode: ['manual'],
									},
								},
								description: 'Độ dài của mention',
							},
						],
					},
				],
			},
			{
				displayName: 'Style Input Mode',
				name: 'styleInputMode',
				type: 'options',
				displayOptions: {
					show: {
						messageInputStyle: ['fields'],
					},
				},
				options: [
					{
						name: 'UI Fields',
						value: 'fields',
					},
					{
						name: 'JSON Array',
						value: 'json',
					},
				],
				default: 'fields',
				description: 'Chọn cách nhập định dạng văn bản (styles)',
			},
			{
				displayName: 'Styles',
				name: 'styles',
				type: 'fixedCollection',
				displayOptions: {
					show: {
						messageInputStyle: ['fields'],
						styleInputMode: ['fields'],
					},
				},
				typeOptions: {
					multipleValues: true,
				},
				placeholder: 'Add Style',
				default: {},
				options: [
					{
						name: 'style',
						displayName: 'Style',
						values: [
							{
								displayName: 'Style Type',
								name: 'st',
								type: 'options',
								options: [
									{ name: 'Big', value: 'f_18' },
									{ name: 'Bold', value: 'b' },
									{ name: 'Green', value: 'c_15a85f' },
									{ name: 'Indent', value: 'ind_$' },
									{ name: 'Italic', value: 'i' },
									{ name: 'Orange', value: 'c_f27806' },
									{ name: 'Ordered List', value: 'lst_2' },
									{ name: 'Red', value: 'c_db342e' },
									{ name: 'Small', value: 'f_13' },
									{ name: 'Strikethrough', value: 's' },
									{ name: 'Underline', value: 'u' },
									{ name: 'Unordered List', value: 'lst_1' },
									{ name: 'Yellow', value: 'c_f7b503' },
								],
								default: 'b',
							},
							{
								displayName: 'Start Position',
								name: 'start',
								type: 'number',
								default: 0,
							},
							{
								displayName: 'Length',
								name: 'len',
								type: 'number',
								default: 0,
							},
							{
								displayName: 'Indent Size',
								name: 'indentSize',
								type: 'number',
								default: 1,
								displayOptions: {
									show: {
										st: ['ind_$'],
									},
								},
							},
						],
					},
				],
			},
			{
				displayName: 'Styles JSON',
				name: 'stylesJson',
				type: 'json',
				default:
					'[\n  { "start": 0, "len": 5, "st": "b" },\n  { "start": 6, "len": 5, "st": "i" },\n  { "start": 12, "len": 5, "st": "u" },\n  { "start": 18, "len": 5, "st": "s" },\n  { "start": 24, "len": 5, "st": "c_db342e" },\n  { "start": 30, "len": 5, "st": "f_18" },\n  { "start": 36, "len": 5, "st": "ind_$", "indentSize": 1 }\n]',
				displayOptions: {
					show: {
						messageInputStyle: ['fields'],
						styleInputMode: ['json'],
					},
				},
				description: 'Nhập mảng JSON định dạng (e.g., [{"start": 0, "len": 5, "st": "b"}])',
			},
			{
				displayName: 'TTL (Time To Live)',
				name: 'ttl',
				type: 'number',
				default: 0,
				displayOptions: {
					show: {
						messageInputStyle: ['fields'],
					},
				},
				description: 'Thời gian tồn tại của tin nhắn (mili giây)',
			},
			{
				displayName: 'Attachments',
				name: 'attachments',
				type: 'fixedCollection',
				displayOptions: {
					show: {
						messageInputStyle: ['fields'],
					},
				},
				typeOptions: {
					multipleValues: true,
				},
				placeholder: 'Add Attachment',
				default: {},
				options: [
					{
						name: 'attachment',
						displayName: 'Attachment',
						values: [
							{
								displayName: 'Type',
								name: 'type',
								type: 'options',
								options: [
									{
										name: 'Image URL/File URL',
										value: 'url',
									},
								],
								default: 'url',
								description: 'Loại file đính kèm',
							},
							{
								displayName: 'Image URL/File URL',
								name: 'imageUrl',
								type: 'string',
								default: '',
								displayOptions: {
									show: {
										type: ['url'],
									},
								},
								description: 'URL công khai của ảnh hoặc file',
							},
						],
					},
				],
				description: 'Một hoặc nhiều ảnh đính kèm để gửi',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const returnData: INodeExecutionData[] = [];
		const items = this.getInputData();
		const zaloCred = await this.getCredentials('zaloApi');

		// Parse credentials
		const cookieFromCred = JSON.parse(zaloCred.cookie as string);
		const imeiFromCred = zaloCred.imei as string;
		const userAgentFromCred = zaloCred.userAgent as string;

		// Initialize Zalo API
		try {
			const zalo = new Zalo();
			api = await zalo.login({
				cookie: cookieFromCred,
				imei: imeiFromCred,
				userAgent: userAgentFromCred,
			});

			if (!api) {
				throw new NodeOperationError(
					this.getNode(),
					'Failed to initialize Zalo API. Check your credentials.',
				);
			}
		} catch (error) {
			throw new NodeOperationError(this.getNode(), `Zalo login error: ${(error as Error).message}`);
		}

		for (let i = 0; i < items.length; i++) {
			const tempAttachmentPaths: string[] = [];

			try {
				// Get parameters
				const threadId = this.getNodeParameter('threadId', i) as string;
				const typeNumber = this.getNodeParameter('type', i) as number;
				const type = typeNumber === 0 ? ThreadType.User : ThreadType.Group;

				// Create message content
				let messageContent: any = {};
				const messageInputStyle = this.getNodeParameter('messageInputStyle', i) as string;

				if (messageInputStyle === 'json') {
					const messageJson = this.getNodeParameter('messageJson', i) as string;
					messageContent = typeof messageJson === 'string' ? JSON.parse(messageJson) : messageJson;
				} else {
					const message = this.getNodeParameter('message', i) as string;
					const urgency = this.getNodeParameter('urgency', i, 0) as number;
					const quote = this.getNodeParameter('quote', i, {}) as any;
					const mentions = this.getNodeParameter('mentions', i, {}) as any;
					const styleInputMode = this.getNodeParameter('styleInputMode', i, 'fields') as string;
					const ttl = this.getNodeParameter('ttl', i, 0) as number;
					const attachments = this.getNodeParameter('attachments', i, {}) as any;

					messageContent = {
						msg: message,
					};

					// Add urgency if specified
					if (urgency !== 0) {
						messageContent.urgency = urgency;
					}

					// Add TTL if specified
					if (ttl > 0) {
						messageContent.ttl = ttl;
					}

					// Add quote if specified
					if (quote && Object.keys(quote).length > 0) {
						messageContent.quote = {
							msgId: quote.msgId,
							uidFrom: quote.uidFrom,
							content: quote.content,
							msgType: quote.msgType,
							ts: quote.ts,
							propertyExt: quote.propertyExt,
							cliMsgId: quote.cliMsgId,
							ttl: quote.ttl,
						};
					}

					// Add mentions if specified
					if (mentions && mentions.mention && mentions.mention.length > 0) {
						if (type !== ThreadType.Group) {
							throw new ApplicationError('Mentions chỉ hỗ trợ khi Type = Group');
						}

						messageContent.mentions = buildMentionsFromFields(message, mentions);
					}

					// Add styles if specified
					if (styleInputMode === 'json') {
						const stylesJson = this.getNodeParameter('stylesJson', i, '[]') as string;
						messageContent.styles =
							typeof stylesJson === 'string' ? JSON.parse(stylesJson) : stylesJson;
					} else {
						const styles = this.getNodeParameter('styles', i, {}) as any;
						if (styles && styles.style && styles.style.length > 0) {
							messageContent.styles = styles.style.map((s: any) => {
								const styleObj: any = {
									start: s.start || 0,
									len: s.len || 0,
									st: s.st,
								};
								if (s.st === 'ind_$') {
									styleObj.indentSize = s.indentSize || 1;
								}
								return styleObj;
							});
						}
					}

					// Add attachments if specified
					if (attachments && attachments.attachment && attachments.attachment.length > 0) {
						messageContent.attachments = [];
						for (const attachment of attachments.attachment) {
							let fileData;
							if (attachment.type === 'url') {
								fileData = await saveFile(attachment.imageUrl);

								if (!fileData) {
									throw new ApplicationError(`Không thể tải file từ URL: ${attachment.imageUrl}`);
								}

								tempAttachmentPaths.push(fileData);
							}

							messageContent.attachments.push(fileData);
						}
					}
				}

				// Log the parameters before sending
				this.logger.info(`Sending message with parameters: ${JSON.stringify(messageContent)}`);
				// Send the message
				if (!api) {
					throw new NodeOperationError(this.getNode(), 'Zalo API not initialized');
				}

				//Send typing event
				try {
					const recipentObj = {
						id: threadId,
						type: type,
					};
					const result = await api.sendTypingEvent(recipentObj.id, recipentObj.type);
					if (!!result) {
						this.logger.info('Send! typing event');
					}
				} catch (e) {
					this.logger.error('Cannot send typing event');
				}

				// Send message
				const response = await api.sendMessage(messageContent, threadId, type);
				this.logger.info('Message sent successfully', { threadId, type });

				returnData.push({
					json: {
						success: true,
						response,
						threadId,
						threadType: type,
						messageContent,
					},
				});
			} catch (error) {
				this.logger.error('Error sending Zalo message:', error);

				if (this.continueOnFail()) {
					returnData.push({
						json: {
							success: false,
							error: (error as Error).message,
						},
					});
				} else {
					throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
				}
			} finally {
				for (const attachmentPath of tempAttachmentPaths) {
					this.logger.info(`Remove attachment: ${attachmentPath}`);
					removeFile(attachmentPath);
				}
			}
		}

		return [returnData];
	}
}

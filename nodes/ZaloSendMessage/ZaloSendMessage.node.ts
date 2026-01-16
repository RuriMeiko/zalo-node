import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError
} from 'n8n-workflow';
import { API, ThreadType, Zalo } from 'zca-js';
import { saveFile, removeFile } from '../utils/helper';

let api: API | undefined;

export class ZaloSendMessage implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Zalo Send Message',
		name: 'zaloSendMessage',
		icon: 'file:../shared/zalo.svg',
		group: ['Zalo'],
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
				displayOptions: {
					show: {
						messageInputStyle: ['fields'],
					},
				},
				description: 'Loại của tin nhắn (user hoặc group)',
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
				description: 'Nội dung tin nhắn cần gửi',
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
				options: [
					{
						name: 'mention',
						displayName: 'Mention',
						values: [
							{
								displayName: 'User ID',
								name: 'uid',
								type: 'string',
								default: '',
								description: 'ID của người dùng được mention',
							},
							{
								displayName: 'Position',
								name: 'pos',
								type: 'number',
								default: 0,
								description: 'Vị trí mention trong tin nhắn',
							},
							{
								displayName: 'Length',
								name: 'len',
								type: 'number',
								default: 0,
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
									{ name: 'Bold', value: 'b' },
									{ name: 'Italic', value: 'i' },
									{ name: 'Underline', value: 'u' },
									{ name: 'Strike Through', value: 's' },
									{ name: 'Red', value: 'c_db342e' },
									{ name: 'Orange', value: 'c_f27806' },
									{ name: 'Yellow', value: 'c_f7b503' },
									{ name: 'Green', value: 'c_15a85f' },
									{ name: 'Small', value: 'f_13' },
									{ name: 'Big', value: 'f_18' },
									{ name: 'Unordered List', value: 'lst_1' },
									{ name: 'Ordered List', value: 'lst_2' },
									{ name: 'Indent', value: 'ind_$' },
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
				default: '[]',
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
									}
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
										'type': ['url'],
									},
								},
								description: 'URL công khai của ảnh hoặc file',
							}
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
				userAgent: userAgentFromCred
			});

			if (!api) {
				throw new NodeOperationError(this.getNode(), 'Failed to initialize Zalo API. Check your credentials.');
			}
		} catch (error) {
			throw new NodeOperationError(this.getNode(), `Zalo login error: ${(error as Error).message}`);
		}

		for (let i = 0; i < items.length; i++) {
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
						messageContent.mentions = mentions.mention.map((m: any) => ({
							pos: m.pos || 0,
							uid: m.uid,
							len: m.len || 0,
						}));
					}

					// Add styles if specified
					if (styleInputMode === 'json') {
						const stylesJson = this.getNodeParameter('stylesJson', i, '[]') as string;
						messageContent.styles = typeof stylesJson === 'string' ? JSON.parse(stylesJson) : stylesJson;
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
						type: type
					}
					const result = await api.sendTypingEvent(recipentObj.id, recipentObj.type);
					if (!!result) {
						this.logger.info("Send! typing event")
					}
				}
				catch (e) {
					this.logger.error("Cannot send typing event")
				}

				// Send message
				const response = await api.sendMessage(messageContent, threadId, type);

				//Remove temp img
				if (messageContent.attachments && messageContent.attachments.length > 0) {
					for (const attachment of messageContent.attachments) {
						this.logger.info(`Remove attachment: ${attachment}`);

						removeFile(attachment)
					}
				}
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
			}
		}

		return [returnData];
	}
}

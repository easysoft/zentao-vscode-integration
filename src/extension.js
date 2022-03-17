const vscode = require('vscode');
const {zentaoAPI} = require('./zentao-api');
const {commitWithMessage, openCommitMsgFile, formatZentaoObjectsForPicker, stripTags} = require('./util');

/**
 * @param {vscode.ExtensionContext} context
 */
const activate = async (context) => {
	const api = await new zentaoAPI(context); // 此处需要 await

	// 登录禅道
	context.subscriptions.push(vscode.commands.registerCommand('zentao.login', async () => {
		let account, password, baseURL;
		const previousCredentials = await api.getCredentials();
		const url = await vscode.window.showInputBox({
			placeHolder: 'https://biz.demo15.zentao.net/',
			value: previousCredentials.url || 'https://biz.demo15.zentao.net/',
			validateInput: input => /https?:\/{2}.*\//.test(input) ? '' : '请输入完整的禅道 URL',
			prompt: '输入禅道后端地址',
			ignoreFocusOut: true,
		});
		if (url) {
			baseURL = `${url}`;
			account = await vscode.window.showInputBox({
				placeHolder: 'demo',
				value: previousCredentials.account || 'demo',
				prompt: '输入禅道用户名',
				validateInput: input => input.length ? '' : '请输入用户名',
				ignoreFocusOut: true,
			});
		}
		if (account) {
			password = await vscode.window.showInputBox({
				placeHolder: '******',
				value: previousCredentials.password || '123456',
				prompt: '输入禅道密码',
				validateInput: input => input.length ? '' : '请输入密码',
				password: true,
				ignoreFocusOut: true,
			});
		}

		if (!url || !account || !password) {
			return vscode.window.showWarningMessage('信息不完整，登录终止');
		}
		vscode.window.showInformationMessage(`将使用 ${account}:${'*'.repeat(password.length)} 登录 ${url}`);
		api.login({url: baseURL, account, password}).then(profile => {
			vscode.window.showInformationMessage(`登录成功，当前用户 ${profile.realname}`);
			const workspaceConfig = vscode.workspace.getConfiguration();
			if (workspaceConfig.get('zentao.login.clearState')) {
				context.workspaceState.update('zentaoProduct', null);
				context.workspaceState.update('zentaoProject', null);
				context.workspaceState.update('zentaoExecution', null);
				vscode.window.showInformationMessage('已选产品、项目等已被重置。');
			}
		}).catch(e => {
			console.log(e);
			vscode.window.showWarningMessage('登录失败，请检查服务器地址、用户名、密码是否填写正确。');
		});
	}));

	// 选择当前工作区对应的产品
	context.subscriptions.push(vscode.commands.registerCommand('zentao.selectProduct', async () => {
		const products = await api.getProducts();
		if (!products || !products.length) {
			return vscode.window.showWarningMessage('没有可选项');
		}
		const pick = await vscode.window.showQuickPick(products.map(product => ({
			id: product.id,
			name: product.name,
			label: product.name,
			detail: stripTags(product.desc),
		})));
		if (pick) {
			delete pick.label;
			context.workspaceState.update('zentaoProduct', pick);
			vscode.window.showInformationMessage(`设置成功，当前产品为 "${pick.name}"`);
		}
	}));

	// 选择当前工作区对应的项目
	context.subscriptions.push(vscode.commands.registerCommand('zentao.selectProject', async () => {
		const {systemMode} = api.config;
		const projects = systemMode === 'new' ? await api.getProjects() : await api.getExecutions();
		if (!projects || !projects.length) {
			return vscode.window.showWarningMessage('没有可选项');
		}
		const pick = await vscode.window.showQuickPick(projects.map(project => ({
			id: project.id,
			name: project.name,
			label: project.name,
			detail: stripTags(project.desc),
		})));
		if (pick) {
			delete pick.label;
			if (systemMode === 'new') {
				context.workspaceState.update('zentaoProject', pick);
				context.workspaceState.update('zentaoExecution', null);
			} else {
				context.workspaceState.update('zentaoProject', null);
				context.workspaceState.update('zentaoExecution', pick);
			}
			vscode.window.showInformationMessage(`设置成功，当前项目为 "${pick.name}"${systemMode === 'new' ? '，执行选择已重置' : ''}`);
		}
	}));

	// 选择当前工作区对应的执行
	context.subscriptions.push(vscode.commands.registerCommand('zentao.selectExecution', async () => {
		const {systemMode} = api.config;
		if (systemMode === 'classic') {
			return vscode.window.showInformationMessage('当前禅道为经典模式，无需选择执行');
		}
		const currentProject = context.workspaceState.get('zentaoProject');
		if (!currentProject) {
			return vscode.window.showWarningMessage('请先选择项目再选择执行');
		}
		const executions = await api.getProjectExecutions(currentProject.id);
		if (!executions || !executions.length) {
			return vscode.window.showWarningMessage('没有可选项');
		}
		const pick = await vscode.window.showQuickPick(executions.map(execution => ({
			id: execution.id,
			name: execution.name,
			label: execution.name,
			detail: stripTags(execution.desc),
		})));
		if (pick) {
			delete pick.label;
			context.workspaceState.update('zentaoExecution', pick);
			vscode.window.showInformationMessage(`设置成功，当前执行为 "${pick.name}"`);
		}
	}));

	// 选择对象以撰写 Commit Message
	context.subscriptions.push(vscode.commands.registerCommand('zentao.pickObjectsForCommit', async () => {
		const typePick = await vscode.window.showQuickPick([
			{type: 'story', label: '需求'},
			{type: 'task', label: '任务'},
			{type: 'bug', label: 'Bug'},
		]);
		if (!typePick) {
			return;
		}
		const currentProduct = context.workspaceState.get('zentaoProduct');
		const currentExecution = context.workspaceState.get('zentaoExecution');
		let items;
		switch (typePick.type) {
			case 'story':
				if (!currentProduct) {
					return vscode.window.showWarningMessage('请先选择产品再选择需求');
				}
				items = await api.getProductStories(currentProduct.id);
				break;
			case 'bug':
				if (!currentProduct) {
					return vscode.window.showWarningMessage('请先选择产品再选择 Bug');
				}
				items = await api.getProductBugs(currentProduct.id);
				break;
			case 'task':
				if (!currentExecution) {
					return vscode.window.showWarningMessage('请先选择执行再选择任务');
				}
				items = await api.getExecutionTasks(currentExecution.id);
		}
		items = formatZentaoObjectsForPicker(items, api.user, {
			assignedToMe: typePick.type !== 'story',
			prefix: typePick.label,
			type: typePick.type,
		});
		if (!items || !items.length) {
			return vscode.window.showWarningMessage('没有可选项');
		}

		const objectPick = await vscode.window.showQuickPick(items, {canPickMany: true});
		if (!objectPick) {
			return;
		}

		const commitMessageAffix = objectPick.reduce((pv, item) => pv += `#${item.id}, `, `${typePick.type} `).replace(/, $/, '');
		const commitMessage = await vscode.window.showInputBox({
			prompt: '请输入 Commit Message 内容',
			ignoreFocusOut: true
		});

		if (commitMessage) {
			commitWithMessage(`* ${commitMessage.replace('"', '\\"')}, ${commitMessageAffix}.`);
		}
	}));

	// 选择并在浏览器中打开任务
	context.subscriptions.push(vscode.commands.registerCommand('zentao.viewObject', async () => {
		const {systemMode} = api.config;
		const quickPickItems = systemMode === 'new' ? [
			{type: 'story', parentType: 'product', label: '产品的所有需求 (product story)', prefix: '需求'},
			{type: 'story', parentType: 'project', label: '项目的需求 (project story)', prefix: '需求'},
			{type: 'story', parentType: 'execution', label: '执行的需求 (execution story)', prefix: '需求'},
			{type: 'task', parentType: 'execution', label: '执行的任务 (execution task)', prefix: '任务'},
			{type: 'bug', parentType: 'product', label: '产品的 Bug (product bug)', prefix: 'Bug'},
		] : [
			{type: 'story', parentType: 'product', label: '产品的所有需求 (product story)', prefix: '需求'},
			{type: 'story', parentType: 'execution', label: '项目的需求 (project story)', prefix: '需求'},
			{type: 'task', parentType: 'execution', label: '项目的任务 (project task)', prefix: '任务'},
			{type: 'bug', parentType: 'product', label: '产品的 Bug (product bug)', prefix: 'Bug'},
		];
		const typePick = await vscode.window.showQuickPick(quickPickItems);
		if (!typePick) {
			return;
		}
		const currentProduct = context.workspaceState.get('zentaoProduct');
		const currentProject = context.workspaceState.get('zentaoProject');
		const currentExecution = context.workspaceState.get('zentaoExecution');
		let items;
		switch (typePick.type) {
			case 'story':
				if (!currentProduct) {
					return vscode.window.showWarningMessage('请先选择产品再选择需求');
				}
				if (typePick.parentType === 'project') {
					if (!currentProject) {
						return vscode.window.showWarningMessage('请先选择项目再选择需求');
					}
					items = await api.getProjectStories(currentProject.id);
				} else if (typePick.parentType === 'execution') {
					if (!currentExecution) {
						return vscode.window.showWarningMessage(`请先选择${systemMode === 'new' ? '执行' : '项目'}再选择需求`);
					}
					items = await api.getExecutionStories(currentExecution.id);
				} else {
					items = await api.getProductStories(currentProduct.id);
				}
				break;
			case 'bug':
				if (!currentProduct) {
					return vscode.window.showWarningMessage('请先选择产品再选择 Bug');
				}
				items = await api.getProductBugs(currentProduct.id);
				break;
			case 'task':
				if (!currentExecution) {
					return vscode.window.showWarningMessage(`请先选择${systemMode === 'new' ? '执行' : '项目'}再选择任务`);
				}
				items = await api.getExecutionTasks(currentExecution.id);
				break;
		}
		items = formatZentaoObjectsForPicker(items, null, {
			prefix: typePick.prefix,
			type: typePick.type,
		});
		if (!items || !items.length) {
			return vscode.window.showWarningMessage('没有可选项');
		}

		const objectPick = await vscode.window.showQuickPick(items);
		if (!objectPick) {
			return;
		}

		const isPathInfoMode = api.config && api.config.requestType === 'PATH_INFO';
		const url = isPathInfoMode ? `${api.baseURL}${typePick.type}-view-${objectPick.id}.html?zentaosid=${api.token}` : `${api.baseURL}index.php?m=${typePick.type}&f=view&${typePick.type}ID=${objectPick.id}&zentaosid=${api.token}`;

		vscode.env.openExternal(url);
	}));

	// 打开用于撰写 Commit Message 的文件
	context.subscriptions.push(vscode.commands.registerCommand('zentao.writeCommitMessage', openCommitMsgFile));

	// 处理保存 Commit Message 文件
	context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(e => {
		if (e.languageId === 'git-commit') {
			commitWithMessage(e.getText().trim());
		}
	}));

	// Git Commit Message 任务 ID 自动补全
	vscode.languages.registerCompletionItemProvider('git-commit', {
		provideCompletionItems: async (document, position) => {
			const rules = api.reposRules;
			const taskKeyword = rules ? rules.module.task : 'task';
			const bugKeyword = rules ? rules.module.bug : 'bug';
			const storyKeyword = rules ? rules.module.story : 'story';
			const idPrefix = rules ? rules.id.mark : '#';
			const idSplitter = rules ? rules.id.split : ',';

			const linePrefix = document.lineAt(position).text.substr(0, position.character);
			let matchType = null;
			let existingIDs = [];
			if (![{type: 'task', keyword: taskKeyword, prefix: '任务'}, {type: 'bug', keyword: bugKeyword, prefix: 'Bug'}, {type: 'story', keyword: storyKeyword, prefix: '需求'}].some(type => {
				const matches = new RegExp(`${type.keyword} ${idPrefix}((\\d+${idSplitter})*)(${idPrefix}|${idSplitter})?$`, 'im').exec(linePrefix);
				if (!matches) {
					return false;
				}
				existingIDs = matches[1].split(idSplitter).filter(Boolean).map(id => +id);
				matchType = type;
				return true;
			})) {
				return;
			}

			let currentExecution, currentProduct, items;
			switch (matchType.type) {
				case 'task':
					currentExecution = context.workspaceState.get('zentaoExecution');
					if (!currentExecution) {
						return;
					}
					items = await api.getExecutionTasks(currentExecution.id);
					break;
				case 'bug':
					currentExecution = context.workspaceState.get('zentaoExecution');
					if (!currentExecution) {
						currentProduct = context.workspaceState.get('zentaoProduct');
						if (!currentProduct) {
							return;
						}
						items = await api.getProductBugs(currentProduct.id);
					} else {
						items = await api.getExecutionBugs(currentExecution.id);
					}
					break;
				case 'story':
					currentExecution = context.workspaceState.get('zentaoExecution');
					if (!currentExecution) {
						currentProduct = context.workspaceState.get('zentaoProduct');
						if (!currentProduct) {
							return;
						}
						items = await api.getProductStories(currentProduct.id);
					} else {
						items = await api.getExecutionStories(currentExecution.id);
					}
					break;
			}
			items = formatZentaoObjectsForPicker(items, null, {
				prefix: matchType.prefix,
				type: matchType.type,
				exclude: existingIDs,
			});
			if (!items || !items.length) {
				return;
			}

			return items.map(item => {
				const completionItem = new vscode.CompletionItem({
					label: `${item.id}`,
					detail: `${''.padEnd(7 - `${item.id}`.length, ' ')}${item.label}`,
				}, vscode.CompletionItemKind.Value);
				completionItem.sortText = ' ';
				return completionItem;
			});
		},
	}, api.reposRules ? api.reposRules.id.mark : '#', api.reposRules ? api.reposRules.id.split : ',');
};

module.exports = {
	activate,
};

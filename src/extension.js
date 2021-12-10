const vscode = require('vscode');
const {zentaoAPI} = require('./zentao-api');
const {executeCommandInTerminal, getGitRepos} = require('./util');

/**
 * @param {vscode.ExtensionContext} context
 */
const activate = (context) => {
	const api = new zentaoAPI(context);

	// 登录禅道
	context.subscriptions.push(vscode.commands.registerCommand('zentao.login', async () => {
		let account, password, baseURL;
		const url = await vscode.window.showInputBox({
			placeHolder: 'http://172.17.18.80/zentao/',
			value: 'http://192.168.0.45:8086/tmp/zentaopms/www/',
			validateInput: input => /https?:\/{2}.*\//.test(input) ? '' : '请输入完整的禅道 URL',
			prompt: '输入禅道后端地址',
			ignoreFocusOut: true,
		});
		if (url) {
			baseURL = `${url}`;
			account = await vscode.window.showInputBox({
				placeHolder: 'dev1',
				value: 'admin',
				prompt: '输入禅道用户名',
				validateInput: input => input.length ? '' : '请输入用户名',
				ignoreFocusOut: true,
			});
		}
		if (account) {
			password = await vscode.window.showInputBox({
				placeHolder: '******',
				value: '123456',
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
		}).catch(e => {
			console.log(e);
			vscode.window.showWarningMessage(`登录失败，请检查服务器地址、用户名、密码是否填写正确。`);
		});
	}));

	// 选择当前工作区对应的产品
	context.subscriptions.push(vscode.commands.registerCommand('zentao.selectProduct', async () => {
		const products = await api.getProducts();
		const pick = await vscode.window.showQuickPick(products.map(product => ({
			id: product.id,
			name: product.name,
			label: product.name,
			detail: product.desc,
		})));
		if (pick) {
			delete pick.label;
			context.workspaceState.update('zentaoProduct', pick);
			vscode.window.showInformationMessage(`设置成功，当前产品为 "${pick.name}"`);
		}
	}));

	// 选择当前工作区对应的项目
	context.subscriptions.push(vscode.commands.registerCommand('zentao.selectProject', async () => {
		const projects = await api.getProjects();
		const pick = await vscode.window.showQuickPick(projects.map(project => ({
			id: project.id,
			name: project.name,
			label: project.name,
			detail: project.desc,
		})));
		if (pick) {
			delete pick.label;
			context.workspaceState.update('zentaoProject', pick);
			context.workspaceState.update('zentaoExecution', null);
			vscode.window.showInformationMessage(`设置成功，当前项目为 "${pick.name}，迭代选择已重置"`);
		}
	}));

	// 选择当前工作区对应的迭代
	context.subscriptions.push(vscode.commands.registerCommand('zentao.selectExecution', async () => {
		const currentProject = context.workspaceState.get('zentaoProject');
		if (!currentProject) {
			return vscode.window.showWarningMessage('请先选择项目再选择迭代');
		}
		const projects = await api.getProjectExecutions(currentProject.id);
		const pick = await vscode.window.showQuickPick(projects.map(project => ({
			id: project.id,
			name: project.name,
			label: project.name,
			detail: project.desc,
		})));
		if (pick) {
			delete pick.label;
			context.workspaceState.update('zentaoExecution', pick);
			vscode.window.showInformationMessage(`设置成功，当前迭代为 "${pick.name}"`);
		}
	}));

	// 选择任务以撰写 Commit Message
	context.subscriptions.push(vscode.commands.registerCommand('zentao.pickTasksForCommit', () => {
		if (!token) {
			return vscode.window.showErrorMessage('请先登录禅道');
		}
		axios.get(`${baseURL}my-work-task.json`, {
			headers: {'Content-Type': 'application/json', 'Token': token}
		}).then(res => {
			const resData = JSON.parse(res.data.data);
			vscode.window.showQuickPick(resData.tasks.map(task => `任务 #${task.id}: ${task.name}`), {
				canPickMany: true,
			}).then(items => {
				const taskText = items.reduce((pv, cv) => pv += `${/ (#\d+): /.exec(cv)[1]}, `, 'task ').replace(/, $/, '');
				vscode.window.showInputBox({
					prompt: '输入 Commit Message 内容',
					ignoreFocusOut: true,
				}).then(text => {
					executeCommandInTerminal(`git commit -m "* ${text.replace('"', '\\"')}, ${taskText}."`);
				})
			});
		});
	}));

	// 选择并在浏览器中打开任务
	context.subscriptions.push(vscode.commands.registerCommand('zentao.viewTasks', () => {
		if (!token) {
			return vscode.window.showErrorMessage('请先登录禅道');
		}
		axios.get(`${baseURL}my-work-task.json`, {
			headers: {'Content-Type': 'application/json', 'Token': token}
		}).then(res => {
			const resData = JSON.parse(res.data.data);
			vscode.window.showQuickPick(resData.tasks.map(task => `任务 #${task.id}: ${task.name}`)).then(item => {
				vscode.env.openExternal(`${baseURL}task-view-${/ #(\d+): /.exec(item)[1]}.html`);
			});
		});
	}));

	// 打开用于撰写 Commit Message 的文件
	context.subscriptions.push(vscode.commands.registerCommand('zentao.writeCommitMessage', () => {
		const repos = getGitRepos();
		if (!repos) {
			return vscode.window.showWarningMessage('没有找到当前的 git 代码库');
		}
		const repoRootPath = repos[0].rootUri.path;
		const path = repoRootPath.slice(1) + '/.git/COMMIT_EDITMSG';
		const uri = vscode.Uri.file(path);
		return vscode.commands.executeCommand('vscode.open', uri, {preview: false});
	}));

	// Git Commit Message 任务 ID 自动补全
	vscode.languages.registerCompletionItemProvider('git-commit', {
		provideCompletionItems: async (document, position) => {
			if (!token) {
				return undefined;
			}
			const linePrefix = document.lineAt(position).text.substr(0, position.character);
			if (!linePrefix.endsWith('task #')) {
				return undefined;
			}
			const res = await axios.get(`${baseURL}my-work-task.json`, {
				headers: {'Content-Type': 'application/json', 'Token': token}
			});
			const resData = JSON.parse(res.data.data);
			const completionItems = resData.tasks.map(task => `    任务 #${task.id}: ${task.name}`);
			return completionItems.map(item => new vscode.CompletionItem({label: / #(\d+): /.exec(item)[1], detail: item}, vscode.CompletionItemKind.Value));
		},
	}, '#');
}

module.exports = {
	activate,
}

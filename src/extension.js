const vscode = require('vscode');
const {default: axios} = require('axios');

let baseURL, token = '';

const isTerminalExist = () => vscode.window.terminals.length !== 0;
const executeCommandInTerminal = command => {
    const terminal = isTerminalExist() ? vscode.window.activeTerminal : vscode.window.createTerminal();
	terminal.show();
	terminal.sendText(command, false); // change to true for instant execution.
}

/**
 * @param {vscode.ExtensionContext} context
 */
const activate = (context) => {
	// 登录禅道
	context.subscriptions.push(vscode.commands.registerCommand('zentao.login', async () => {
		let account, password;
		const url = await vscode.window.showInputBox({
			placeHolder: 'http://172.31.44.116/zentao/',
			value: 'http://172.31.44.116/zentao/',
			validateInput: input => /https?:\/{2}.*\//.test(input) ? '' : '请输入完整的禅道 URL',
			prompt: '输入禅道后端地址',
			ignoreFocusOut: true,
		});
		if (url) {
			baseURL = `${url}`;
			account = await vscode.window.showInputBox({
				placeHolder: 'admin',
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
		vscode.window.showInformationMessage(`将使用 ${account}:${'*'.repeat(password.length)} 在 ${url} 登录`);
		axios.post(`${baseURL}api.php/v1/tokens`, {account, password}, {
			headers: {'Content-Type': 'application/json'}
		}).then(res => {
			({token} = res.data);
			vscode.window.showInformationMessage(`登录成功，获得 token: ${token}`);
		});
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
		const gitExtension = vscode.extensions.getExtension('vscode.git').exports;
    	const git = gitExtension.getAPI(1)
		const repos = git.repositories;
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
	}, '#')
}

module.exports = {
	activate,
}

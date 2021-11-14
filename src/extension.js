const vscode = require('vscode');

let baseURL = '';

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	context.subscriptions.push(vscode.commands.registerCommand('zentao.getURL', function () {
		vscode.window.showInformationMessage(baseURL);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('zentao.setURL', async url => {
		if (!url) {
			url = await vscode.window.showInputBox({
				placeHolder: "https://demo.zentao.com",
				prompt: "Enter zentao base url"
			});
		}
		if (url) {
			baseURL = url;
		}
	}));
}

module.exports = {
	activate,
}

const vscode = require('vscode');

/**
 * 判断是否已经存在命令行终端
 * @returns {bool}
 */
const isTerminalExist = () => vscode.window.terminals.length !== 0;

/**
 * 在命令行终端执行命令
 * @param {string} command 命令
 * @param {bool} execute 是否立刻执行
 */
const executeCommandInTerminal = (command, execute = true) => {
    const terminal = isTerminalExist() ? vscode.window.activeTerminal : vscode.window.createTerminal();
	terminal.show();
	terminal.sendText(command, execute);
}

/**
 * 获取当前工作区的 git 仓库
 * @returns {object[]} git 仓库
 */
const getGitRepos = () => {
    const gitExtension = vscode.extensions.getExtension('vscode.git').exports;
    const git = gitExtension.getAPI(1)
    return git.repositories;
}

module.exports = {
    isTerminalExist,
    executeCommandInTerminal,
    getGitRepos,
}
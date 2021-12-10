const vscode = require('vscode');

/**
 * 判断是否已经存在命令行终端
 * @returns {boolean}
 */
const isTerminalExist = () => vscode.window.terminals.length !== 0;

/**
 * 在命令行终端执行命令
 * @param {string} command 命令
 * @param {boolean} execute 是否立刻执行
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

/**
 * 为选择操作过滤和处理禅道中的对象（需求、任务、Bug 等）
 * @param {object[]} objects 需要格式化的对象
 * @param {object} user 当前用户
 * @param {object} options 可选参数
 * @param {boolean} [options.assignedToMe] 只保留指派给当前用户的对象
 * @param {string} [options.prefix] 每项的前缀
 * @returns {object[]} 适用于选择操作的对象数组
 */
const formatZentaoObjectsForPicker = (objects, user = null, options = {}) => {
    if (options.assignedToMe && user) {
        objects = objects.filter(o => o.assignedTo && o.assignedTo.id === user.id);
    }

    return objects.map(o => ({
        id: o.id,
        label: `${options.prefix ? `${options.prefix} ` : ''}#${o.id}: ${o.name}`,
    }));
}

module.exports = {
    isTerminalExist,
    executeCommandInTerminal,
    getGitRepos,
    formatZentaoObjectsForPicker,
}
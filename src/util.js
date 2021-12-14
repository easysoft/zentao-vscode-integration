const vscode = require('vscode');
const stripTags = require('striptags');

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
};

/**
 * 获取当前工作区的 git 仓库
 * @returns {object[]} git 仓库
 */
const getGitRepos = () => {
    const gitExtension = vscode.extensions.getExtension('vscode.git').exports;
    try {
        const git = gitExtension.getAPI(1);
        return git.repositories;
    } catch(e) {
        vscode.window.showErrorMessage('无法使用 git，请检查 git 是否已经安装并开启');
        return [];
    }
};

/**
 * 创建一个 Commit
 * @param {string} message commit message
 */
const commitWithMessage = message => {
    const repos = getGitRepos();
    if (!repos || !repos.length) {
        return vscode.window.showWarningMessage('没有找到当前的 git 代码库');
    }
    if (repos.length !== 1) {
        return executeCommandInTerminal(`git commit -m "${message.replace('"', '\\"')}"`, false);
    }
    repos[0].inputBox.value = message;
    vscode.commands.executeCommand('workbench.scm.focus');
};

/**
 * 打开 COMMIT_EDITMSG 文件
 */
const openCommitMsgFile = async () => {
    const repos = getGitRepos();
    if (!repos || !repos.length) {
        return vscode.window.showWarningMessage('没有找到当前的 git 代码库');
    }
    const repoRootPath = repos[0].rootUri.path;
    const path = repoRootPath.slice(1) + '/.git/COMMIT_EDITMSG';
    const uri = vscode.Uri.file(path);
    try {
        await vscode.workspace.fs.stat(uri);
    } catch (e) {
        // 此时 COMMIT_EDITMSG 不存在，创建之
        await vscode.workspace.fs.writeFile(uri, new Uint8Array());
    }
    return vscode.commands.executeCommand('vscode.open', uri, {preview: false});
};

/**
 * 为选择操作过滤和处理禅道中的对象（需求、任务、Bug 等）
 * @param {object[]} objects 需要格式化的对象
 * @param {object} user 当前用户
 * @param {object} options 可选参数
 * @param {boolean} [options.assignedToMe] 只保留指派给当前用户的对象
 * @param {string} [options.prefix] 每项的前缀
 * @returns {{id: number, label: string}[]} 适用于选择操作的对象数组
 */
const formatZentaoObjectsForPicker = (objects, user = null, options = {}) => {
    if (!objects) {
        return;
    }
    if (options.assignedToMe && user) {
        objects = objects.filter(o => o.assignedTo && (typeof o.assignedTo === 'object' ? o.assignedTo.id === user.id : o.assignedTo === user.account));
    }

    return objects.map(o => ({
        id: o.id,
        label: `${options.prefix ? `${options.prefix} ` : ''}#${o.id}: ${o.title || o.name}`,
    }));
};

module.exports = {
    isTerminalExist,
    executeCommandInTerminal,
    getGitRepos,
    commitWithMessage,
    openCommitMsgFile,
    formatZentaoObjectsForPicker,
    stripTags,
};

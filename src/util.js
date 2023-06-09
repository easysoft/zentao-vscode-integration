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
 * @param {string} [options.type] 数据类型 ('story' | 'task' | 'bug')
 * @param {number[]} [options.exclude] 要过滤掉的 ID 数组
 * @returns {{id: number, label: string}[]} 适用于选择操作的对象数组
 */
const formatZentaoObjectsForPicker = (objects, user = null, options = {}) => {
    if (!objects) {
        return;
    }

    // 处理子任务、子需求
    objects = objects.map(o => o.children ? [o, o.children] : o).flat(2);

    if (options.assignedToMe && user) {
        objects = objects.filter(o => o.assignedTo && (typeof o.assignedTo === 'object' ? o.assignedTo.id === user.id : o.assignedTo === user.account));
    }

    const objectType = options.type;
    const workspaceConfig = vscode.workspace.getConfiguration();
    switch (objectType) {
        case 'bug':
            const filterBugs = workspaceConfig.get('zentao.filter.filterBugs');
            if (filterBugs) {
                const statuses = ['active', 'confirmed'];
                objects = objects.filter(o => o.status && ((typeof o.status === 'object' && statuses.includes(o.status.code)) || statuses.includes(o.status)));
            }
            break;
        case 'task':
            const filterTasks = workspaceConfig.get('zentao.filter.filterTasks');
            if (filterTasks) {
                const statuses = ['wait', 'doing'];
                objects = objects.filter(o => o.status && statuses.includes(o.status));
            }
            break;
        case 'story':
            const filterStories = workspaceConfig.get('zentao.filter.filterStories');
            if (filterStories) {
                const statuses = ['active', 'changed'];
                objects = objects.filter(o => o.status && statuses.includes(o.status));
            }
            break;
    }

    if (options.exclude) {
        objects = objects.filter(o => !options.exclude.includes(o.id));
    }

    return objects.map(o => ({
        id: o.id,
        label: `${(o.parent && o.parent != -1) ? ' └ ' : ''}${options.prefix ? `${options.prefix} ` : ''}#${o.id}: ${o.title || o.name}`,
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

const vscode = require('vscode');
const {default: axios} = require('axios');

// 与禅道 API 通讯
class zentaoAPI {
    constructor(context) {
        /**
         * 扩展上下文（扩展激活时创建的）
         * @type {vscode.ExtensionContext}
         */
        this._context = context;

        /**
         * API Token
         * @type {string}
         */
        this._token = '';

        /**
         * API URL
         * @type {string}
         */
        this._baseURL = '';

        /**
         * 禅道用户对象
         * @type {object}
         */
        this._user = null;

        // 初始化时获取上次保存的凭据，并设置用户
        Promise.all([
            context.secrets.get('token').then(token => {
                if (token) {
                    this._token = token;
                }
            }),
            context.secrets.get('url').then(url => {
                if (url) {
                    this._baseURL = url;
                }
            }),
        ]).then(() => this.getCurrentUser().then(profile => {
            if (profile) {
                this._user = profile;
            }
        }));
    }

    /**
     * 存储禅道登录地址、凭据信息
     * @param {object} credentials 登录信息
     * @param {string} [credentials.url] 禅道地址
     * @param {string} [credentials.account] 用户名
     * @param {string} [credentials.password] 密码
     * @param {string} [credentials.token] token
     * @returns {Promise}
     */
    setCredentials(credentials) {
        const storePromises = [];
        for (const key in credentials) {
            if (Object.hasOwnProperty.call(credentials, key)) {
                storePromises.push(this._context.secrets.store(key, credentials[key]));
            }
        }
        return Promise.allSettled(storePromises);
    }

    /**
     * 获取存储的禅道登录地址、凭据信息
     * @returns {Promise}
     */
    async getCredentials() {
        const keys = ['url', 'account', 'password', 'token'];
        const storePromises = keys.map(key => this._context.secrets.get(key));
        const storedValues = await Promise.allSettled(storePromises);
        let creds = {};
        storedValues.forEach((item, index) => {
            creds[keys[index]] = item.value;
        })
        return creds;
    }

    /**
     * GET 一个禅道 API
     * @param {string} path 路径
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    async get(path) {
        try {
            const response = await axios.get(`${this._baseURL}api.php/v1/${path}`, {
                headers: {'Content-Type': 'application/json', Token: this._token}
            });
            return response;
        } catch (error) {
            return vscode.window.showErrorMessage('请求后端出错，请尝试重新登录，并检查用户权限');
        }
    }

    /**
     * GET 一个带分页的禅道 API 的全部数据（limit 设置为 total）
     * @param {string} path 路径
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    async getAll(path) {
        const firstResponse = await this.get(path);
        if (firstResponse.data.limit >= firstResponse.data.total) {
            return firstResponse;
        }
        return await this.get(`${path}?limit=${firstResponse.data.total}`);
    }

    /**
     * POST 一个禅道 API
     * @param {string} path 路径
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    async post(path, data) {
        try {
            const response = await axios.post(`${this._baseURL}api.php/v1/${path}`, data, {
                headers: {'Content-Type': 'application/json', Token: this._token}
            });
            return response;
        } catch (error) {
            return vscode.window.showErrorMessage('请求后端出错，请尝试重新登录，并检查用户权限');
        }
    }

    /**
     * @returns {object} 存储的用户
     */
    get user() {
        return this._user;
    }

    /**
     * @returns {string} 存储的 token
     */
    get token() {
        return this._token;
    }

    /**
     * @returns {string} 存储的 URL
     */
    get baseURL() {
        return this._baseURL;
    }

    /**
     * 获取当前用户
     * @returns {object} 当前登录的用户
     */
    async getCurrentUser() {
        const response = await this.get('user');
        return response.data.profile;
    }

    /**
     * 登录禅道
     * @param {object} credentials 凭据
     * @param {string} [credentials.url] 禅道地址
     * @param {string} [credentials.account] 用户名
     * @param {string} [credentials.password] 密码
     * @returns {object} 当前登录的用户信息
     */
    async login(credentials) {
        if (credentials) {
            await this.setCredentials(credentials);
        } else {
            credentials = await this.getCredentials();
        }

        if (!credentials.token) {
            const response = await axios.post(`${credentials.url}api.php/v1/tokens`, {account: credentials.account, password: credentials.password}, {
                headers: {'Content-Type': 'application/json'}
            });

            const {token} = response.data;
            this._token = token;
            this._baseURL = credentials.url;
            await this.setCredentials({token});
        }
        this._user = await this.getCurrentUser(credentials);
        return this._user;
    }

    /**
     * 获取产品列表
     * @returns {object[]} 产品列表
     */
    async getProducts() {
        const response = await this.getAll('products');
        return response.data.products;
    }

    /**
     * 获取产品详情
     * @param {number} product 产品 ID
     * @returns {object} 产品
     */
    async getProduct(product) {
        const response = await this.get(`products/${product}`);
        return response.data;
    }

    /**
     * 获取项目列表
     * @returns {object[]} 项目列表
     */
    async getProjects() {
        const response = await this.getAll('projects');
        return response.data.projects;
    }

    /**
     * 获取项目详情
     * @param {number} project 项目 ID
     * @returns {object} 项目
     */
    async getProject(project) {
        const response = await this.get(`projects/${project}`);
        return response.data;
    }

    /**
     * 获取产品的需求
     * @param {number} product 产品 ID
     * @returns {object[]} 需求列表
     */
    async getProductStories(product) {
        const response = await this.getAll(`products/${product}/stories`);
        return response.data.stories;
    }

    /**
     * 获取产品的 bugs
     * @param {number} product 产品 ID
     * @returns {object[]} bug 列表
     */
    async getProductBugs(product) {
        const response = await this.getAll(`products/${product}/bugs`);
        return response.data.bugs;
    }

    /**
     * 获取项目的执行列表
     * @param {number} project
     * @returns {object[]} 执行列表
     */
    async getProjectExecutions(project) {
        const response = await this.getAll(`projects/${project}/executions`);
        return response.data.executions;
    }

    /**
     * 获取执行的任务列表
     * @param {number} execution 执行 ID
     * @returns {object[]} 任务列表
     */
    async getExecutionTasks(execution) {
        const response = await this.getAll(`executions/${execution}/tasks`);
        return response.data.tasks;
    }

    /**
     * 获取版本库列表
     * @returns {object[]} 版本库列表
     */
    async getRepos() {
        const response = await this.get('repos');
        return response.data.repos;
    }
}

module.exports = {
    zentaoAPI
};
